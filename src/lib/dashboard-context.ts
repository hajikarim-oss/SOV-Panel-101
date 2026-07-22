'use client'

import { createContext, useContext } from 'react'

export interface TimelineAnalytics {
  timeline: any[]
  filteredTimeline: any[]
  isDemo: boolean
}

export interface BrandAnalytics {
  topViews: any[]
  topFreq: any[]
  brandBar: any[]
  brandPositioning: any[]
  brandEfficiency: any[]
  filteredBrandVideos: any[]
}

export interface CreatorAnalytics {
  channels: any[]
  topCreatorChart: any[]
  creatorRadar: any[]
}

export interface RankingAnalytics {
  rankBuckets: any[]
  filteredRankVideos: any[]
  scatterData: any[]
  rankTypeCompare: any[]
}

export interface GlobalAnalytics {
  longForm: any[]
  shorts: any[]
  totalViews: number
  longViews: number
  shortViews: number
  langData: any[]
  keywordTypeData: any[]
  keywordActivity: any[]
  coverageRate: number
  untaggedRatio: number
  topCategory: string
  regionalData: any[]
}

export interface DashboardContextValue {
  data: any
  overview: any
  videos: any[]
  keywords: any[]
  campaignBrands: string[]
  regionalApiStats: Record<string, number>
  regionalApiCounts: Record<string, number>
  totalRegionalViews: number
  hasData: boolean
  isDemo: boolean
  setDrawerType: (t: any) => void
  downloadCSV: (title: string, headers: string[], rows: string[][]) => void
  setActiveTab: (tab: any) => void
  showDemo: boolean
  setShowDemo: (v: boolean) => void
  C: string[]
  distinctBrands: string[]
  distinctLanguages: string[]
}

export const DashboardCtx = createContext<DashboardContextValue>(null as any)

export function useDashboard(): DashboardContextValue {
  return useContext(DashboardCtx)
}
