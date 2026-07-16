import { create } from 'zustand'

export interface Campaign {
  id: string
  name: string
  category: string
  sub_category?: string
  description: string
  status: 'active' | 'paused' | 'archived'
  keyword_count: number
  brand_count: number
  last_scraped: string | null
  created_at: string
}

interface CampaignStore {
  campaigns: Campaign[]
  activeCampaignId: string
  setActiveCampaignId: (id: string) => void
  fetchCampaigns: () => Promise<void>
}

export const useCampaignStore = create<CampaignStore>((set) => ({
  campaigns: [],
  activeCampaignId: '',
  setActiveCampaignId: (id) => set({ activeCampaignId: id }),
  fetchCampaigns: async () => {
    try {
      const r = await fetch('/api/campaigns')
      if (!r.ok) return
      const contentType = r.headers.get('content-type') ?? ''
      if (!contentType.includes('application/json')) return
      const d = await r.json()
      const camps: Campaign[] = d.campaigns ?? []
      set({ campaigns: camps })
      // Auto-select first campaign if none selected
      set((state) => {
        if (camps.length > 0 && !state.activeCampaignId) {
          return { activeCampaignId: camps[0].id }
        }
        return {}
      })
    } catch (e) {
      console.error('Failed to fetch campaigns in store', e)
    }
  },
}))
