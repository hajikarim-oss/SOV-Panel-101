import OpenAI from 'openai'

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || '',
})

export type VideoFormat =
  | 'single_review'
  | 'comparison'
  | 'roundup'
  | 'haul_or_vlog'
  | 'tutorial_or_howto'
  | 'other'

export interface BrandNote {
  brand_name: string
  why_it_matters: string
  confidence: number
  context_quotes: string[]
}

export interface BrandAnalysisResult {
  video_format: VideoFormat
  brand_notes: BrandNote[]
}

// Legacy interface kept for backward compatibility with DB writes
export interface BrandDetection {
  brand_name: string
  confidence: number
  mention_type: 'primary_review' | 'comparison' | 'mentioned' | 'recommendation'
  context_quotes: string[]
  why_it_matters?: string
}

const RETAIL_PLATFORMS = [
  'amazon', 'flipkart', 'meesho', 'myntra', 'ajio', 'snapdeal',
  'tata cliq', 'nykaa', 'reliance digital', 'croma', 'vijay sales',
  'industry buying', 'paytm mall', 'jiomart',
]

function buildBrandDetectionPrompt(
  transcript: string,
  title: string,
  channelName: string,
  description: string,
  pinnedComment: string | null,
  campaignBrands: string[]
): string {
  return `You are TBM's senior market intelligence analyst. You've manually watched thousands of Indian YouTube videos and written brand notes for client pitch decks (Atomberg, Amazon, PhonePe, Meesho, and others). You know exactly what's worth flagging versus what a junior analyst would over-tag. Your notes go straight into client-facing reports, so precision matters more than coverage.

═══ INPUT ═══
TITLE: ${title}
CHANNEL: ${channelName}
DESCRIPTION: ${description || '(none provided)'}
PINNED COMMENT: ${pinnedComment || '(none available)'}
TRANSCRIPT: ${transcript}

BRANDS THIS CLIENT CARES ABOUT (prioritize detecting these if genuinely present — do not force-fit them if absent): ${campaignBrands.join(', ')}

Read the description and pinned comment as real signal, not filler — sponsorship disclosures, the actual product being reviewed, and affiliate context often show up there more explicitly than in spoken content.

═══ STEP 0 — WHAT KIND OF VIDEO IS THIS? ═══
Decide the format before tagging anything, because it changes how many brands genuinely matter:
- "single_review" — one product is the clear subject
- "comparison" — two or three products directly pitted against each other
- "roundup" — a list of products in the same category, each getting real airtime ("Top 5...", "Best X under ₹Y")
- "haul_or_vlog" — several products mentioned in passing, none reviewed in depth
- "tutorial_or_howto" — brands appear only as incidental tools/props
- "other"

═══ STEP 1 — ANALYST JUDGMENT ═══
Think the way you would if you'd just finished watching this and were writing notes for tomorrow's brief — not running a checklist.

- single_review / comparison: the brand(s) actually evaluated matter. Passing name-drops don't.
- roundup: every product that gets real discussion matters equally. Don't force a fake single "primary" brand.
- haul_or_vlog / tutorial: be skeptical by default. Only tag a brand if the creator actually gives an opinion on it, not just names it.
- Retail platforms (Amazon, Flipkart, Meesho, Myntra, Ajio, Snapdeal, Tata Cliq, Nykaa, Reliance Digital, Croma, and equivalents) are NEVER brands, in any video format — they're where something was bought, not what was bought. This includes when the creator says "link in Flipkart description" or "best deals on Amazon."
- Generic category words ("a mixer grinder", "a smart lock", "a water purifier") are not brands. Only the branded version counts ("a Bajaj mixer grinder").
- A brand said once with zero elaboration ("I also tried a Kent one ages ago") doesn't earn a note. If a brand is compared, argued for/against, or positioned as a real alternative — that's a signal, write it down.
- Regional-language and code-mixed speech (Hindi-English, Kannada, Telugu, Tamil, Malayalam, transliterated brand names, e.g. "Aquaguard le liya") carries identical weight to English. Don't miss or discount a brand because of the language it was said in.
- Sponsored mentions, brand-read scripts, and organic opinions all count equally — you're tracking what got said, not judging sincerity.

For each brand that earns a place in your notes, you must be able to state in one honest phrase why a real analyst would write it down. If you can't, don't include it.

═══ CALIBRATION EXAMPLES ═══

--- EXAMPLE 1: single_review (Aquaguard Royal review) ---
TITLE: "Aquaguard Royal RO+UV+UF Water Purifier Review | Is it worth ₹18,999?"
CHANNEL: "TechBar"
TRANSCRIPT EXCERPT: "Today we have the Aquaguard Royal. This is Eureka Forbes' flagship model. The build quality is solid, you get a 7-stage purification process. Compared to the KENT Glory, the Aquaguard has better TDS reduction. Livpure's Pep Pro is cheaper but misses UV. I'd pick the Aquaguard if your budget allows."
CORRECT OUTPUT:
{
  "video_format": "single_review",
  "brand_notes": [
    { "brand_name": "Aquaguard", "why_it_matters": "Primary product reviewed — Eureka Forbes flagship positioned as top pick", "confidence": 0.97, "context_quotes": ["Today we have the Aquaguard Royal", "I'd pick the Aquaguard if your budget allows"] },
    { "brand_name": "KENT", "why_it_matters": "Direct competitor used as benchmark for TDS reduction comparison", "confidence": 0.85, "context_quotes": ["Compared to the KENT Glory, the Aquaguard has better TDS reduction"] },
    { "brand_name": "Livpure", "why_it_matters": "Positioned as cheaper alternative with a specific trade-off noted", "confidence": 0.80, "context_quotes": ["Livpure's Pep Pro is cheaper but misses UV"] }
  ]
}
NOTE: "Eureka Forbes" is Aquaguard's parent — do NOT double-tag it separately.

--- EXAMPLE 2: roundup (Top 5 water purifiers) ---
TITLE: "Top 5 Water Purifiers in India 2024 | Best RO under ₹15000"
CHANNEL: "Gadgets Now"
TRANSCRIPT EXCERPT: "Number 5 is the Pureit Classic — HUL's budget option at ₹7,999. Number 4, Blue Star Hydra — decent but noisy. Number 3, AO Smith Z8 — premium pick, great hot water dispensing. Number 2, Aquaguard Magna — solid mid-range. And number 1, KENT Pride — best value for money."
CORRECT OUTPUT:
{
  "video_format": "roundup",
  "brand_notes": [
    { "brand_name": "Pureit", "why_it_matters": "HUL brand at #5 — positioned as budget entry with real airtime", "confidence": 0.92, "context_quotes": ["Pureit Classic — HUL's budget option at ₹7,999"] },
    { "brand_name": "Blue Star", "why_it_matters": "Hydra model at #4 — noted with specific pro/con", "confidence": 0.88, "context_quotes": ["Blue Star Hydra — decent but noisy"] },
    { "brand_name": "AO Smith", "why_it_matters": "Z8 at #3 — premium positioning with unique selling point called out", "confidence": 0.90, "context_quotes": ["AO Smith Z8 — premium pick, great hot water dispensing"] },
    { "brand_name": "Aquaguard", "why_it_matters": "Magna at #2 — mid-range with genuine evaluation", "confidence": 0.91, "context_quotes": ["Aquaguard Magna — solid mid-range"] },
    { "brand_name": "KENT", "why_it_matters": "Pride at #1 — declared best value, clear recommendation", "confidence": 0.93, "context_quotes": ["KENT Pride — best value for money"] }
  ]
}

--- EXAMPLE 3: haul_or_vlog (kitchen vlog — most mentions SKIPPED) ---
TITLE: "My Kitchen Makeover! | New Appliances Haul"
CHANNEL: "HomeDiaries"
TRANSCRIPT EXCERPT: "So I got this Prestige pressure cooker from Amazon, works fine. Also ordered a Butterfly gas stove — hasn't arrived yet. The Philips mixer was already there, nothing new. Oh and I bought curtains from Meesho for ₹300."
CORRECT OUTPUT:
{
  "video_format": "haul_or_vlog",
  "brand_notes": [
    { "brand_name": "Prestige", "why_it_matters": "Genuine purchase with opinion stated — 'works fine'", "confidence": 0.85, "context_quotes": ["I got this Prestige pressure cooker from Amazon, works fine"] },
    { "brand_name": "Butterfly", "why_it_matters": "New purchase — creator is waiting for it, signals intent", "confidence": 0.70, "context_quotes": ["Also ordered a Butterfly gas stove — hasn't arrived yet"] }
  ]
}
NOTE: Philips is excluded — creator explicitly said "nothing new", just existing item. Meesho is excluded — retail platform, not a brand. Amazon is excluded — retail platform.

═══ OUTPUT ═══
Return ONLY this JSON. No preamble, no markdown fences, no explanation:

{
  "video_format": "single_review" | "comparison" | "roundup" | "haul_or_vlog" | "tutorial_or_howto" | "other",
  "brand_notes": [
    {
      "brand_name": string,
      "why_it_matters": string,
      "confidence": number,
      "context_quotes": string[]
    }
  ]
}`
}

