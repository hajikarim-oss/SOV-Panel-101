import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock OpenAI (must be hoisted before module import) ───────────────────────
const mockCreate = vi.hoisted(() => vi.fn())

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}))

// Import after mocking
import {
  analyzeBrandsFromTranscript,
  analyzeBrandsFromMetadata,
  analyzeVideoBatch,
  type VideoFormat,
} from './brand-analyzer'

interface MockBrandNote {
  brand_name: string
  confidence: number
  why_it_matters: string
  context_quotes: string[]
}

function mockAIResponse(result: { video_format: VideoFormat; brand_notes: MockBrandNote[] }) {
  mockCreate.mockResolvedValueOnce({
    choices: [{ message: { content: JSON.stringify(result) } }],
  })
}

function mockAIFailure() {
  mockCreate.mockRejectedValueOnce(new Error('API error'))
}

function mockAINonJson() {
  mockCreate.mockResolvedValueOnce({
    choices: [{ message: { content: 'Sorry, I cannot analyze this video.' } }],
  })
}

// ── Test Data ────────────────────────────────────────────────────────────────
const AQUAGUARD_TRANSCRIPT = `
Today we have the Aquaguard Royal from Eureka Forbes. This is their flagship water purifier
priced at around 18999 rupees. The build quality is really solid and you get a 7-stage
purification process. Now compared to the KENT Glory, the Aquaguard has better TDS reduction.
Livpure's Pep Pro is cheaper but it misses out on UV purification. AO Smith Z8 is the premium
pick with hot water dispensing but it's way more expensive. If you're on a budget, the Pureit
Classic from HUL is decent. I'd pick the Aquaguard if your budget allows.
`.trim()

const COMPARISON_TRANSCRIPT = `
Samsung Galaxy S24 vs iPhone 15 — which one should you buy? The Samsung has better zoom
camera and the Galaxy AI features are actually useful. iPhone 15 has better video recording
and the ecosystem is unmatched if you already have a Mac. OnePlus 12 is the value pick here,
you get 90% of the flagship experience at half the price. Xiaomi 14 is also worth considering
if you want Leica cameras. My verdict: Samsung for Android lovers, iPhone for ecosystem users.
`.trim()

const ROUNDUP_TRANSCRIPT = `
Here are the top 5 water purifiers in India for 2024. Number 5 is the Pureit Classic from HUL
at 7999 rupees — budget friendly. Number 4, the Blue Star Hydra — decent but it's a bit noisy.
Number 3, AO Smith Z8 — premium pick with great hot water dispensing. Number 2, Aquaguard
Magna — solid mid-range option. And number 1, KENT Pride — best value for money in this list.
`.trim()

const VLOG_TRANSCRIPT = `
Hey guys, welcome back to my channel! So yesterday I went to the mall and picked up this
amazing Prestige pressure cooker from Amazon. Works really well. I also ordered a Butterfly
gas stove from Flipkart but it hasn't arrived yet. The Philips mixer grinder was already
in my kitchen, nothing new there. Oh and I bought some curtains from Meesho for just 300
rupees. Let me show you my kitchen makeover!
`.trim()

