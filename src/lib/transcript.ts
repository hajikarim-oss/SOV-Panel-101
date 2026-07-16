import { YoutubeTranscript } from 'youtube-transcript'
import { queryOne, queryAll } from './supabase'
import { decryptApiKey } from './crypto'

interface TranscriptSegment {
  text: string
  offset: number
  duration: number
}

// ── Method 1: youtube-transcript library (fastest, no API key) ─────
async function fetchViaLibrary(youtubeId: string): Promise<{ text: string; language: string } | null> {
  const langs = ['en', 'hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa', 'ur']

  for (const lang of langs) {
    try {
      const segments: TranscriptSegment[] = await YoutubeTranscript.fetchTranscript(youtubeId, { lang })
      if (segments && segments.length > 0) {
        const fullText = segments.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim()
        if (fullText.length > 10) return { text: fullText, language: lang }
      }
    } catch {
      // Try next language
    }
  }
  return null
}

// ── Method 2: YouTube Data API captions (API key for list, OAuth for download) ──
async function fetchViaYouTubeAPI(youtubeId: string): Promise<{ text: string; language: string } | null> {
  try {
    // Step 1: Get API key for captions.list (cheap, 100 units)
    const today = new Date().toISOString().split('T')[0]
    await queryOne(
      `UPDATE api_keys SET units_used = 0, reset_date = $1 WHERE reset_date < $2 AND is_active = true`,
      [today, today]
    )

    const key = await queryOne<{ id: string; api_key: string }>(
      `SELECT id, api_key FROM api_keys
       WHERE is_active = true AND (units_used + 100) <= units_limit
       ORDER BY units_used ASC LIMIT 1`
    )

    if (!key) return null

    let apiKey: string
    try { apiKey = decryptApiKey(key.api_key) } catch { apiKey = key.api_key }

    // Step 2: List available captions
    const listUrl = `https://www.googleapis.com/youtube/v3/captions?videoId=${youtubeId}&part=snippet&key=${apiKey}`
    const listRes = await fetch(listUrl)
    if (!listRes.ok) return null
    const listData = await listRes.json()

    if (!listData.items || listData.items.length === 0) return null

    // Find the best caption track (prefer Indian languages)
    const preferredLangs = ['hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa', 'en']
    let bestCaption = null

    for (const prefLang of preferredLangs) {
      bestCaption = listData.items.find((item: any) =>
        item.snippet.language === prefLang ||
        item.snippet.language?.startsWith(prefLang)
      )
      if (bestCaption) break
    }

    if (!bestCaption) bestCaption = listData.items[0]
    if (!bestCaption) return null

    const captionId = bestCaption.id
    const lang = bestCaption.snippet.language || 'unknown'

    // Step 3: Download caption using OAuth (captions.download requires oauth)
    let xmlContent: string | null = null

    // Try OAuth first (captions.download needs youtube.force-ssl scope)
    try {
      const { getValidAccessToken } = await import('./youtube-oauth')
      const accessToken = await getValidAccessToken()
      const downloadUrl = `https://www.googleapis.com/youtube/v3/captions/${captionId}?tfmt=srv3`
      const downloadRes = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (downloadRes.ok) {
        xmlContent = await downloadRes.text()
      }
    } catch {
      // OAuth not configured or token expired — try API key fallback
    }

    // Fallback: try with API key (usually 403 but worth trying)
    if (!xmlContent) {
      try {
        const downloadUrl = `https://www.googleapis.com/youtube/v3/captions/${captionId}?tfmt=srv3&key=${apiKey}`
        const downloadRes = await fetch(downloadUrl)
        if (downloadRes.ok) {
          xmlContent = await downloadRes.text()
        }
      } catch { /* ignore */ }
    }

    if (!xmlContent) return null

    // Parse XML caption content
    const textMatches = xmlContent.match(/<text[^>]*>([^<]+)<\/text>/g)
    if (!textMatches || textMatches.length === 0) {
      const plainText = xmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      if (plainText.length > 10) return { text: plainText, language: lang }
      return null
    }

    const fullText = textMatches
      .map((m: string) => m.replace(/<[^>]+>/g, '').trim())
      .filter((t: string) => t.length > 0)
      .join(' ')

    // Consume quota
    await queryOne('UPDATE api_keys SET units_used = units_used + 100 WHERE id = $1', [key.id])

    return { text: fullText, language: lang }
  } catch {
    return null
  }
}

// ── Method 3: Whisper Speech-to-Text (free via Groq) ──────────────
async function fetchViaWhisper(youtubeId: string): Promise<{ text: string; language: string } | null> {
  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) return null

  try {
    const { execSync } = await import('child_process')
    const fs = await import('fs')
    const path = await import('path')
    const os = await import('os')

    const tmpDir = os.tmpdir()
    const outputPath = path.join(tmpDir, `sov_audio_${youtubeId}.webm`)

    // Step 1: Download audio via yt-dlp (bestaudio format)
    try {
      execSync(
        `yt-dlp -f "bestaudio[ext=webm]/bestaudio" -o "${outputPath}" "https://www.youtube.com/watch?v=${youtubeId}"`,
        { timeout: 90000, stdio: 'pipe' }
      )
    } catch {
      // Try alternate format
      try {
        execSync(
          `yt-dlp -f bestaudio -o "${outputPath}" "https://www.youtube.com/watch?v=${youtubeId}"`,
          { timeout: 90000, stdio: 'pipe' }
        )
      } catch {
        return null
      }
    }

    if (!fs.existsSync(outputPath)) return null

    const fileSize = fs.statSync(outputPath).size
    if (fileSize === 0) return null

    // Groq Whisper has a 25MB file size limit
    if (fileSize > 25 * 1024 * 1024) {
      fs.unlinkSync(outputPath)
      return null
    }

    // Step 2: Send to Groq Whisper API
    const audioBuffer = fs.readFileSync(outputPath)
    const formData = new FormData()
    formData.append('file', new Blob([audioBuffer], { type: 'audio/webm' }), `${youtubeId}.webm`)
    formData.append('model', 'whisper-large-v3')
    formData.append('response_format', 'json')

    const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}` },
      body: formData,
    })

    // Cleanup temp file
    try { fs.unlinkSync(outputPath) } catch {}

    if (!whisperRes.ok) return null

    const result = await whisperRes.json()
    if (result.text && result.text.length > 10) {
      return { text: result.text, language: result.language || 'unknown' }
    }

    return null
  } catch {
    return null
  }
}

// ── Main: Try all methods in order ─────────────────────────────────
export async function fetchTranscript(youtubeId: string): Promise<{ text: string; language: string } | null> {
  // Method 1: youtube-transcript library (fastest)
  const libraryResult = await fetchViaLibrary(youtubeId)
  if (libraryResult) return libraryResult

  // Method 2: YouTube Data API captions (OAuth)
  const apiResult = await fetchViaYouTubeAPI(youtubeId)
  if (apiResult) return apiResult

  // Method 3: Whisper Speech-to-Text (slowest, but works for ALL languages)
  const whisperResult = await fetchViaWhisper(youtubeId)
  if (whisperResult) return whisperResult

  return null
}

export function chunkTranscript(text: string, maxChars: number = 8000): string[] {
  if (text.length <= maxChars) return [text]

  const chunks: string[] = []
  const sentences = text.split(/(?<=[.!?])\s+/)
  let current = ''

  for (const sentence of sentences) {
    if (current.length + sentence.length > maxChars) {
      if (current) chunks.push(current)
      current = sentence
    } else {
      current += (current ? ' ' : '') + sentence
    }
  }
  if (current) chunks.push(current)

  return chunks
}