export async function analyzeBrandsFromTranscript(
  transcript: string,
  videoTitle: string,
  knownBrands: string[] = [],
  channelName: string = '',
  description: string = '',
  pinnedComment: string | null = null
): Promise<BrandDetection[]> {
  const truncatedTranscript = transcript.slice(0, 15000)
  const truncatedDesc = description.slice(0, 3000)

  const prompt = buildBrandDetectionPrompt(
    truncatedTranscript,
    videoTitle,
    channelName,
    truncatedDesc,
    pinnedComment,
    knownBrands
  )

  try {
    const completion = await openai.chat.completions.create({
      model: 'google/gemma-4-26b-a4b-it:free',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 2000,
    })

    const text = completion.choices[0]?.message?.content?.trim() || ''

    // Extract JSON object from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return []

    const result: BrandAnalysisResult = JSON.parse(jsonMatch[0])

    // Filter out retail platforms and generic terms
    const filteredNotes = (result.brand_notes || []).filter(note => {
      const nameLower = note.brand_name.toLowerCase().trim()

      // Exclude retail platforms
      if (RETAIL_PLATFORMS.some(p => nameLower.includes(p) || p.includes(nameLower))) {
        return false
      }

      // Exclude empty or very short brand names
      if (nameLower.length < 2) return false

      return true
    })

    // Convert to legacy BrandDetection format for DB storage
    return filteredNotes
      .filter(note => note.brand_name && typeof note.confidence === 'number')
      .map(note => {
        // Map video_format + why_it_matters to mention_type
        let mentionType: BrandDetection['mention_type'] = 'mentioned'
        if (result.video_format === 'single_review') mentionType = 'primary_review'
        else if (result.video_format === 'comparison') mentionType = 'comparison'
        else if (note.why_it_matters.toLowerCase().includes('recommend')) mentionType = 'recommendation'

        return {
          brand_name: note.brand_name,
          confidence: Math.max(0, Math.min(1, note.confidence)),
          mention_type: mentionType,
          context_quotes: (note.context_quotes || []).slice(0, 3),
          // Store the analyst reasoning alongside
          why_it_matters: note.why_it_matters,
        }
      })
      .sort((a, b) => b.confidence - a.confidence)
  } catch (err) {
    console.error('Brand analysis failed:', err)
    return []
  }
}

export async function analyzeVideoBatch(
  videos: { videoId: string; transcript: string; title: string; channelName?: string; description?: string }[],
  knownBrands: string[] = []
): Promise<Map<string, BrandDetection[]>> {
  const results = new Map<string, BrandDetection[]>()

  for (const video of videos) {
    const detections = await analyzeBrandsFromTranscript(
      video.transcript,
      video.title,
      knownBrands,
      video.channelName || '',
      video.description || ''
    )
    results.set(video.videoId, detections)

    // Rate limit: free tier
    await new Promise(r => setTimeout(r, 2000))
  }

  return results
}

export async function analyzeBrandsFromMetadata(
  title: string,
  channelName: string,
  description: string,
  knownBrands: string[] = []
): Promise<BrandDetection[]> {
  // For metadata-only analysis, use the same prompt with empty transcript
  return analyzeBrandsFromTranscript(
    '',
    title,
    knownBrands,
    channelName,
    description,
    null
  )
}