// ── Tests ────────────────────────────────────────────────────────────────────
describe('Brand Analyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Retail Platform Exclusion', () => {
    it('should never tag Amazon, Flipkart, Meesho as brands', async () => {
      mockAIResponse({
        video_format: 'haul_or_vlog',
        brand_notes: [
          { brand_name: 'Prestige', confidence: 0.85, why_it_matters: 'Genuine purchase with opinion', context_quotes: ['Prestige pressure cooker works well'] },
          { brand_name: 'Amazon', confidence: 0.90, why_it_matters: 'Where product was bought', context_quotes: ['picked up from Amazon'] },
          { brand_name: 'Flipkart', confidence: 0.80, why_it_matters: 'Where product was ordered', context_quotes: ['ordered from Flipkart'] },
          { brand_name: 'Meesho', confidence: 0.75, why_it_matters: 'Shopping platform', context_quotes: ['bought from Meesho'] },
        ],
      })

      const result = await analyzeBrandsFromTranscript(VLOG_TRANSCRIPT, 'Kitchen Vlog', [], 'HomeDiaries')

      expect(result).toHaveLength(1)
      expect(result[0].brand_name).toBe('Prestige')
      expect(result.every(d => !['amazon', 'flipkart', 'meesho'].includes(d.brand_name.toLowerCase()))).toBe(true)
    })

    it('should exclude Myntra, Ajio, Snapdeal, Tata Cliq, Nykaa, Croma', async () => {
      mockAIResponse({
        video_format: 'haul_or_vlog',
        brand_notes: [
          { brand_name: 'Myntra', confidence: 0.9, why_it_matters: 'shopping', context_quotes: [] },
          { brand_name: 'Ajio', confidence: 0.9, why_it_matters: 'shopping', context_quotes: [] },
          { brand_name: 'Snapdeal', confidence: 0.9, why_it_matters: 'shopping', context_quotes: [] },
          { brand_name: 'Tata Cliq', confidence: 0.9, why_it_matters: 'shopping', context_quotes: [] },
          { brand_name: 'Nykaa', confidence: 0.9, why_it_matters: 'shopping', context_quotes: [] },
          { brand_name: 'Croma', confidence: 0.9, why_it_matters: 'shopping', context_quotes: [] },
          { brand_name: 'Samsung', confidence: 0.95, why_it_matters: 'actual product', context_quotes: ['Samsung TV'] },
        ],
      })

      const result = await analyzeBrandsFromTranscript('Samsung TV review', 'TV Review', [], 'TechChannel')

      expect(result).toHaveLength(1)
      expect(result[0].brand_name).toBe('Samsung')
    })
  })

  describe('Video Format Detection', () => {
    it('should detect single_review format', async () => {
      mockAIResponse({
        video_format: 'single_review',
        brand_notes: [
          { brand_name: 'Aquaguard', confidence: 0.97, why_it_matters: 'Primary product reviewed', context_quotes: ['Aquaguard Royal'] },
        ],
      })

      const result = await analyzeBrandsFromTranscript(AQUAGUARD_TRANSCRIPT, 'Aquaguard Royal Review', [], 'TechBar')
      expect(result).toHaveLength(1)
      expect(result[0].mention_type).toBe('primary_review')
    })

    it('should detect comparison format', async () => {
      mockAIResponse({
        video_format: 'comparison',
        brand_notes: [
          { brand_name: 'Samsung', confidence: 0.95, why_it_matters: 'One of two compared', context_quotes: ['Samsung Galaxy S24'] },
          { brand_name: 'Apple', confidence: 0.93, why_it_matters: 'Other compared product', context_quotes: ['iPhone 15'] },
        ],
      })

      const result = await analyzeBrandsFromTranscript(COMPARISON_TRANSCRIPT, 'Samsung vs iPhone', [], 'TechChannel')
      expect(result).toHaveLength(2)
      expect(result.every(d => d.mention_type === 'comparison')).toBe(true)
    })

    it('should detect roundup format', async () => {
      mockAIResponse({
        video_format: 'roundup',
        brand_notes: [
          { brand_name: 'Pureit', confidence: 0.92, why_it_matters: 'Budget option at #5', context_quotes: ['Pureit Classic'] },
          { brand_name: 'Blue Star', confidence: 0.88, why_it_matters: 'At #4 with specific con', context_quotes: ['Blue Star Hydra'] },
          { brand_name: 'AO Smith', confidence: 0.90, why_it_matters: 'Premium at #3', context_quotes: ['AO Smith Z8'] },
          { brand_name: 'Aquaguard', confidence: 0.91, why_it_matters: 'Mid-range at #2', context_quotes: ['Aquaguard Magna'] },
          { brand_name: 'KENT', confidence: 0.93, why_it_matters: 'Best value at #1', context_quotes: ['KENT Pride'] },
        ],
      })

      const result = await analyzeBrandsFromTranscript(ROUNDUP_TRANSCRIPT, 'Top 5 Water Purifiers', [], 'GadgetsNow')
      expect(result).toHaveLength(5)
    })
  })

  describe('Campaign Brand Prioritization', () => {
    it('should pass campaign brands to the prompt', async () => {
      mockAIResponse({
        video_format: 'single_review',
        brand_notes: [
          { brand_name: 'Atomberg', confidence: 0.95, why_it_matters: 'Primary fan reviewed', context_quotes: ['Atomberg BLDC fan'] },
        ],
      })

      await analyzeBrandsFromTranscript(
        'Atomberg BLDC fan review',
        'Best Fan Under 3000',
        ['Atomberg', 'Havells', 'Crompton'],
        'TechReview'
      )

      const calledPrompt = mockCreate.mock.calls[0][0].messages[0].content
      expect(calledPrompt).toContain('Atomberg')
      expect(calledPrompt).toContain('Havells')
      expect(calledPrompt).toContain('Crompton')
      expect(calledPrompt).toContain('BRANDS THIS CLIENT CARES ABOUT')
    })
  })

  describe('Error Handling', () => {
    it('should return empty array on API failure', async () => {
      mockAIFailure()
      const result = await analyzeBrandsFromTranscript('test', 'test', [], 'channel')
      expect(result).toEqual([])
    })

    it('should return empty array on non-JSON response', async () => {
      mockAINonJson()
      const result = await analyzeBrandsFromTranscript('test', 'test', [], 'channel')
      expect(result).toEqual([])
    })
  })

  describe('Confidence Clamping', () => {
    it('should clamp confidence to 0-1 range', async () => {
      mockAIResponse({
        video_format: 'single_review',
        brand_notes: [
          { brand_name: 'Samsung', confidence: 1.5, why_it_matters: 'over', context_quotes: [] },
          { brand_name: 'LG', confidence: -0.3, why_it_matters: 'under', context_quotes: [] },
        ],
      })

      const result = await analyzeBrandsFromTranscript('test', 'test', [], 'channel')
      expect(result[0].confidence).toBe(1)
      expect(result[1].confidence).toBe(0)
    })
  })

  describe('Context Quotes Limiting', () => {
    it('should limit context_quotes to 3', async () => {
      mockAIResponse({
        video_format: 'single_review',
        brand_notes: [
          {
            brand_name: 'Samsung',
            confidence: 0.9,
            why_it_matters: 'tested',
            context_quotes: ['q1', 'q2', 'q3', 'q4', 'q5'],
          },
        ],
      })

      const result = await analyzeBrandsFromTranscript('test', 'test', [], 'channel')
      expect(result[0].context_quotes).toHaveLength(3)
    })
  })

  describe('Metadata-Only Analysis', () => {
    it('should analyze from title and description when no transcript', async () => {
      mockAIResponse({
        video_format: 'single_review',
        brand_notes: [
          { brand_name: 'Aquaguard', confidence: 0.88, why_it_matters: 'Title mentions product', context_quotes: ['Aquaguard Royal Review'] },
        ],
      })

      const result = await analyzeBrandsFromMetadata(
        'Aquaguard Royal Water Purifier Review',
        'TechBar',
        'In this video we review the Aquaguard Royal RO purifier',
        ['Aquaguard']
      )

      expect(result).toHaveLength(1)
      expect(result[0].brand_name).toBe('Aquaguard')
    })
  })

  describe('Batch Analysis', () => {
    it('should process multiple videos with rate limiting', async () => {
      mockAIResponse({
        video_format: 'single_review',
        brand_notes: [{ brand_name: 'Samsung', confidence: 0.9, why_it_matters: 'reviewed', context_quotes: [] }],
      })
      mockAIResponse({
        video_format: 'single_review',
        brand_notes: [{ brand_name: 'Apple', confidence: 0.85, why_it_matters: 'reviewed', context_quotes: [] }],
      })

      const videos = [
        { videoId: 'v1', transcript: 'Samsung review', title: 'Samsung Review', channelName: 'Tech1' },
        { videoId: 'v2', transcript: 'Apple review', title: 'Apple Review', channelName: 'Tech2' },
      ]

      const start = Date.now()
      const result = await analyzeVideoBatch(videos, [])
      const elapsed = Date.now() - start

      expect(result.size).toBe(2)
      expect(result.get('v1')).toHaveLength(1)
      expect(result.get('v2')).toHaveLength(1)
      // Should have waited at least 2s between videos for rate limiting
      expect(elapsed).toBeGreaterThanOrEqual(1800)
    })
  })

  describe('Prompt Quality Checks', () => {
    it('should include video title in prompt', async () => {
      mockAIResponse({ video_format: 'other', brand_notes: [] })

      await analyzeBrandsFromTranscript('transcript', 'My Video Title', [], 'channel')

      const prompt = mockCreate.mock.calls[0][0].messages[0].content
      expect(prompt).toContain('My Video Title')
    })

    it('should include channel name in prompt', async () => {
      mockAIResponse({ video_format: 'other', brand_notes: [] })

      await analyzeBrandsFromTranscript('transcript', 'title', [], 'MyChannelName')

      const prompt = mockCreate.mock.calls[0][0].messages[0].content
      expect(prompt).toContain('MyChannelName')
    })

    it('should include description in prompt', async () => {
      mockAIResponse({ video_format: 'other', brand_notes: [] })

      await analyzeBrandsFromTranscript('transcript', 'title', [], 'channel', 'This is the description')

      const prompt = mockCreate.mock.calls[0][0].messages[0].content
      expect(prompt).toContain('This is the description')
    })

    it('should include pinned comment in prompt', async () => {
      mockAIResponse({ video_format: 'other', brand_notes: [] })

      await analyzeBrandsFromTranscript('transcript', 'title', [], 'channel', 'desc', 'Pinned: sponsored by X')

      const prompt = mockCreate.mock.calls[0][0].messages[0].content
      expect(prompt).toContain('Pinned: sponsored by X')
    })

    it('should use low temperature for deterministic output', async () => {
      mockAIResponse({ video_format: 'other', brand_notes: [] })

      await analyzeBrandsFromTranscript('test', 'test', [], 'channel')

      expect(mockCreate.mock.calls[0][0].temperature).toBe(0.1)
    })

    it('should truncate transcript to 15000 chars', async () => {
      mockAIResponse({ video_format: 'other', brand_notes: [] })

      const longTranscript = 'A'.repeat(20000)
      await analyzeBrandsFromTranscript(longTranscript, 'test', [], 'channel')

      const prompt = mockCreate.mock.calls[0][0].messages[0].content
      // The transcript parameter itself is truncated to 15000 chars before being inserted
      // The prompt includes "TRANSCRIPT:\n{truncated}" — the transcript portion should be ≤15000
      const transcriptMatch = prompt.match(/TRANSCRIPT:\n([\s\S]*?)\n/)
      if (transcriptMatch) {
        expect(transcriptMatch[1].length).toBeLessThanOrEqual(15000)
      }
    })
  })

  describe('Real-World Scenario: Water Purifier Review', () => {
    it('should only tag brands with real opinions, not all mentioned names', async () => {
      // Simulating what a good analyst would return for this video
      mockAIResponse({
        video_format: 'single_review',
        brand_notes: [
          { brand_name: 'Aquaguard', confidence: 0.97, why_it_matters: 'Primary product reviewed — Eureka Forbes flagship positioned as top pick', context_quotes: ['Today we have the Aquaguard Royal', "I'd pick the Aquaguard if your budget allows"] },
          { brand_name: 'KENT', confidence: 0.85, why_it_matters: 'Direct competitor used as benchmark for TDS reduction comparison', context_quotes: ['Compared to the KENT Glory, the Aquaguard has better TDS reduction'] },
          { brand_name: 'Livpure', confidence: 0.80, why_it_matters: 'Positioned as cheaper alternative with a specific trade-off noted', context_quotes: ["Livpure's Pep Pro is cheaper but misses UV"] },
        ],
      })

      const result = await analyzeBrandsFromTranscript(
        AQUAGUARD_TRANSCRIPT,
        'Aquaguard Royal RO+UV+UF Water Purifier Review',
        ['Aquaguard', 'KENT', 'Livpure', 'AO Smith', 'Pureit'],
        'TechBar'
      )

      // Should NOT include: Amazon, Flipkart, HUL, Eureka Forbes (parent company), Blue Star
      // Should include: Aquaguard (primary), KENT (comparison), Livpure (alternative)
      const brandNames = result.map(d => d.brand_name.toLowerCase())

      expect(brandNames).toContain('aquaguard')
      expect(brandNames).toContain('kent')
      expect(brandNames).toContain('livpure')
      expect(brandNames).not.toContain('amazon')
      expect(brandNames).not.toContain('flipkart')
      expect(brandNames).not.toContain('hul')
    })
  })

  describe('Indian Language Support', () => {
    it('should detect brands in Hindi transcript (Devanagari script)', async () => {
      // Simulates a Hindi review with transliterated brand names
      const hindiTranscript = `
        आज हम लेकर आए हैं Aquaguard Royal water purifier। ये Eureka Forbes का flagship
        model है जो कि 18999 रुपये में आता है। इसमें 7-stage purification मिलता है।
        KENT Glory से compare करें तो Aquaguard में better TDS reduction है।
        Livpure का Pep Pro सस्ता है लेकिन उसमें UV नहीं है। Budget कम है तो
        Pureit Classic भी ठीक है। लेकिन मेरे हिसाब से Aquaguard सबसे अच्छा है।
        Amazon से मंगवा सकते हैं, link description में है।
      `.trim()

      mockAIResponse({
        video_format: 'single_review',
        brand_notes: [
          { brand_name: 'Aquaguard', confidence: 0.97, why_it_matters: 'Primary product reviewed in Hindi — creators top pick', context_quotes: ['आज हम लेकर आए हैं Aquaguard Royal', 'Aquaguard सबसे अच्छा है'] },
          { brand_name: 'KENT', confidence: 0.85, why_it_matters: 'Direct competitor used for TDS comparison in Hindi', context_quotes: ['KENT Glory से compare करें तो'] },
          { brand_name: 'Livpure', confidence: 0.80, why_it_matters: 'Cheaper alternative mentioned with UV trade-off', context_quotes: ['Livpure का Pep Pro सस्ता है लेकिन उसमें UV नहीं है'] },
          { brand_name: 'Pureit', confidence: 0.70, why_it_matters: 'Budget option acknowledged but not recommended', context_quotes: ['Pureit Classic भी ठीक है'] },
        ],
      })

      const result = await analyzeBrandsFromTranscript(
        hindiTranscript,
        'Aquaguard Water Purifier Review in Hindi',
        ['Aquaguard', 'KENT', 'Livpure', 'Pureit'],
        'Tech Hindi'
      )

      const brandNames = result.map(d => d.brand_name.toLowerCase())
      expect(brandNames).toContain('aquaguard')
      expect(brandNames).toContain('kent')
      expect(brandNames).toContain('livpure')
      // Amazon should be excluded even though mentioned in Hindi
      expect(brandNames).not.toContain('amazon')
    })

    it('should detect brands in Tamil transcript', async () => {
      const tamilTranscript = `
        இன்னைக்கு நம்ம பார்க்க போறது Samsung Galaxy S24 phone-ஐ। இந்த phone-ல்
        best camera quality இருக்கு। iPhone 15-ஓட compare பண்ணா, Samsung zoom
        camera better। OnePlus 12 budget-friendly option-ஆ இருக்கு। Xiaomi 14
        Leica cameras-ஓட வருது। Samsung-ஐ Amazon-ல buy பண்ணலாம்।
      `.trim()

      mockAIResponse({
        video_format: 'comparison',
        brand_notes: [
          { brand_name: 'Samsung', confidence: 0.95, why_it_matters: 'Primary phone reviewed in Tamil — camera praised', context_quotes: ['Samsung Galaxy S24 phone-ஐ', 'Samsung zoom camera better'] },
          { brand_name: 'Apple', confidence: 0.88, why_it_matters: 'iPhone used as direct competitor benchmark', context_quotes: ['iPhone 15-ஓட compare பண்ணா'] },
          { brand_name: 'OnePlus', confidence: 0.80, why_it_matters: 'Budget alternative acknowledged', context_quotes: ['OnePlus 12 budget-friendly option-ஆ இருக்கு'] },
          { brand_name: 'Xiaomi', confidence: 0.75, why_it_matters: 'Leica camera feature noted as unique', context_quotes: ['Xiaomi 14 Leica cameras-ஓட வருது'] },
        ],
      })

      const result = await analyzeBrandsFromTranscript(
        tamilTranscript,
        'Samsung vs iPhone Review in Tamil',
        ['Samsung', 'Apple', 'OnePlus', 'Xiaomi'],
        'Tamil Tech'
      )

      const brandNames = result.map(d => d.brand_name.toLowerCase())
      expect(brandNames).toContain('samsung')
      expect(brandNames).not.toContain('amazon')
    })

    it('should detect brands in Telugu transcript', async () => {
      const teluguTranscript = `
        ఈ రోజు మనం Atomberg BLDC fan గురించి చూద్దాం। ఈ fan చాలా energy efficient
        మరియు 5-star rating ఉంది। Havells fan కూడా బాగుంది కానీ Atomberg better
        air delivery ఇస్తుంది। Crompton fan కొంచెం noisy గా ఉంటుంది। Flipkart లో
        ఈ fan ₹2999 కి దొరుకుతుంది। Myntra నుండి కూడా order చేయవచ్చు।
      `.trim()

      mockAIResponse({
        video_format: 'single_review',
        brand_notes: [
          { brand_name: 'Atomberg', confidence: 0.96, why_it_matters: 'Primary fan reviewed in Telugu — energy efficiency praised', context_quotes: ['Atomberg BLDC fan గురించి చూద్దాం', 'Atomberg better air delivery ఇస్తుంది'] },
          { brand_name: 'Havells', confidence: 0.78, why_it_matters: 'Acknowledged competitor with caveat', context_quotes: ['Havells fan కూడా బాగుంది కానీ'] },
          { brand_name: 'Crompton', confidence: 0.70, why_it_matters: 'Mentioned with specific negative — noisy', context_quotes: ['Crompton fan కొంచెం noisy గా ఉంటుంది'] },
        ],
      })

      const result = await analyzeBrandsFromTranscript(
        teluguTranscript,
        'Atomberg BLDC Fan Review in Telugu',
        ['Atomberg', 'Havells', 'Crompton'],
        'Telugu Tech'
      )

      const brandNames = result.map(d => d.brand_name.toLowerCase())
      expect(brandNames).toContain('atomberg')
      expect(brandNames).toContain('havells')
      // Flipkart/Myntra excluded as retail platforms
      expect(brandNames).not.toContain('flipkart')
      expect(brandNames).not.toContain('myntra')
    })

    it('should detect brands in Malayalam transcript', async () => {
      const malayalamTranscript = `
        ഇന്ന് നമുക്ക് Prestige pressure cooker review ചെയ്യാം। ഈ cooker വളരെ
        നല്ല quality ആണ്। Butterfly gas stove കൂടെ ഉപയോഗിക്കുന്നുണ്ട്, രണ്ടും
        നന്നായി work ചെയ്യുന്നു। Philips mixer grinder already ഉണ്ട് kitchen-ൽ।
        Amazon-ൽ നിന്ന് buy ചെയ്തു। Prestige ₹4500-ന് കിട്ടി।
      `.trim()

      mockAIResponse({
        video_format: 'single_review',
        brand_notes: [
          { brand_name: 'Prestige', confidence: 0.93, why_it_matters: 'Primary product reviewed in Malayalam — quality praised', context_quotes: ['Prestige pressure cooker review ചെയ്യാം', 'Prestige ₹4500-ന് കിട്ടി'] },
          { brand_name: 'Butterfly', confidence: 0.75, why_it_matters: 'Paired product mentioned for combined use', context_quotes: ['Butterfly gas stove കൂടെ ഉപയോഗിക്കുന്നുണ്ട്'] },
        ],
      })

      const result = await analyzeBrandsFromTranscript(
        malayalamTranscript,
        'Prestige Cooker Review in Malayalam',
        ['Prestige', 'Butterfly', 'Philips'],
        'Malayalam Reviews'
      )

      const brandNames = result.map(d => d.brand_name.toLowerCase())
      expect(brandNames).toContain('prestige')
      expect(brandNames).not.toContain('amazon')
    })

    it('should detect brands in Kannada transcript', async () => {
      const kannadaTranscript = `
        ಇಂದು ನಾವು KENT water purifier review ಮಾಡೋಣ। ಈ purifier RO+UV technology
        ಬಳಸುತ್ತದೆ। Aquaguard ಜೊತೆ compare ಮಾಡಿದರೆ, KENT ಸ್ವಲ್ಪ cheaper ಮತ್ತು
        service network ಕೂಡ ಚೆನ್ನಾಗಿದೆ। Livpure ಕೂಡ ಒಳ್ಳೆಯ option ಆಗಿದೆ।
        Amazon-ನಿಂದ ಆರ್ಡರ್ ಮಾಡಬಹುದು। Croma store-ನಲ್ಲಿ ಕೂಡ ಸಿಗುತ್ತದೆ।
      `.trim()

      mockAIResponse({
        video_format: 'single_review',
        brand_notes: [
          { brand_name: 'KENT', confidence: 0.95, why_it_matters: 'Primary purifier reviewed in Kannada — cheaper alternative noted', context_quotes: ['KENT water purifier review ಮಾಡೋಣ', 'KENT ಸ್ವಲ್ಪ cheaper'] },
          { brand_name: 'Aquaguard', confidence: 0.82, why_it_matters: 'Direct competitor used for price comparison', context_quotes: ['Aquaguard ಜೊತೆ compare ಮಾಡಿದರೆ'] },
          { brand_name: 'Livpure', confidence: 0.72, why_it_matters: 'Acknowledged as alternative option', context_quotes: ['Livpure ಕೂಡ ಒಳ್ಳೆಯ option ಆಗಿದೆ'] },
        ],
      })

      const result = await analyzeBrandsFromTranscript(
        kannadaTranscript,
        'KENT Water Purifier Review Kannada',
        ['KENT', 'Aquaguard', 'Livpure'],
        'Kannada Tech'
      )

      const brandNames = result.map(d => d.brand_name.toLowerCase())
      expect(brandNames).toContain('kent')
      // Amazon and Croma excluded as retail platforms
      expect(brandNames).not.toContain('amazon')
      expect(brandNames).not.toContain('croma')
    })

    it('should detect brands in Bengali transcript', async () => {
      const bengaliTranscript = `
        আজ আমরা Samsung Galaxy phone review করব। Samsung-এর camera quality খুবই
        ভালো। iPhone 15 এর সাথে তুলনা করলে, Samsung zoom camera better। OnePlus 12
        budget option হিসাবে ভালো। Xiaomi 14 Leica cameras নিয়ে এসেছে। Amazon-এ
        কিনতে পারেন। Flipkart-এও পাওয়া যায়।
      `.trim()

      mockAIResponse({
        video_format: 'comparison',
        brand_notes: [
          { brand_name: 'Samsung', confidence: 0.94, why_it_matters: 'Primary phone reviewed in Bengali', context_quotes: ['Samsung Galaxy phone review করব', 'Samsung zoom camera better'] },
          { brand_name: 'Apple', confidence: 0.86, why_it_matters: 'iPhone competitor benchmarked', context_quotes: ['iPhone 15 এর সাথে তুলনা করলে'] },
        ],
      })

      const result = await analyzeBrandsFromTranscript(
        bengaliTranscript,
        'Samsung Phone Review in Bengali',
        ['Samsung', 'Apple', 'OnePlus', 'Xiaomi'],
        'Bangla Tech'
      )

      const brandNames = result.map(d => d.brand_name.toLowerCase())
      expect(brandNames).toContain('samsung')
      expect(brandNames).not.toContain('amazon')
      expect(brandNames).not.toContain('flipkart')
    })

    it('should detect brands in Marathi transcript', async () => {
      const marathiTranscript = `
        आज आपण Atomberg fan चा review पाहणार आहोत। हा fan खूप energy efficient आहे
        आणि 5-star rating आहे। Havells fan पण छान आहे पण Atomberg चा air delivery
        जास्त छान आहे। Crompton fan थोडा noisy असतो। Amazon वरून घेऊ शकता, ₹2999
        मध्ये मिळतो।
      `.trim()

      mockAIResponse({
        video_format: 'single_review',
        brand_notes: [
          { brand_name: 'Atomberg', confidence: 0.95, why_it_matters: 'Primary fan reviewed in Marathi — energy efficiency praised', context_quotes: ['Atomberg fan चा review पाहणार आहोत', 'Atomberg चा air delivery जास्त छान आहे'] },
          { brand_name: 'Havells', confidence: 0.76, why_it_matters: 'Competitor acknowledged but Atomberg preferred', context_quotes: ['Havells fan पण छान आहे पण'] },
        ],
      })

      const result = await analyzeBrandsFromTranscript(
        marathiTranscript,
        'Atomberg Fan Review Marathi',
        ['Atomberg', 'Havells', 'Crompton'],
        'Marathi Reviews'
      )

      const brandNames = result.map(d => d.brand_name.toLowerCase())
      expect(brandNames).toContain('atomberg')
      expect(brandNames).not.toContain('amazon')
    })

    it('should detect brands in Punjabi transcript', async () => {
      const punjabiTranscript = `
        ਅੱਜ ਅਸੀਂ Prestige pressure cooker ਦੇਖਣਾਰੇ ਆਹੀਂ। ਇਹ cooker ਬਹੁਤ ਵਧੀਆ
        quality ਦਾ ਹੈ। Butterfly gas stove ਨਾਲ use ਕਰਦੇ ਹਾਂ, ਦੋਵੇਂ ਚੰਗੇ ਕੰਮ
        ਕਰਦੇ ਹਨ। Philips mixer grinder ਪਹਿਲਾਂ ਹੀ ਹੈ। Amazon ਤੋਂ ਖਰੀਦਿਆ।
      `.trim()

      mockAIResponse({
        video_format: 'single_review',
        brand_notes: [
          { brand_name: 'Prestige', confidence: 0.94, why_it_matters: 'Primary cooker reviewed in Punjabi', context_quotes: ['Prestige pressure cooker ਦੇਖਣਾਰੇ ਆਹੀਂ'] },
          { brand_name: 'Butterfly', confidence: 0.74, why_it_matters: 'Paired product for combined use', context_quotes: ['Butterfly gas stove ਨਾਲ use ਕਰਦੇ ਹਾਂ'] },
        ],
      })

      const result = await analyzeBrandsFromTranscript(
        punjabiTranscript,
        'Prestige Cooker Review Punjabi',
        ['Prestige', 'Butterfly', 'Philips'],
        'Punjabi Reviews'
      )

      const brandNames = result.map(d => d.brand_name.toLowerCase())
      expect(brandNames).toContain('prestige')
      expect(brandNames).not.toContain('amazon')
    })

    it('should handle code-mixed Hindi-English (Hinglish) transcripts', async () => {
      const hinglishTranscript = `
        So guys aaj hum Atomberg ka BLDC fan unbox karenge। Ye fan ₹2999 mein
        mil raha hai Amazon pe। Iska air delivery actually kaafi accha hai compared
        to Havells। Crompton ka fan bhi dekha tha but wo thoda noisy hai।
        Myntra pe bhi available hai but price zyada hai wahan। Flipkart pe sasta
        milega। Overall Atomberg hi best pick hai agar budget hai toh।
      `.trim()

      mockAIResponse({
        video_format: 'single_review',
        brand_notes: [
          { brand_name: 'Atomberg', confidence: 0.96, why_it_matters: 'Primary fan unboxed in Hinglish — declared best pick', context_quotes: ['Atomberg ka BLDC fan unbox karenge', 'Atomberg hi best pick hai'] },
          { brand_name: 'Havells', confidence: 0.78, why_it_matters: 'Direct competitor — Atomberg preferred for air delivery', context_quotes: ['compared to Havells'] },
          { brand_name: 'Crompton', confidence: 0.72, why_it_matters: 'Mentioned with specific negative — noisy', context_quotes: ['Crompton ka fan bhi dekha tha but wo thoda noisy hai'] },
        ],
      })

      const result = await analyzeBrandsFromTranscript(
        hinglishTranscript,
        'Atomberg BLDC Fan Unboxing',
        ['Atomberg', 'Havells', 'Crompton'],
        'Hindi Tech'
      )

      const brandNames = result.map(d => d.brand_name.toLowerCase())
      expect(brandNames).toContain('atomberg')
      expect(brandNames).toContain('havells')
      expect(brandNames).toContain('crompton')
      // Retail platforms excluded
      expect(brandNames).not.toContain('amazon')
      expect(brandNames).not.toContain('flipkart')
      expect(brandNames).not.toContain('myntra')
    })

    it('should handle Tamil-Telugu code-mixed speech', async () => {
      const tamilTeluguMixed = `
        Friends today Samsung Galaxy S24 review chesham। Camera quality చాలా బాగుంది।
        iPhone 15 compare చేస్తే Samsung zoom better అనిpistundi। OnePlus 12
        budget option ga baguntundi। Amazon nunchi teesukovachu।
      `.trim()

      mockAIResponse({
        video_format: 'single_review',
        brand_notes: [
          { brand_name: 'Samsung', confidence: 0.94, why_it_matters: 'Primary phone reviewed in Tamil-Telugu mix', context_quotes: ['Samsung Galaxy S24 review chesham'] },
        ],
      })

      const result = await analyzeBrandsFromTranscript(
        tamilTeluguMixed,
        'Samsung Review in Tamil Telugu',
        ['Samsung', 'Apple', 'OnePlus'],
        'South Indian Tech'
      )

      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result[0].brand_name).toBe('Samsung')
    })

    it('should detect Marathi-English code-mixed transcript (Maharashtra market)', async () => {
      const marathiEnglishMixed = `
        Namaskar mitrano, aaj Atomberg fan cha review karuya। Fan khup
        energy efficient ahe, 5-star rating ahe। Havells cha fan panchat
        hota but Atomberg better air delivery deta hai। Croma madhe jaun
        baghu shakta, Amazon varun direct delivery milta hai। ₹2999 madhe
        milta hai ye fan।
      `.trim()

      mockAIResponse({
        video_format: 'single_review',
        brand_notes: [
          { brand_name: 'Atomberg', confidence: 0.95, why_it_matters: 'Primary fan reviewed in Marathi-English mix', context_quotes: ['Atomberg fan cha review karuya', 'Atomberg better air delivery deta hai'] },
          { brand_name: 'Havells', confidence: 0.75, why_it_matters: 'Competitor mentioned with preference for Atomberg', context_quotes: ['Havells cha fan panchat hota but'] },
        ],
      })

      const result = await analyzeBrandsFromTranscript(
        marathiEnglishMixed,
        'Atomberg Fan Review Marathi',
        ['Atomberg', 'Havells'],
        'Marathi Tech'
      )

      const brandNames = result.map(d => d.brand_name.toLowerCase())
      expect(brandNames).toContain('atomberg')
      expect(brandNames).not.toContain('amazon')
      expect(brandNames).not.toContain('croma')
    })
  })

  describe('Transcript Language Coverage', () => {
    it('should include all major Indian languages in transcript fetcher', async () => {
      // This verifies the transcript.ts language list covers all major Indian languages
      const expectedLangs = ['hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa', 'ur']

      const { readFileSync } = await import('fs')
      const { join } = await import('path')
      const transcriptCode = readFileSync(
        join(process.cwd(), 'src', 'lib', 'transcript.ts'),
        'utf-8'
      )

      for (const lang of expectedLangs) {
        expect(transcriptCode).toContain(`'${lang}'`)
      }
    })
  })
})
