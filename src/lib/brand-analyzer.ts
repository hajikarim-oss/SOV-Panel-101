import OpenAI from 'openai'

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || '',
})

interface BrandDetection {
  brand_name: string
  confidence: number
  mention_type: 'primary_review' | 'comparison' | 'mentioned' | 'recommendation'
  context_quotes: string[]
}

const DETECTION_PROMPT = `You are a brand detection AI for Indian YouTube video analysis. Your task is to identify ALL brands and products mentioned in a video transcript.

RULES:
1. Detect every brand name mentioned, even briefly
2. Classify the mention type:
   - "primary_review": Video is mainly about reviewing this brand/product
   - "comparison": Brand is compared against another
   - "recommendation": Brand is recommended/suggested
   - "mentioned": Brand is mentioned in passing
3. Provide confidence score (0.0 to 1.0)
4. Extract 1-3 direct quotes where the brand is mentioned
5. Include parent company names if relevant (e.g., "Aquaguard" = "Eureka Forbes")
6. Include product model names when available (e.g., "Aquaguard Marvel")

IMPORTANT: This is for Indian market. Common Indian brands include:
- Water purifiers: Aquaguard, KENT RO, Livpure, Pureit, Blue Star, AO Smith, V-Guard
- Appliances: Atomberg, Havells, Crompton, Bajaj, Philips, Prestige, Butterfly
- Electronics: Samsung, LG, Sony, Xiaomi, Realme, OnePlus, Vivo, Oppo
- FMCG: Amul, Parle, Britannia, ITC, HUL, Dabur, Patanjali
- Auto: Maruti, Hyundai, Tata, Mahindra, Hero, Bajaj, TVS, Ola, Ather

Return ONLY valid JSON array, no markdown:
[{"brand_name":"Brand Name","confidence":0.95,"mention_type":"primary_review","context_quotes":["quote1","quote2"]}]`

export async function analyzeBrandsFromTranscript(
  transcript: string,
  videoTitle: string,
  knownBrands: string[] = []
): Promise<BrandDetection[]> {
  const brandHint = knownBrands.length > 0
    ? `\n\nKNOWN CAMPAIGN BRANDS (prioritize detecting these if present): ${knownBrands.join(', ')}`
    : ''

  const truncatedTranscript = transcript.slice(0, 15000)

  const prompt = `${DETECTION_PROMPT}${brandHint}

VIDEO TITLE: "${videoTitle}"

TRANSCRIPT:
${truncatedTranscript}

Return the JSON array of detected brands:`

  try {
    const completion = await openai.chat.completions.create({
      model: 'google/gemma-4-26b-a4b-it:free',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 2000,
    })

    const text = completion.choices[0]?.message?.content?.trim() || ''

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []

    const detections: BrandDetection[] = JSON.parse(jsonMatch[0])

    // Validate and clean
    return detections
      .filter(d => d.brand_name && typeof d.confidence === 'number')
      .map(d => ({
        ...d,
        confidence: Math.max(0, Math.min(1, d.confidence)),
        context_quotes: (d.context_quotes || []).slice(0, 3),
      }))
      .sort((a, b) => b.confidence - a.confidence)
  } catch (err) {
    console.error('Brand analysis failed:', err)
    return []
  }
}

export async function analyzeVideoBatch(
  videos: { videoId: string; transcript: string; title: string }[],
  knownBrands: string[] = []
): Promise<Map<string, BrandDetection[]>> {
  const results = new Map<string, BrandDetection[]>()

  for (const video of videos) {
    const detections = await analyzeBrandsFromTranscript(
      video.transcript,
      video.title,
      knownBrands
    )
    results.set(video.videoId, detections)

    // Rate limit: free tier
    await new Promise(r => setTimeout(r, 2000))
  }

  return results
}

const METADATA_PROMPT = `You are a brand detection AI for Indian YouTube video analysis. Your task is to identify ALL brands and products mentioned in a video based on its title, channel name, and description.

RULES:
1. Detect every brand name mentioned in the title, channel name, or description
2. Classify the mention type:
   - "primary_review": Video is mainly about reviewing this brand/product
   - "comparison": Brand is compared against another
   - "recommendation": Brand is recommended/suggested
   - "mentioned": Brand is mentioned in passing
3. Provide confidence score (0.0 to 1.0)
4. Extract direct quotes from title/description where the brand is mentioned
5. Include parent company names if relevant

IMPORTANT: This is for Indian market. Common Indian brands include:
- Auto: Maruti, Hyundai, Tata, Mahindra, Hero, Bajaj, TVS, Ola, Ather, Ferrari
- Electronics: Samsung, LG, Sony, Xiaomi, Realme, OnePlus, Vivo, Oppo, Apple
- FMCG: Amul, Parle, Britannia, ITC, HUL, Dabur, Patanjali
- Music: T-Series, Sony Music, Universal, YRF, Saregama

Return ONLY valid JSON array, no markdown:
[{"brand_name":"Brand Name","confidence":0.95,"mention_type":"primary_review","context_quotes":["quote from title/description"]}]`

export async function analyzeBrandsFromMetadata(
  title: string,
  channelName: string,
  description: string,
  knownBrands: string[] = []
): Promise<BrandDetection[]> {
  const brandHint = knownBrands.length > 0
    ? `\n\nKNOWN CAMPAIGN BRANDS (prioritize detecting these if present): ${knownBrands.join(', ')}`
    : ''

  const truncatedDesc = description.slice(0, 3000)

  const prompt = `${METADATA_PROMPT}${brandHint}

VIDEO TITLE: "${title}"
CHANNEL NAME: "${channelName}"
DESCRIPTION: "${truncatedDesc}"

Return the JSON array of detected brands:`

  try {
    const completion = await openai.chat.completions.create({
      model: 'google/gemma-4-26b-a4b-it:free',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 1000,
    })

    const text = completion.choices[0]?.message?.content?.trim() || ''

    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []

    const detections: BrandDetection[] = JSON.parse(jsonMatch[0])

    return detections
      .filter(d => d.brand_name && typeof d.confidence === 'number')
      .map(d => ({
        ...d,
        confidence: Math.max(0, Math.min(1, d.confidence)),
        context_quotes: (d.context_quotes || []).slice(0, 3),
      }))
      .sort((a, b) => b.confidence - a.confidence)
  } catch (err) {
    console.error('Metadata brand analysis failed:', err)
    return []
  }
}
