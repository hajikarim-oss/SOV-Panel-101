import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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

export interface ProjectWithRole extends Campaign {
  role: 'owner' | 'admin' | 'editor' | 'viewer'
}

interface CampaignStore {
  campaigns: Campaign[]
  activeCampaignId: string
  _campaignsFetched: boolean
  setActiveCampaignId: (id: string) => void
  fetchCampaigns: () => Promise<void>

  // Workspace / Access Control
  userProjects: ProjectWithRole[]
  _projectsFetched: boolean
  fetchUserProjects: () => Promise<void>
}

export const useCampaignStore = create<CampaignStore>()(
  persist(
    (set, get) => ({
      campaigns: [],
      activeCampaignId: '',
      _campaignsFetched: false,

      setActiveCampaignId: (id) => {
        const prev = get().activeCampaignId
        if (prev !== id) set({ activeCampaignId: id })
      },

      fetchCampaigns: async () => {
        const state = get()
        if (state._campaignsFetched && state.campaigns.length > 0) return

        try {
          const r = await fetch('/api/campaigns')
          if (!r.ok) return
          const contentType = r.headers.get('content-type') ?? ''
          if (!contentType.includes('application/json')) return
          const d = await r.json()
          const camps: Campaign[] = d.campaigns ?? []

          set({
            campaigns: camps,
            _campaignsFetched: true,
            activeCampaignId: get().activeCampaignId || (camps.length > 0 ? camps[0].id : ''),
          })
        } catch (e) {
          console.error('Failed to fetch campaigns in store', e)
        }
      },

      // Workspace
      userProjects: [],
      _projectsFetched: false,

      fetchUserProjects: async () => {
        try {
          const r = await fetch('/api/workspace')
          if (!r.ok) return
          const contentType = r.headers.get('content-type') ?? ''
          if (!contentType.includes('application/json')) return
          const d = await r.json()
          set({
            userProjects: d.projects ?? [],
            _projectsFetched: true,
          })
        } catch (e) {
          console.error('Failed to fetch user projects', e)
        }
      },
    }),
    {
      name: 'sov-campaign-storage',
      partialize: (state) => ({
        campaigns: state.campaigns,
        activeCampaignId: state.activeCampaignId,
      }),
    }
  )
)
