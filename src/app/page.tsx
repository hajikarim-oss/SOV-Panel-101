'use client'

import { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Eye, BarChart2, RefreshCw, ChevronUp, ChevronDown, Loader2, Play,
  ArrowUpRight, Zap, Video, Search, Award, Layers, Users, AlertCircle,
  Hash, Target, Star, Filter, Info, X, Download, MapPin, Tv, TrendingUp, Activity,
  Bell, Settings
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { useCampaignStore } from '@/lib/store'
import { DashboardCtx } from '@/lib/dashboard-context'

const VideosTab = lazy(() => import('@/components/tabs/VideosTab'))
const KeywordsTab = lazy(() => import('@/components/tabs/KeywordsTab'))
const TrendsTab = lazy(() => import('@/components/tabs/TrendsTab'))
const GrowthTab = lazy(() => import('@/components/tabs/GrowthTab'))
const AlertsTab = lazy(() => import('@/components/tabs/AlertsTab'))
const SettingsTab = lazy(() => import('@/components/tabs/SettingsTab'))
const BrandsTab = lazy(() => import('@/components/tabs/BrandsTab'))
const CreatorsTab = lazy(() => import('@/components/tabs/CreatorsTab'))
const RankingsTab = lazy(() => import('@/components/tabs/RankingsTab'))
import OverviewTab from '@/components/tabs/OverviewTab'

const C = [
  '#4C78A8', '#54A24B', '#E45756', '#72B7B2', '#EECA3B',
  '#B279A2', '#FF9DA6', '#9D755D', '#BAB0AC', '#D67195',
  '#F58518', '#4C78A8', '#54A24B', '#E45756', '#72B7B2',
  '#79B8FF', '#A8D8B9', '#F4A582', '#CAB2D6', '#FFFFB3',
]

function brandColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  return C[Math.abs(hash) % C.length]
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toLocaleString()
}

function pct(a: number, b: number) {
  if (!b) return 0
  return Math.round((a / b) * 1000) / 10
}

function fmtIndian(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  if (n >= 1e7) { const val = n / 1e7; return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)) + ' Cr' }
  if (n >= 1e5) { const val = n / 1e5; return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)) + ' Lakh' }
  if (n >= 1e3) { const val = n / 1e3; return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)) + ' K' }
  return n.toLocaleString('en-IN')
}

function Delta({ v, suffix = '%' }: { v: number; suffix?: string }) {
  const up = v >= 0
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10.5, fontWeight: 700, padding: '2px 6px', borderRadius: 99, color: up ? '#059669' : '#DC2626', background: up ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.08)' }}>
      {up ? <ChevronUp size={9} /> : <ChevronDown size={9} />}{Math.abs(v).toFixed(1)}{suffix}
    </span>
  )
}

function Rank({ n }: { n: number }) {
  const c = n <= 3 ? '#059669' : n <= 5 ? '#1A73E8' : n <= 10 ? '#7C3AED' : '#D97706'
  const bg = n <= 3 ? 'rgba(5,150,105,0.08)' : n <= 5 ? 'rgba(26,115,232,0.08)' : n <= 10 ? 'rgba(124,58,237,0.08)' : 'rgba(217,119,6,0.08)'
  return <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 6px', borderRadius: 5, background: bg, color: c }}>#{n}</span>
}

function Bar100({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 4, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden', minWidth: 60 }}>
      <div style={{ height: '100%', width: `${Math.min(100, value)}%`, background: color, borderRadius: 99 }} />
    </div>
  )
}

function TabLoader({ label }: { label?: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '60px 20px' }}>
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        style={{ width: 28, height: 28, border: '3px solid #E2E8F0', borderTopColor: '#1A73E8', borderRadius: '50%' }} />
      {label && (
        <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8' }}>{label}</motion.span>
      )}
    </motion.div>
  )
}

