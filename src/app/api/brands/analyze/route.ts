import { NextRequest, NextResponse } from 'next/server'
import { queryAll, queryOne } from '@/lib/supabase'
import { fetchTranscript } from '@/lib/transcript'
import { analyzeBrandsFromTranscript, analyzeBrandsFromMetadata } from '@/lib/brand-analyzer'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { video_ids, campaign_id, force = false } = body

    if (!video_ids || !Array.isArray(video_ids) || video_ids.length === 0) {
      return NextResponse.json({ error: 'video_ids array is required' }, { status: 400 })
    }
    if (!campaign_id) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 })
    }

    // Get known campaign brands
    const brandRows = await queryAll('SELECT name FROM campaign_brands WHERE campaign_id = $1', [campaign_id])
    const campaignBrands = brandRows.map((r: any) => r.name)

    // Get video details (include description for metadata fallback)
    const videos = await queryAll(
      `SELECT id, youtube_id, title, channel_name, description FROM videos WHERE youtube_id = ANY($1)`,
      [video_ids]
    )

    const results: any[] = []

    for (const video of videos) {
      // Check if already analyzed (unless force)
      if (!force) {
        const existing = await queryOne('SELECT COUNT(*) as cnt FROM brand_analysis WHERE video_id = $1', [video.id])
        if (existing?.cnt > 0) {
          results.push({ youtube_id: video.youtube_id, status: 'already_analyzed' })
          continue
        }
      }

      // Fetch transcript
      let transcript = null
      const existingTranscript = await queryOne(
        'SELECT transcript_text, language FROM video_transcripts WHERE video_id = $1', [video.id]
      )

      if (existingTranscript) {
        transcript = { text: existingTranscript.transcript_text, language: existingTranscript.language }
      } else {
        transcript = await fetchTranscript(video.youtube_id)
        if (transcript) {
          await queryOne(
            'INSERT INTO video_transcripts (video_id, transcript_text, language) VALUES ($1, $2, $3) ON CONFLICT (video_id) DO NOTHING',
            [video.id, transcript.text, transcript.language]
          )
        }
      }

      if (!transcript || !transcript.text) {
        // Fallback: analyze using video metadata (title, channel, description)
        const detections = await analyzeBrandsFromMetadata(video.title, video.channel_name || '', video.description || '', campaignBrands)

        if (force) {
          await queryOne('DELETE FROM brand_analysis WHERE video_id = $1', [video.id])
        }

        const detectedBrands: string[] = []
        for (const d of detections) {
          await queryOne(
            `INSERT INTO brand_analysis (video_id, brand_name, confidence, mention_type, context_quotes)
             VALUES ($1, $2, $3, $4, $5)`,
            [video.id, d.brand_name, d.confidence, d.mention_type, d.context_quotes || []]
          )
          if (d.confidence >= 0.6) detectedBrands.push(d.brand_name)
        }

        if (detectedBrands.length > 0) {
          const videoRow = await queryOne('SELECT tags FROM videos WHERE id = $1', [video.id])
          const currentTags = Array.isArray(videoRow?.tags) ? videoRow.tags : []
          const mergedTags = [...new Set([...currentTags, ...detectedBrands])]
          await queryOne('UPDATE videos SET tags = $1 WHERE id = $2', [mergedTags, video.id])

          for (const brand of detectedBrands) {
            await queryOne(
              'INSERT INTO brand_tags (video_id, brand_name, campaign_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
              [video.id, brand, campaign_id]
            )
          }
        }

        results.push({
          youtube_id: video.youtube_id, status: 'analyzed',
          source: 'metadata', language: 'n/a',
          brands_detected: detections.length, high_confidence_brands: detectedBrands,
        })
        continue
      }

      // Analyze with AI
      const detections = await analyzeBrandsFromTranscript(transcript.text, video.title, campaignBrands)

      // Store results
      if (force) {
        await queryOne('DELETE FROM brand_analysis WHERE video_id = $1', [video.id])
      }

      const detectedBrands: string[] = []
      for (const d of detections) {
        await queryOne(
          `INSERT INTO brand_analysis (video_id, brand_name, confidence, mention_type, context_quotes)
           VALUES ($1, $2, $3, $4, $5)`,
          [video.id, d.brand_name, d.confidence, d.mention_type, d.context_quotes || []]
        )
        if (d.confidence >= 0.6) detectedBrands.push(d.brand_name)
      }

      // Merge high-confidence detections into video tags
      if (detectedBrands.length > 0) {
        const videoRow = await queryOne('SELECT tags FROM videos WHERE id = $1', [video.id])
        const currentTags = Array.isArray(videoRow?.tags) ? videoRow.tags : []
        const mergedTags = [...new Set([...currentTags, ...detectedBrands])]
        await queryOne('UPDATE videos SET tags = $1 WHERE id = $2', [mergedTags, video.id])

        for (const brand of detectedBrands) {
          await queryOne(
            'INSERT INTO brand_tags (video_id, brand_name, campaign_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [video.id, brand, campaign_id]
          )
        }
      }

      results.push({
        youtube_id: video.youtube_id, status: 'analyzed',
        transcript_length: transcript.text.length, language: transcript.language,
        brands_detected: detections.length, high_confidence_brands: detectedBrands,
      })
    }

    return NextResponse.json({ results })
  } catch (err: any) {
    console.error('Brand analysis error:', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const videoId = searchParams.get('video_id')
    const campaignId = searchParams.get('campaign_id')

    if (!videoId && !campaignId) {
      return NextResponse.json({ error: 'video_id or campaign_id required' }, { status: 400 })
    }

    if (videoId) {
      const analyses = await queryAll(`
        SELECT ba.*, v.youtube_id, v.title
        FROM brand_analysis ba JOIN videos v ON v.id = ba.video_id
        WHERE ba.video_id = $1 ORDER BY ba.confidence DESC
      `, [videoId])

      const transcript = await queryOne(
        'SELECT language, fetched_at FROM video_transcripts WHERE video_id = $1', [videoId]
      )
      return NextResponse.json({ analyses, transcript })
    }

    // Campaign-wide summary
    const summary = await queryAll(`
      SELECT ba.brand_name, COUNT(DISTINCT ba.video_id) as video_count, AVG(ba.confidence) as avg_confidence
      FROM brand_analysis ba
      JOIN videos v ON v.id = ba.video_id
      JOIN campaign_videos cv ON cv.video_id = v.id
      WHERE cv.campaign_id = $1
      GROUP BY ba.brand_name ORDER BY video_count DESC
    `, [campaignId])

    return NextResponse.json({ summary })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