export default function OverviewPage() {
  const { campaigns, activeCampaignId, fetchCampaigns } = useCampaignStore()
  const [timeRange, setTimeRange] = useState<'7' | '14' | '30'>('14')
  const [activeTab, setActiveTab] = useState<'overview' | 'brands' | 'creators' | 'rankings' | 'videos' | 'keywords' | 'trends' | 'growth' | 'alerts' | 'settings'>('overview')
  const [showDemo, setShowDemo] = useState(false)
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'ours' | 'theirs'>('all')
  const [drawerType, setDrawerType] = useState<'views_detail' | 'brand_sov_detail' | 'creator_detail' | 'rank_detail' | null>(null)

  const campaign = campaigns.find(c => c.id === activeCampaignId)
  const isOursParam = ownershipFilter && ownershipFilter !== 'all' ? `&is_ours=${ownershipFilter}` : ''

  const dashboardQuery = useQuery({
    queryKey: ['dashboard', activeCampaignId, ownershipFilter],
    queryFn: async () => {
      const [kpisRes, fullRes] = await Promise.all([
        fetch(`/api/dashboard/kpis?campaign_id=${activeCampaignId}`),
        fetch(`/api/dashboard?campaign_id=${activeCampaignId}${isOursParam}`),
      ])
      const kpis = kpisRes.ok ? await kpisRes.json() : null
      const d = await fullRes.json()
      return { kpis, ...d }
    },
    enabled: !!activeCampaignId,
  })

  const dashboardData = dashboardQuery.data
  const overview = dashboardData?.overview ?? null
  const keywords = dashboardData?.keywords ?? []
  const videos = dashboardData?.topVideos ?? []
  const regionalApiStats = dashboardData?.regionalStats ?? {}
  const regionalApiCounts = dashboardData?.regionalVideoCounts ?? {}
  const totalRegionalViews = dashboardData?.totalRegionalViews ?? 0
  const hasData = !!overview && (overview?.totalVideos ?? 0) > 0

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])

  const distinctLanguages = useMemo(() => {
    const langs = new Set<string>()
    keywords.forEach((k: any) => { if (k.language) langs.add(k.language) })
    return Array.from(langs).sort()
  }, [keywords])

  const distinctBrands = useMemo(() => {
    const brands = new Set<string>()
    videos.forEach((v: any) => {
      ;(v.tags || v.brands || []).forEach((b: string) => brands.add(b))
    })
    return Array.from(brands).sort()
  }, [videos])

  const campaignBrands = useMemo(() => {
    const brands = new Set<string>()
    keywords.forEach((k: any) => { if (k.brand) brands.add(k.brand) })
    return Array.from(brands).sort()
  }, [keywords])

  // Minimal drawer data — only what the overlay needs
  const drawerData = useMemo(() => {
    let timeline: any[] = []
    const realDailyViews = overview?.dailyViews as { date: string; views: number }[] | undefined
    if (realDailyViews && realDailyViews.length > 0) {
      timeline = realDailyViews.map((d: any) => {
        const dateObj = new Date(d.date + 'T00:00:00')
        return {
          date: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          rawDate: d.date,
          views: d.views || 0,
          videos: 0,
          keywords: 0,
        }
      })
    }

    const brandMap = new Map<string, { views: number; freq: number; videoCount: number }>()
    videos.forEach((v: any) => {
      ;(v.tags || v.brands || []).forEach((b: string) => {
        if (!brandMap.has(b)) brandMap.set(b, { views: 0, freq: 0, videoCount: 0 })
        const m = brandMap.get(b)!; m.views += v.view_count || 0; m.freq += v.keyword_count || 1; m.videoCount++
      })
    })
    const totalV = Array.from(brandMap.values()).reduce((s, i) => s + i.views, 0) || 1
    const totalF = Array.from(brandMap.values()).reduce((s, i) => s + i.freq, 0) || 1
    const topViews = Array.from(brandMap.entries())
      .map(([name, item]) => ({ name, value: item.views, pct: pct(item.views, totalV), videoCount: item.videoCount, color: brandColor(name) }))
      .sort((a, b) => b.value - a.value)
    const topFreq = Array.from(brandMap.entries())
      .map(([name, item]) => ({ name, value: item.freq, pct: pct(item.freq, totalF), videoCount: item.videoCount, color: brandColor(name) }))
      .sort((a, b) => b.value - a.value)

    const chanMap = new Map<string, { name: string; views: number; count: number; kwCount: number; shorts: number; avgViews: number; brandCount: number; shortsRatio: number }>()
    videos.forEach((v: any) => {
      const n = v.channel_name; if (!n) return
      if (!chanMap.has(n)) chanMap.set(n, { name: n, views: 0, count: 0, kwCount: 0, shorts: 0, avgViews: 0, brandCount: 0, shortsRatio: 0 })
      const s = chanMap.get(n)!; s.views += v.view_count || 0; s.count++; s.kwCount += (v.keywords_appeared || []).length
      if (v.is_short) s.shorts++
    })
    const channels = Array.from(chanMap.values())
      .map(c => ({ ...c, avgViews: c.count > 0 ? Math.round(c.views / c.count) : 0, shortsRatio: c.count > 0 ? Math.round((c.shorts / c.count) * 100) : 0 }))
      .sort((a, b) => b.views - a.views)

    return { timeline, topViews, topFreq, channels, filteredRankVideos: videos }
  }, [overview, videos])

  const { timeline, topViews, topFreq, channels, filteredRankVideos } = drawerData

  const downloadCSV = (title: string, headers: string[], rows: string[][]) => {
    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `${title.toLowerCase().replace(/\s+/g, '_')}_export.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const ctxValue = useMemo(() => ({
    data: dashboardData,
    overview,
    videos,
    keywords,
    campaignBrands,
    regionalApiStats,
    regionalApiCounts,
    totalRegionalViews,
    hasData,
    isDemo: showDemo,
    setDrawerType,
    downloadCSV,
    setActiveTab,
    showDemo,
    setShowDemo,
    C,
    distinctBrands,
    distinctLanguages,
  }), [dashboardData, overview, videos, keywords, campaignBrands, regionalApiStats, regionalApiCounts, totalRegionalViews, hasData, showDemo, distinctBrands, distinctLanguages])

  return (
    <DashboardCtx.Provider value={ctxValue}>
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <style>{`
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
        .tab-pane{animation:fadeUp 0.25s ease both}
        .tab-pill{padding:8px 16px;font-size:13px;font-weight:600;color:#64748B;background:transparent;border:none;border-bottom:2px solid transparent;cursor:pointer;transition:all 0.15s;font-family:inherit;white-space:nowrap}
        .tab-pill:hover{color:#1E293B}
        .tab-pill.on{color:#1A73E8;border-bottom-color:#1A73E8}
        .row-hover:hover{background:#F8FAFC}
        .mini-tab{padding:4px 10px;font-size:11.5px;font-weight:600;border:none;cursor:pointer;font-family:inherit;transition:all 0.12s;border-radius:6px}
        .select-filter{background:#FFF;border:1px solid #E2E8F0;font-size:11.5px;color:#475569;border-radius:6px;padding:3px 8px;font-weight:600;outline:none;font-family:inherit}
        .drawer-overlay{position:fixed;inset:0;background:rgba(15,23,42,0.4);backdrop-filter:blur(2px);z-index:999;display:flex;justify-content:flex-end}
        .drawer-content{background:#FFF;width:550px;max-width:100%;height:100%;box-shadow:-8px 0 32px rgba(0,0,0,0.15);animation:slideIn 0.3s cubic-bezier(0.16,1,0.3,1) both;display:flex;flex-direction:column}
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.4px' }}>
              {campaign?.name || 'Campaign Analytics'}
            </h1>
            {hasData && <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Live</span>}
          </div>
          <div style={{ fontSize: 12, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{overview?.totalKeywords ?? 0} keywords</span>
            <span style={{ color: '#E2E8F0' }}>·</span>
            <span>{fmt(overview?.totalVideos)} videos</span>
            <span style={{ color: '#E2E8F0' }}>·</span>
            <span>{fmt(overview?.uniqueChannels)} creators</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="select-filter" value={ownershipFilter} onChange={(e) => setOwnershipFilter(e.target.value as any)}>
            <option value="all">All Videos</option>
            <option value="ours">Our Videos</option>
            <option value="theirs">Not Our Videos</option>
          </select>
          <div style={{ display: 'flex', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
            {(['7', '14', '30'] as const).map(r => (
              <button key={r} onClick={() => setTimeRange(r)} style={{ padding: '6px 12px', fontSize: 11.5, fontWeight: 600, background: timeRange === r ? '#1A73E8' : 'transparent', color: timeRange === r ? '#FFF' : '#64748B', border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>{r}d</button>
            ))}
          </div>
          <button onClick={() => dashboardQuery.refetch()} disabled={dashboardQuery.isRefetching}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#FFF', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <RefreshCw size={12} style={{ animation: dashboardQuery.isRefetching ? 'spin 1s linear infinite' : 'none' }} />
            {dashboardQuery.isRefetching ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', marginBottom: 24, overflowX: 'auto' }}>
        {[
          { id: 'overview', label: 'Overview', icon: BarChart2 },
          { id: 'brands', label: 'Brand SOV', icon: Layers },
          { id: 'creators', label: 'Creators', icon: Users },
          { id: 'rankings', label: 'Rankings', icon: Target },
          { id: 'videos', label: 'Videos', icon: Video },
          { id: 'keywords', label: 'Keywords', icon: Search },
          { id: 'trends', label: 'Trends', icon: TrendingUp },
          { id: 'growth', label: 'Growth', icon: Activity },
          { id: 'alerts', label: 'Alerts', icon: Bell },
          { id: 'settings', label: 'Settings', icon: Settings },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} className={`tab-pill ${activeTab === id ? 'on' : ''}`} onClick={() => setActiveTab(id as any)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon size={12} />{label}
          </button>
        ))}
      </div>

      {/* Demo banner */}
      {showDemo && (
        <div style={{
          display: 'flex', gap: 14, padding: '12px 18px', borderRadius: 10, marginBottom: 16,
          background: 'linear-gradient(135deg,rgba(99,102,241,0.06),rgba(26,115,232,0.08))',
          border: '1px solid rgba(99,102,241,0.2)', alignItems: 'center',
        }}>
          <span style={{ fontSize: 18 }}>🧪</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#312E81' }}>Demo Mode — Water Purifier Market Sample Data</div>
            <div style={{ fontSize: 11, color: '#4338CA', marginTop: 1, lineHeight: 1.5 }}>
              Showing reference data for 5 brands (Aquaguard, KENT RO, Livpure, Pureit, AO Smith) and top 8 creators. All charts, ranks, and SOV values are illustrative. Real data will replace this once keywords are added and a scrape is triggered.
            </div>
          </div>
          <button onClick={() => setShowDemo(false)}
            style={{ display:'flex',alignItems:'center',gap:6,padding:'6px 13px',borderRadius:8,cursor:'pointer',background:'#FEF2F2',border:'1px solid #FECACA',color:'#DC2626',fontSize:12,fontWeight:700,flexShrink:0,fontFamily:'inherit' }}>
            🗑 Clear Demo Data
          </button>
        </div>
      )}

      <div className="tab-pane">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
          >
            {activeTab === 'overview' && <OverviewTab />}
            {activeTab === 'brands' && <Suspense fallback={<TabLoader label="Loading brands…" />}><BrandsTab /></Suspense>}
            {activeTab === 'creators' && <Suspense fallback={<TabLoader label="Loading creators…" />}><CreatorsTab /></Suspense>}
            {activeTab === 'rankings' && <Suspense fallback={<TabLoader label="Loading rankings…" />}><RankingsTab /></Suspense>}
            {activeTab === 'videos' && <Suspense fallback={<TabLoader label="Loading videos…" />}><VideosTab /></Suspense>}
            {activeTab === 'keywords' && <Suspense fallback={<TabLoader label="Loading keywords…" />}><KeywordsTab /></Suspense>}
            {activeTab === 'trends' && <Suspense fallback={<TabLoader label="Loading trends…" />}><TrendsTab /></Suspense>}
            {activeTab === 'growth' && <Suspense fallback={<TabLoader label="Loading growth…" />}><GrowthTab /></Suspense>}
            {activeTab === 'alerts' && <Suspense fallback={<TabLoader label="Loading alerts…" />}><AlertsTab /></Suspense>}
            {activeTab === 'settings' && <Suspense fallback={<TabLoader label="Loading settings…" />}><SettingsTab /></Suspense>}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ════════════════════════════════════════
          DETAIL DRAWER OVERLAY
          ════════════════════════════════════════ */}
      {drawerType && (
        <div className="drawer-overlay" onClick={() => setDrawerType(null)}>
          <div className="drawer-content" onClick={(e) => e.stopPropagation()} style={{ padding: '24px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  {drawerType === 'views_detail' && 'Discovery Trend Ledger'}
                  {drawerType === 'brand_sov_detail' && 'Brand Competitive Details'}
                  {drawerType === 'creator_detail' && 'Creator Portfolios'}
                  {drawerType === 'rank_detail' && 'Keyword Rankings Ledger'}
                </h2>
                <p style={{ fontSize: 12, color: '#94A3B8', margin: '4px 0 0' }}>Comprehensive exportable analytical data breakdown</p>
              </div>
              <button onClick={() => setDrawerType(null)} style={{ background: '#F1F5F9', border: 'none', borderRadius: 99, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}>
                <X size={15} />
              </button>
            </div>

            {drawerType === 'views_detail' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>{timeline.length} Days Row Index</span>
                  <button onClick={() => downloadCSV('Daily_Performance', ['Date', 'Views', 'Daily Videos', 'Keywords Added'], timeline.map(t => [t.date, String(t.views), String(t.videos), String(t.keywords ?? 0)]))}
                    style={{ background: '#E0F2FE', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#0369A1', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Download size={12} /> CSV Export
                  </button>
                </div>
                <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#475569' }}>Date</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', color: '#475569' }}>Views</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', color: '#475569' }}>Daily Videos</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', color: '#475569' }}>Keywords Added</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timeline.map((t: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '8px 12px', color: '#1E293B', fontWeight: 600 }}>{t.date}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#10B981' }}>{fmt(t.views)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: '#1A73E8', fontWeight: 600 }}>{t.videos}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: '#8B5CF6', fontWeight: 600 }}>{t.keywords ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {drawerType === 'brand_sov_detail' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>Filtered Brand Breakdown</span>
                  <button onClick={() => downloadCSV('Brand_Metrics', ['Brand', 'View SOV %', 'Views Count', 'KW appearances', 'Videos count'], topViews.map((v: any) => {
                    const f = topFreq.find((x: any) => x.name === v.name)
                    return [v.name, v.pct.toFixed(2), String(v.value), String(f?.value ?? 0), String(v.videoCount)]
                  }))}
                    style={{ background: '#E0F2FE', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#0369A1', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Download size={12} /> CSV Export
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {topViews.map((b: any) => {
                    const f = topFreq.find((x: any) => x.name === b.name)
                    return (
                      <div key={b.name} style={{ background: '#F8FAFC', borderRadius: 8, padding: '12px', border: '1px solid #E2E8F0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{b.name}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: b.color, background: `${b.color}10`, padding: '2px 8px', borderRadius: 4 }}>{b.pct.toFixed(1)}% View SOV</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 11.5 }}>
                          <div><div style={{ color: '#94A3B8', fontWeight: 600 }}>VIEWS</div><div style={{ fontWeight: 700, color: '#334155', marginTop: 1 }}>{fmt(b.value)}</div></div>
                          <div><div style={{ color: '#94A3B8', fontWeight: 600 }}>RANKINGS</div><div style={{ fontWeight: 700, color: '#334155', marginTop: 1 }}>{f?.value ?? 0} ({f?.pct?.toFixed(1) ?? 0}%)</div></div>
                          <div><div style={{ color: '#94A3B8', fontWeight: 600 }}>VIDEOS</div><div style={{ fontWeight: 700, color: '#334155', marginTop: 1 }}>{b.videoCount}</div></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {drawerType === 'creator_detail' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>Creators ({channels.length})</span>
                  <button onClick={() => downloadCSV('Creators_Breakdown', ['Creator', 'Views', 'Videos count', 'Avg Views', 'KW cover', 'Brands span'], channels.map((c: any) => [c.name, String(c.views), String(c.count), String(c.avgViews), String(c.kwCount), String(c.brandCount)]))}
                    style={{ background: '#E0F2FE', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#0369A1', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Download size={12} /> CSV Export
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {channels.map((c: any, idx: number) => (
                    <div key={c.name} style={{ background: '#FAFAFA', borderRadius: 8, padding: '12px', border: '1px solid #E2E8F0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#1E293B' }}>{c.name}</span>
                        <Rank n={idx + 1} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 11 }}>
                        <div>Views: <strong>{fmt(c.views)}</strong></div>
                        <div>Videos: <strong>{c.count}</strong></div>
                        <div>Avg Views: <strong>{fmt(c.avgViews)}</strong></div>
                        <div>Keywords: <strong>{c.kwCount}</strong></div>
                        <div>Brands: <strong>{c.brandCount}</strong></div>
                        <div>Shorts: <strong>{c.shortsRatio}%</strong></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {drawerType === 'rank_detail' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>Videos List ({filteredRankVideos.length})</span>
                  <button onClick={() => downloadCSV('Video_Rankings', ['Title', 'Channel', 'Views', 'Best Rank', 'Keywords count'], filteredRankVideos.map((v: any) => [v.title, v.channel_name, String(v.view_count), String(v.best_rank), String(v.keyword_count)]))}
                    style={{ background: '#E0F2FE', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#0369A1', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Download size={12} /> CSV Export
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredRankVideos.map((v: any) => (
                    <div key={v.id} style={{ display: 'flex', gap: 10, padding: '10px', background: '#F9FAFB', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                      <img src={v.thumbnail_url || `https://img.youtube.com/vi/${v.youtube_id}/mqdefault.jpg`} alt="" style={{ width: 64, height: 38, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <Link href={`/video/${v.youtube_id}`} style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {v.title}
                        </Link>
                        <span style={{ fontSize: 10.5, color: '#94A3B8' }}>{v.channel_name} · {fmt(v.view_count)} views</span>
                      </div>
                      <div style={{ flexShrink: 0 }}><Rank n={v.best_rank || 20} /></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </DashboardCtx.Provider>
  )
}
