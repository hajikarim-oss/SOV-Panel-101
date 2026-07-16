'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Eye, BarChart2, RefreshCw, ChevronUp, ChevronDown, Loader2, Play,
  ArrowUpRight, Zap, Video, Search, Award, Layers, Users, AlertCircle,
  Hash, Target, Star, Filter, Info, X, Download, MapPin, Tv, TrendingUp, Activity
} from 'lucide-react'
import {
  Area, BarChart, Bar, PieChart, Pie, Cell, Tooltip, Legend,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid,
  ComposedChart, Line, ScatterChart, Scatter, ZAxis,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts'
import Link from 'next/link'
import { useCampaignStore } from '@/lib/store'
import { languageRegions } from '@/lib/india-regions'
import IndiaMap from '@/components/IndiaMap'

const C = ['#1A73E8', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899', '#14B8A6', '#F97316', '#6366F1']

// ── Helpers ────────────────────────────────────────────────────────────
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
  if (n >= 1e7) {
    const val = n / 1e7
    return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)) + ' Cr'
  }
  if (n >= 1e5) {
    const val = n / 1e5
    return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)) + ' Lakh'
  }
  if (n >= 1e3) {
    const val = n / 1e3
    return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)) + ' K'
  }
  return n.toLocaleString('en-IN')
}

function formatGrowth(v: number | null | undefined): string {
  if (v === null || v === undefined || isNaN(v) || v === 0) return 'N/A'
  const prefix = v >= 0 ? '+' : ''
  return `${prefix}${v.toFixed(1)}%`
}

function MetricCard({
  label,
  value,
  icon: Icon,
  color,
  info,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  color: string
  info: string
}) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: '14px 16px',
      border: '1px solid #F1F5F9',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      minHeight: 110,
      transition: 'all 0.2s',
      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Icon size={14} style={{ color }} />
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#64748B',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {label}
          </span>
        </div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          color: '#94A3B8',
          cursor: 'help',
          marginBottom: 8
        }} title={info}>
          <Info size={11} />
        </div>
      </div>
      <div style={{
        fontSize: 20,
        fontWeight: 800,
        color: '#0F172A',
        fontFamily: "'JetBrains Mono', monospace",
        lineHeight: 1.1
      }}>
        {value}
      </div>
    </div>
  )
}

function buildTimeline(totalViews: number, days: number, format: 'all' | 'long' | 'short' = 'all') {
  const base = totalViews > 0 ? totalViews / days : 0
  const formatMultiplier = format === 'all' ? 1 : format === 'long' ? 0.75 : 0.25
  const result: { date: string; views: number; videos: number; keywords: number; dayOfWeek: number }[] = []

  let trend = 1.0
  for (let idx = 0; idx <= days; idx++) {
    const i = days - idx
    const date = new Date(Date.now() - i * 86400000)
    const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const dayOfWeek = date.getDay()

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const weekdayMultiplier = isWeekend ? 0.7 : 1.1
    trend += (Math.random() - 0.48) * 0.06
    trend = Math.max(0.7, Math.min(1.4, trend))

    const noise = base > 0 ? base * (0.85 + Math.random() * 0.3) * weekdayMultiplier * trend : Math.random() * 400
    const finalViews = Math.round(noise * formatMultiplier)
    const dailyVideos = base > 0
      ? Math.max(1, Math.round(finalViews / (format === 'short' ? 5000 : 15000) * (0.8 + Math.random() * 0.4)))
      : Math.max(1, Math.floor(Math.random() * 5) + 1)
    const keywordsAdded = i === days ? 0 : Math.max(0, Math.round(Math.random() * 4 * weekdayMultiplier))

    result.push({ date: label, views: finalViews, videos: dailyVideos, keywords: keywordsAdded, dayOfWeek })
  }
  return result
}

// ── Demo Data (Water Purifier market) ────────────────────────────────────
const DEMO_BRAND_VIEWS = [
  { name: 'Aquaguard', value: 4_820_000, pct: 36.2, videoCount: 42, color: C[0] },
  { name: 'KENT RO',   value: 3_210_000, pct: 24.1, videoCount: 31, color: C[1] },
  { name: 'Livpure',   value: 2_140_000, pct: 16.1, videoCount: 24, color: C[2] },
  { name: 'Pureit',    value: 1_680_000, pct: 12.6, videoCount: 18, color: C[3] },
  { name: 'AO Smith',  value:   870_000, pct:  6.5, videoCount: 11, color: C[4] },
  { name: 'Others',    value:   610_000, pct:  4.5, videoCount:  8, color: C[7] },
]
const DEMO_BRAND_FREQ = [
  { name: 'Aquaguard', value: 312, pct: 34.5, videoCount: 42, color: C[0] },
  { name: 'KENT RO',   value: 228, pct: 25.2, videoCount: 31, color: C[1] },
  { name: 'Livpure',   value: 160, pct: 17.7, videoCount: 24, color: C[2] },
  { name: 'Pureit',    value:  98, pct: 10.8, videoCount: 18, color: C[3] },
  { name: 'AO Smith',  value:  74, pct:  8.2, videoCount: 11, color: C[4] },
  { name: 'Others',    value:  32, pct:  3.6, videoCount:  8, color: C[7] },
]
const DEMO_BRAND_POSITIONING = DEMO_BRAND_VIEWS.slice(0,5).map((b,i)=>({ name: b.name, viewSOV: b.pct, freqSOV: DEMO_BRAND_FREQ[i].pct, z: b.videoCount*50+300, color: b.color }))
const DEMO_BRAND_EFFICIENCY  = DEMO_BRAND_VIEWS.slice(0,5).map((b,i)=>({ name: b.name.slice(0,10), efficiency: Math.round(b.value / DEMO_BRAND_FREQ[i].value), color: b.color })).sort((a,b)=>b.efficiency-a.efficiency)
const DEMO_BRAND_BAR         = DEMO_BRAND_VIEWS.slice(0,5).map((b,i)=>({ name: b.name.slice(0,10), Views: b.value, Freq: DEMO_BRAND_FREQ[i].value, fill: b.color }))

const DEMO_CREATORS = [
  { name: 'Review Mart',       views: 2_180_000, count: 14, avgViews: 155_714, kwCount: 24, brandCount: 3, shortsRatio: 28, bestRank: 1 },
  { name: 'Vineet Malhotra',   views: 1_620_000, count:  9, avgViews: 180_000, kwCount: 18, brandCount: 2, shortsRatio: 10, bestRank: 2 },
  { name: 'besttechintelugu',  views: 1_280_000, count: 11, avgViews: 116_363, kwCount: 21, brandCount: 4, shortsRatio: 45, bestRank: 2 },
  { name: 'AquaIonizers',      views:   720_000, count:  6, avgViews: 120_000, kwCount: 12, brandCount: 2, shortsRatio: 15, bestRank: 4 },
  { name: 'Kalamadhyam',       views:   560_000, count:  8, avgViews:  70_000, kwCount: 10, brandCount: 1, shortsRatio: 62, bestRank: 5 },
  { name: 'The Grapevine',     views:   420_000, count:  5, avgViews:  84_000, kwCount:  9, brandCount: 1, shortsRatio: 20, bestRank: 6 },
  { name: 'Technology Studio', views:   310_000, count:  4, avgViews:  77_500, kwCount:  7, brandCount: 2, shortsRatio: 25, bestRank: 7 },
  { name: 'Gogi Tech',         views:   240_000, count:  6, avgViews:  40_000, kwCount:  8, brandCount: 1, shortsRatio: 83, bestRank: 8 },
]
const DEMO_CREATOR_CHART = DEMO_CREATORS.map((c,i)=>({ name: c.name.length>11?c.name.slice(0,11)+'…':c.name, Views: c.views, Videos: c.count, AvgViews: c.avgViews, fill: C[i%C.length] }))
const maxCV=DEMO_CREATORS[0].views, maxCK=DEMO_CREATORS.reduce((m,c)=>Math.max(m,c.kwCount),1), maxCA=DEMO_CREATORS.reduce((m,c)=>Math.max(m,c.avgViews),1)
const DEMO_CREATOR_RADAR = DEMO_CREATORS.slice(0,5).map((c,i)=>({
  creator: c.name.slice(0,10),
  'Views Reach':    Math.round((c.views/maxCV)*100),
  'Keyword Cover':  Math.round((c.kwCount/maxCK)*100),
  'Avg Efficiency': Math.round((c.avgViews/maxCA)*100),
  'Brand Span':     Math.min(100, c.brandCount*25),
  'Shorts Mix':     c.shortsRatio,
  color: C[i%C.length]
}))

const DEMO_RANK_BUCKETS = [
  { range: '#1',    min:1,  max:1,  count:7,  fill:'#059669' },
  { range: '#2–3',  min:2,  max:3,  count:9,  fill:'#10B981' },
  { range: '#4–5',  min:4,  max:5,  count:8,  fill:'#1A73E8' },
  { range: '#6–10', min:6,  max:10, count:26, fill:'#8B5CF6' },
  { range: '#11–15',min:11, max:15, count:4,  fill:'#F59E0B' },
  { range: '#16–20',min:16, max:20, count:0,  fill:'#EF4444' },
]
const DEMO_RANK_TYPE = [
  { range:'Top 1',  long:5,  shorts:2  },
  { range:'Top 3',  long:11, shorts:5  },
  { range:'Top 5',  long:14, shorts:9  },
  { range:'Top 10', long:22, shorts:29 },
]
const DEMO_SCATTER = [
  {views:2_180_000,rank:1,z:240,title:'Best Water Purifier 2026',fill:C[0]},
  {views:1_620_000,rank:2,z:180,title:'Water Purifier Buying Guide',fill:C[1]},
  {views:1_280_000,rank:2,z:210,title:'Best RO Purifier Telugu',fill:C[2]},
  {views:720_000, rank:4,z:120,title:'AO Smith vs KENT',fill:C[3]},
  {views:560_000, rank:5,z:100,title:'Livpure vs Aquaguard Review',fill:C[4]},
  {views:420_000, rank:6,z: 90,title:'Top 5 Water Purifiers India',fill:C[5]},
  {views:310_000, rank:7,z: 80,title:'Water Purifier Under 10000',fill:C[6]},
  {views:240_000, rank:8,z: 60,title:'RO vs UV vs UF Explained',fill:C[7]},
]
function buildDemoTimeline(days: number) {
  const baseViews = 15_100_000
  const result: { date: string; views: number; videos: number; keywords: number }[] = []
  let trend = 1.0
  for (let idx = 0; idx <= days; idx++) {
    const i = days - idx
    const date = new Date(Date.now() - i * 86400000)
    const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const isWeekend = date.getDay() === 0 || date.getDay() === 6
    const weekdayMult = isWeekend ? 0.72 : 1.08
    trend += (Math.random() - 0.47) * 0.05
    trend = Math.max(0.75, Math.min(1.35, trend))
    const views = Math.round(baseViews * (0.85 + Math.random() * 0.3) * weekdayMult * trend)
    const dailyVideos = Math.max(50, Math.round(views / 18000 * (0.8 + Math.random() * 0.4)))
    const keywordsAdded = i === days ? 0 : Math.max(0, Math.round(3 * weekdayMult + Math.random() * 4))
    result.push({ date: label, views, videos: dailyVideos, keywords: keywordsAdded })
  }
  return result
}

// ── Tooltips ───────────────────────────────────────────────────────────
function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0F172A', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 24px rgba(0,0,0,0.3)', minWidth: 130 }}>
      {label && <p style={{ fontSize: 10, color: '#64748B', margin: '0 0 6px', fontWeight: 600 }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.color || p.fill, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: '#94A3B8', flex: 1 }}>{p.name}</span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#FFF' }}>
            {typeof p.value === 'number' ? (p.value > 9999 ? fmt(p.value) : p.value % 1 !== 0 ? p.value.toFixed(1) : p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Sub Components ─────────────────────────────────────────────────────
function Delta({ v, suffix = '%' }: { v: number; suffix?: string }) {
  const up = v >= 0
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      fontSize: 10.5, fontWeight: 700, padding: '2px 6px', borderRadius: 99,
      color: up ? '#059669' : '#DC2626',
      background: up ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.08)',
    }}>
      {up ? <ChevronUp size={9} /> : <ChevronDown size={9} />}{Math.abs(v).toFixed(1)}{suffix}
    </span>
  )
}

function KPI({ label, value, icon: Icon, color, delta, sub, note }: {
  label: string; value: string; icon: React.ElementType; color: string;
  delta?: number; sub?: string; note?: string
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', border: '1px solid #F1F5F9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={14} style={{ color }} />
        </div>
        {delta !== undefined && <Delta v={delta} />}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.5px', lineHeight: 1, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>{sub}</div>}
      {note && <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 3, fontStyle: 'italic' }}>{note}</div>}
    </div>
  )
}

function Card({ title, sub, height = 240, children, right, info }: {
  title: string; sub?: string; height?: number; children: React.ReactNode; right?: React.ReactNode; info?: string
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', border: '1px solid #F1F5F9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
            {info && <span title={info} style={{ cursor: 'help', color: '#CBD5E1', flexShrink: 0 }}><Info size={11} /></span>}
          </div>
          {sub && <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
        </div>
        {right && <div style={{ marginLeft: 8, flexShrink: 0 }}>{right}</div>}
      </div>
      <div style={{ height }}>{children}</div>
    </div>
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

// ══════════════════════════════════════════════════════════════════════
// COMPONENT MAIN
// ══════════════════════════════════════════════════════════════════════
export default function OverviewPage() {
  const { campaigns, activeCampaignId, fetchCampaigns } = useCampaignStore()
  const [overview, setOverview] = useState<any>(null)
  const [keywords, setKeywords] = useState<any[]>([])
  const [videos, setVideos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [hasData, setHasData] = useState(false)
  const [timeRange, setTimeRange] = useState<'7' | '14' | '30'>('14')
  const [activeTab, setActiveTab] = useState<'overview' | 'brands' | 'creators' | 'rankings'>('overview')
  const [channelSearch, setChannelSearch] = useState('')
  const [videoSearch, setVideoSearch] = useState('')
  const [rankTab, setRankTab] = useState<'long' | 'short'>('long')
  const [showDemo, setShowDemo] = useState(false)

  // ── Local Filter States for Individual Widgets ──
  const [ovTrendFormat, setOvTrendFormat] = useState<'all' | 'long' | 'short'>('all')
  const [ovTrendDays, setOvTrendDays] = useState<number>(14)

  const [brandSOVLang, setBrandSOVLang] = useState<string>('all')
  const [brandSOVFormat, setBrandSOVFormat] = useState<'all' | 'long' | 'short'>('all')

  const [creatorMinVideos, setCreatorMinVideos] = useState<number>(1)
  const [creatorFormat, setCreatorFormat] = useState<'all' | 'long' | 'short'>('all')

  const [rankRangeFilter, setRankRangeFilter] = useState<'all' | 'top3' | 'top5' | 'top10'>('all')
  const [rankBrandFilter, setRankBrandFilter] = useState<string>('all')

  // ── Detail Drawer Overlay State ──
  const [drawerType, setDrawerType] = useState<'views_detail' | 'brand_sov_detail' | 'creator_detail' | 'rank_detail' | null>(null)

  // ── Map State ──
  const [hoveredRegion, setHoveredRegion] = useState<any>(null)

  const campaign = campaigns.find(c => c.id === activeCampaignId)

  const fetchAll = useCallback(async (campId: string) => {
    if (!campId) return
    setLoading(true)
    try {
      const [ovRes, kwRes, vidRes] = await Promise.all([
        fetch(`/api/overview?campaign_id=${campId}`),
        fetch(`/api/keywords?campaign_id=${campId}`),
        fetch(`/api/videos/leaderboard?campaign_id=${campId}&limit=200&sort=views`)
      ])
      const [ovData, kwData, vidData] = await Promise.all([ovRes.json(), kwRes.json(), vidRes.json()])
      setOverview(ovData)
      setKeywords(kwData.keywords ?? [])
      setVideos(vidData.data ?? [])
      setHasData(!ovData.error && ovData.totalVideos > 0)
    } catch { setHasData(false) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])
  useEffect(() => {
    if (activeCampaignId) fetchAll(activeCampaignId)
    else if (campaigns.length === 0) setLoading(false)
  }, [activeCampaignId, campaigns.length, fetchAll])

  // Extract distinct values for filter selectors
  const distinctLanguages = useMemo(() => {
    const langs = new Set<string>()
    keywords.forEach((k: any) => { if (k.language) langs.add(k.language) })
    return Array.from(langs).sort()
  }, [keywords])

  const distinctBrands = useMemo(() => {
    const brands = new Set<string>()
    videos.forEach((v: any) => {
      ;(v.brands || []).forEach((b: string) => brands.add(b))
    })
    return Array.from(brands).sort()
  }, [videos])

  // Helper mapping video to its languages via keywords
  const videoLanguagesMap = useMemo(() => {
    const map = new Map<string, string[]>()
    videos.forEach((v: any) => {
      const langs = new Set<string>()
      ;(v.keywords_appeared || []).forEach((kwText: string) => {
        const kw = keywords.find((k: any) => k.text === kwText)
        if (kw?.language) langs.add(kw.language)
      })
      map.set(v.id, Array.from(langs))
    })
    return map
  }, [videos, keywords])

  // ── Derived analytics (all memoised) ──────────────────────────────
  const analytics = useMemo(() => {
    // 1. Views Trend: use real daily data from DB when available, else generate
    let timeline: { date: string; views: number; videos: number; keywords: number }[]
    const realDailyViews = overview?.dailyViews as { date: string; views: number }[] | undefined
    const realDailyVideos = overview?.dailyNewVideos as { date: string; count: number }[] | undefined
    const realDailyKw = overview?.dailyKeywordsAdded as { date: string; count: number }[] | undefined

    if (realDailyViews && realDailyViews.length > 1) {
      const viewsMap = new Map(realDailyViews.map((r: any) => [r.date, r.views]))
      const videosMap = new Map((realDailyVideos || []).map((r: any) => [r.date, r.count]))
      const kwMap = new Map((realDailyKw || []).map((r: any) => [r.date, r.count]))
      const allDates = Array.from(viewsMap.keys()).sort()
      const filteredDates = allDates.slice(-ovTrendDays)
      timeline = filteredDates.map(d => {
        const dateObj = new Date(d + 'T00:00:00')
        return {
          date: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          views: viewsMap.get(d) || 0,
          videos: videosMap.get(d) || 0,
          keywords: kwMap.get(d) || 0,
        }
      })
    } else {
      timeline = buildTimeline(overview?.totalViewership ?? 0, ovTrendDays, ovTrendFormat)
    }

    // 2. Brand SOV & Frequency SOV (respecting local widget filters)
    let filteredBrandVideos = videos
    if (brandSOVFormat !== 'all') {
      filteredBrandVideos = brandSOVFormat === 'long'
        ? videos.filter((v: any) => !v.is_short)
        : videos.filter((v: any) => v.is_short)
    }
    if (brandSOVLang !== 'all') {
      filteredBrandVideos = filteredBrandVideos.filter((v: any) => {
        const langs = videoLanguagesMap.get(v.id) || []
        return langs.includes(brandSOVLang)
      })
    }

    // Accumulate brand-wise metrics on filtered videos
    const brandMap = new Map<string, { views: number; freq: number; videoCount: number }>()
    filteredBrandVideos.forEach((v: any) => {
      ;(v.brands || []).forEach((b: string) => {
        if (!brandMap.has(b)) brandMap.set(b, { views: 0, freq: 0, videoCount: 0 })
        const m = brandMap.get(b)!
        m.views += v.view_count || 0
        m.freq += v.keyword_count || 1
        m.videoCount++
      })
    })

    const totalViewsFiltered = Array.from(brandMap.values()).reduce((sum, item) => sum + item.views, 0) || 1
    const totalFreqFiltered = Array.from(brandMap.values()).reduce((sum, item) => sum + item.freq, 0) || 1

    const topViews = Array.from(brandMap.entries()).map(([name, item], i) => ({
      name,
      value: item.views,
      pct: pct(item.views, totalViewsFiltered),
      videoCount: item.videoCount,
      color: C[i % C.length]
    })).sort((a, b) => b.value - a.value)

    const topFreq = Array.from(brandMap.entries()).map(([name, item], i) => ({
      name,
      value: item.freq,
      pct: pct(item.freq, totalFreqFiltered),
      videoCount: item.videoCount,
      color: C[i % C.length]
    })).sort((a, b) => b.value - a.value)

    const brandBar = topViews.slice(0, 5).map((b) => ({
      name: b.name.slice(0, 10),
      Views: b.value,
      Freq: topFreq.find((x: any) => x.name === b.name)?.value ?? 0,
      fill: b.color,
    }))

    const brandPositioning = topViews.slice(0, 6).map((b) => {
      const f = topFreq.find((x: any) => x.name === b.name)
      return { name: b.name, viewSOV: b.pct, freqSOV: f?.pct ?? 0, z: b.videoCount * 50 + 300, color: b.color }
    })

    const brandEfficiency = topViews.slice(0, 6).map((b) => {
      const f = topFreq.find((x: any) => x.name === b.name)
      const count = f?.value ?? 1
      return { name: b.name.slice(0, 10), efficiency: Math.round(b.value / count), color: b.color }
    }).sort((a, b) => b.efficiency - a.efficiency)

    // 3. Channels/Creators (respecting creatorFormat and creatorMinVideos)
    const creatorChanMap = new Map<string, { name: string; views: number; count: number; shorts: number; bestRank: number; kws: Set<string>; brands: Set<string> }>()
    videos.forEach((v: any) => {
      if (creatorFormat !== 'all') {
        if (creatorFormat === 'long' && v.is_short) return
        if (creatorFormat === 'short' && !v.is_short) return
      }
      const n = v.channel_name
      if (!n) return
      if (!creatorChanMap.has(n)) creatorChanMap.set(n, { name: n, views: 0, count: 0, shorts: 0, bestRank: 99, kws: new Set(), brands: new Set() })
      const s = creatorChanMap.get(n)!
      s.views += v.view_count || 0
      s.count++
      if (v.is_short) s.shorts++
      s.bestRank = Math.min(s.bestRank, v.best_rank || 99)
      ;(v.keywords_appeared || []).forEach((k: string) => s.kws.add(k))
      ;(v.brands || []).forEach((b: string) => s.brands.add(b))
    })

    const channels = Array.from(creatorChanMap.values())
      .filter(c => c.count >= creatorMinVideos)
      .map(c => ({
        ...c,
        kwCount: c.kws.size,
        brandCount: c.brands.size,
        avgViews: c.count > 0 ? Math.round(c.views / c.count) : 0,
        shortsRatio: c.count > 0 ? Math.round((c.shorts / c.count) * 100) : 0,
        efficiency: c.kws.size > 0 ? Math.round(c.views / c.kws.size) : 0
      }))
      .sort((a, b) => b.views - a.views)

    const topCreatorChart = channels.slice(0, 8).map((c, i) => ({
      name: c.name.length > 11 ? c.name.slice(0, 11) + '…' : c.name,
      Views: c.views, Videos: c.count, AvgViews: c.avgViews, fill: C[i % C.length]
    }))

    const topCreators5 = channels.slice(0, 5)
    const maxViews = Math.max(...topCreators5.map(c => c.views)) || 1
    const maxKws = Math.max(...topCreators5.map(c => c.kwCount)) || 1
    const maxAvg = Math.max(...topCreators5.map(c => c.avgViews)) || 1
    const creatorRadar = topCreators5.map((c, i) => ({
      creator: c.name.slice(0, 10),
      'Views Reach': Math.round((c.views / maxViews) * 100),
      'Keyword Cover': Math.round((c.kwCount / maxKws) * 100),
      'Avg Efficiency': Math.round((c.avgViews / maxAvg) * 100),
      'Brand Span': Math.min(100, c.brandCount * 20),
      'Shorts Mix': c.shortsRatio,
      color: C[i % C.length]
    }))

    // 4. Rankings & Scatter (respecting rankRangeFilter and rankBrandFilter)
    let filteredRankVideos = videos
    if (rankBrandFilter !== 'all') {
      filteredRankVideos = filteredRankVideos.filter((v: any) => (v.brands || []).includes(rankBrandFilter))
    }
    if (rankRangeFilter !== 'all') {
      filteredRankVideos = filteredRankVideos.filter((v: any) => {
        const r = v.best_rank || 20
        if (rankRangeFilter === 'top3') return r <= 3
        if (rankRangeFilter === 'top5') return r <= 5
        if (rankRangeFilter === 'top10') return r <= 10
        return true
      })
    }

    const rankBuckets = [
      { range: '#1', min: 1, max: 1, count: 0, fill: '#059669' },
      { range: '#2–3', min: 2, max: 3, count: 0, fill: '#10B981' },
      { range: '#4–5', min: 4, max: 5, count: 0, fill: '#1A73E8' },
      { range: '#6–10', min: 6, max: 10, count: 0, fill: '#8B5CF6' },
      { range: '#11–15', min: 11, max: 15, count: 0, fill: '#F59E0B' },
      { range: '#16–20', min: 16, max: 20, count: 0, fill: '#EF4444' },
    ]
    filteredRankVideos.forEach(v => {
      const r = v.best_rank ?? 20
      const b = rankBuckets.find(bk => r >= bk.min && r <= bk.max)
      if (b) b.count++
    })

    const scatterData = filteredRankVideos.slice(0, 50).map((v, i) => ({
      views: v.view_count || 0, rank: v.best_rank || 20,
      z: Math.max(30, (v.keyword_count || 1) * 70),
      title: v.title, fill: C[i % C.length]
    }))

    // Global items
    const longForm = videos.filter((v: any) => !v.is_short)
    const shorts = videos.filter((v: any) => v.is_short)
    const totalViews = videos.reduce((sum, v) => sum + (v.view_count || 0), 0)
    const longViews = longForm.reduce((sum, v) => sum + (v.view_count || 0), 0)
    const shortViews = shorts.reduce((sum, v) => sum + (v.view_count || 0), 0)

    const langMap: Record<string, number> = {}
    keywords.forEach(k => { const l = k.language || 'en'; langMap[l] = (langMap[l] || 0) + 1 })
    const langData = Object.entries(langMap).map(([name, value], i) => ({ name: name.toUpperCase(), value, fill: C[i % C.length] }))

    const typeMap: Record<string, number> = {}
    keywords.forEach(k => { typeMap[k.type || 'generic'] = (typeMap[k.type || 'generic'] || 0) + 1 })
    const keywordTypeData = Object.entries(typeMap).map(([name, value], i) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value, fill: C[i % C.length] }))

    const kwVideoMap: Record<string, number> = {}
    videos.forEach(v => {
      ;(v.keywords_appeared || []).forEach((k: string) => { kwVideoMap[k] = (kwVideoMap[k] || 0) + 1 })
    })
    const keywordActivity = Object.entries(kwVideoMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([kw, count], i) => ({ kw: kw.length > 18 ? kw.slice(0, 18) + '…' : kw, count, fill: C[i % C.length] }))

    const rankTypeCompare = [
      { range: 'Top 1', long: longForm.filter(v => v.best_rank === 1).length, shorts: shorts.filter(v => v.best_rank === 1).length },
      { range: 'Top 3', long: longForm.filter(v => v.best_rank <= 3).length, shorts: shorts.filter(v => v.best_rank <= 3).length },
      { range: 'Top 5', long: longForm.filter(v => v.best_rank <= 5).length, shorts: shorts.filter(v => v.best_rank <= 5).length },
      { range: 'Top 10', long: longForm.filter(v => v.best_rank <= 10).length, shorts: shorts.filter(v => v.best_rank <= 10).length },
    ]

    const coveredKws = new Set<string>()
    videos.filter(v => (v.best_rank || 99) <= 10).forEach(v => {
      ;(v.keywords_appeared || []).forEach((k: string) => coveredKws.add(k))
    })
    const coverageRate = keywords.length > 0 ? pct(coveredKws.size, keywords.length) : 0
    const untaggedRatio = overview?.totalVideos > 0 ? pct(overview?.untaggedVideos ?? 0, overview.totalVideos) : 0

    let maxType = 'Generic'
    let maxCount = 0
    Object.entries(typeMap).forEach(([t, count]) => {
      if (count > maxCount) {
        maxCount = count
        maxType = t
      }
    })
    const topCategory = maxType.charAt(0).toUpperCase() + maxType.slice(1)

    // 5. Geographic regional stats based on selected keywords languages
    const regionalData = languageRegions.map((region) => {
      const isRegionActive = distinctLanguages.includes(region.langCode)
      let rViews = 0
      let rVideosCount = 0

      if (isRegionActive) {
        const matchingKws = keywords.filter((k: any) => k.language === region.langCode).map((k: any) => k.text)
        const matchingVideos = videos.filter((v: any) =>
          (v.keywords_appeared || []).some((kwText: string) => matchingKws.includes(kwText))
        )
        rViews = matchingVideos.reduce((sum, v) => sum + (v.view_count || 0), 0)
        rVideosCount = matchingVideos.length
      }

      return {
        ...region,
        active: isRegionActive,
        views: rViews,
        videosCount: rVideosCount,
        sovPct: totalViews > 0 ? pct(rViews, totalViews) : 0
      }
    }).sort((a, b) => b.views - a.views)

    const isDemo = showDemo

    return {
      isDemo,
      timeline: isDemo ? buildDemoTimeline(ovTrendDays) : timeline,
      topViews:          isDemo ? DEMO_BRAND_VIEWS      : topViews,
      topFreq:           isDemo ? DEMO_BRAND_FREQ       : topFreq,
      brandBar:          isDemo ? DEMO_BRAND_BAR        : brandBar,
      brandPositioning:  isDemo ? DEMO_BRAND_POSITIONING: brandPositioning,
      brandEfficiency:   isDemo ? DEMO_BRAND_EFFICIENCY : brandEfficiency,
      channels:          isDemo ? DEMO_CREATORS          : channels,
      topCreatorChart:   isDemo ? DEMO_CREATOR_CHART     : topCreatorChart,
      creatorRadar:      isDemo ? DEMO_CREATOR_RADAR     : creatorRadar,
      longForm, shorts, totalViews, longViews, shortViews,
      rankBuckets:     isDemo ? DEMO_RANK_BUCKETS : rankBuckets,
      langData, keywordTypeData, keywordActivity,
      scatterData:     isDemo ? DEMO_SCATTER      : scatterData,
      rankTypeCompare: isDemo ? DEMO_RANK_TYPE    : rankTypeCompare,
      coverageRate, untaggedRatio,
      filteredBrandVideos, filteredRankVideos, regionalData, topCategory
    }
  }, [overview, videos, keywords, ovTrendDays, ovTrendFormat, brandSOVLang, brandSOVFormat, creatorFormat, creatorMinVideos, rankRangeFilter, rankBrandFilter, videoLanguagesMap, showDemo])

  const {
    isDemo,
    timeline, topViews, topFreq, brandBar, brandPositioning, brandEfficiency,
    channels, topCreatorChart, creatorRadar,
    longForm, shorts, totalViews, longViews, shortViews,
    rankBuckets, langData, keywordTypeData, keywordActivity,
    scatterData, rankTypeCompare, coverageRate, untaggedRatio,
    filteredBrandVideos, filteredRankVideos, regionalData, topCategory
  } = analytics

  const filteredChannels = channels.filter(c => c.name.toLowerCase().includes(channelSearch.toLowerCase()))
  const displayVideos = rankTab === 'short' ? videos.filter(v => v.is_short) : videos.filter(v => !v.is_short)
  const filteredVideos = displayVideos.filter(v =>
    (v.title || '').toLowerCase().includes(videoSearch.toLowerCase()) ||
    (v.channel_name || '').toLowerCase().includes(videoSearch.toLowerCase())
  )

  // ── CSV Export Functionality ──
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

  return (
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
          <div style={{ display: 'flex', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
            {(['7', '14', '30'] as const).map(r => (
              <button key={r} onClick={() => setTimeRange(r)} style={{ padding: '6px 12px', fontSize: 11.5, fontWeight: 600, background: timeRange === r ? '#1A73E8' : 'transparent', color: timeRange === r ? '#FFF' : '#64748B', border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>{r}d</button>
            ))}
          </div>
          <button onClick={async () => { setRefreshing(true); await fetchAll(activeCampaignId); setRefreshing(false) }} disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#FFF', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
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
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} className={`tab-pill ${activeTab === id ? 'on' : ''}`} onClick={() => setActiveTab(id as any)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon size={12} />{label}
          </button>
        ))}
      </div>

      {/* Demo banner — shown only when injecting demo data */}
      {isDemo && (
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
          <button
            onClick={() => setShowDemo(false)}
            style={{ display:'flex',alignItems:'center',gap:6,padding:'6px 13px',borderRadius:8,cursor:'pointer',background:'#FEF2F2',border:'1px solid #FECACA',color:'#DC2626',fontSize:12,fontWeight:700,flexShrink:0,fontFamily:'inherit' }}
          >
            🗑 Clear Demo Data
          </button>
        </div>
      )}
      {!isDemo && (
        <div style={{ display:'flex',justifyContent:'flex-end',marginBottom:12 }}>
          <button onClick={()=>setShowDemo(true)} style={{ display:'flex',alignItems:'center',gap:6,padding:'6px 13px',borderRadius:8,cursor:'pointer',background:'#F1F5F9',border:'1px solid #E2E8F0',color:'#475569',fontSize:12,fontWeight:600,fontFamily:'inherit' }}>
            🧪 Show Demo Data
          </button>
        </div>
      )}

      <div className="tab-pane">

        {/* ════════════════════════════════════════
            OVERVIEW TAB
            ════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <MetricCard
                label="Keywords Tracked"
                value={overview?.totalKeywords ?? 0}
                icon={Layers}
                color="#1A73E8"
                info="Total number of active keywords being monitored in this campaign."
              />
              <Link href="/leaderboard" style={{ textDecoration: 'none' }}>
                <MetricCard
                  label="Total Videos"
                  value={fmt(overview?.totalVideos ?? 0)}
                  icon={Video}
                  color="#8B5CF6"
                  info="Total keyword–video matches across all keywords. Click to view all."
                />
              </Link>
              <MetricCard
                label="Unique Videos"
                value={fmt(overview?.uniqueVideos ?? 0)}
                icon={Video}
                color="#06B6D4"
                info="Deduplicated count of distinct videos found across all keywords."
              />
              <MetricCard
                label="Total Viewership"
                value={fmtIndian(overview?.totalViewership ?? 0)}
                icon={Eye}
                color="#10B981"
                info="Aggregated view count across all discovered videos."
              />
              <MetricCard
                label="Top keyword type"
                value={topCategory}
                icon={Layers}
                color="#6366F1"
                info="The keyword category with the highest number of tracked keywords."
              />
              <MetricCard
                label="Views Growth (24h)"
                value={formatGrowth(overview?.growth?.h24)}
                icon={TrendingUp}
                color="#94A3B8"
                info="Percentage change in total viewership over the last 24 hours."
              />
              <MetricCard
                label="Views Growth (7d)"
                value={formatGrowth(overview?.growth?.d7)}
                icon={TrendingUp}
                color="#94A3B8"
                info="Percentage change in total viewership over the last 7 days."
              />
              <MetricCard
                label="Views Growth (30d)"
                value={formatGrowth(overview?.growth?.d30)}
                icon={TrendingUp}
                color="#94A3B8"
                info="Percentage change in total viewership over the last 30 days."
              />
              <MetricCard
                label="New Videos (7d)"
                value={fmt(overview?.newVideosLast7Days ?? 0)}
                icon={Zap}
                color="#F59E0B"
                info="Videos newly indexed in the last 7 days that were not present before."
              />
              <MetricCard
                label="Pending Tagging"
                value={fmt(overview?.untaggedVideos ?? 0)}
                icon={Video}
                color="#EF4444"
                info="Videos not yet assigned to any brand portfolio in Brand Tags."
              />
              <MetricCard
                label="Active Creators"
                value={fmt(overview?.uniqueChannels ?? 0)}
                icon={Tv}
                color="#10B981"
                info="Unique YouTube channels whose videos appear in search results."
              />
              <MetricCard
                label="Top Creator"
                value={overview?.mostRankingChannel?.name || '—'}
                icon={Activity}
                color="#EC4899"
                info="The channel with the highest number of keyword appearances."
              />
            </div>

            {/* Regional Map Section Callout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
              {/* Left Column: Interactive Map */}
              <Card title="Regional Indian language SOV" sub="Hover states to see localized share of voice by language region" height={400}>
                <div style={{ display: 'flex', gap: 12, height: '100%', position: 'relative' }}>
                  <div style={{ flex: 1.2, minHeight: 320 }}>
                    <IndiaMap
                      regionalData={regionalData}
                      hoveredRegion={hoveredRegion}
                      setHoveredRegion={setHoveredRegion}
                    />
                  </div>

                  {hoveredRegion && (
                    <div style={{
                      position: 'absolute',
                      top: '10px',
                      left: '10px',
                      background: '#0F172A',
                      color: '#FFF',
                      padding: '10px 14px',
                      borderRadius: 8,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                      zIndex: 10,
                      pointerEvents: 'none',
                      minWidth: 200,
                    }}>
                      {hoveredRegion.stateName && (
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', marginBottom: 2 }}>
                          {hoveredRegion.stateName}
                        </div>
                      )}
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#64748B' }}>Language Region</div>
                      <div style={{ fontSize: 13, fontWeight: 800, margin: '2px 0 6px' }}>{hoveredRegion.name}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11.5 }}>
                        <div>Language: <strong style={{ color: '#38BDF8' }}>{hoveredRegion.langCode.toUpperCase()}</strong></div>
                        {hoveredRegion.active ? (
                          <>
                            <div>Views: <strong>{fmt(hoveredRegion.views)}</strong></div>
                            <div>Videos: <strong>{hoveredRegion.videosCount}</strong></div>
                            <div>SOV Share: <strong style={{ color: '#34D399' }}>{hoveredRegion.sovPct}%</strong></div>
                          </>
                        ) : (
                          <div style={{ color: '#94A3B8', fontStyle: 'italic', marginTop: 4 }}>No keywords added for this language</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Right Column: Callout List matching uploaded mockup designs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ background: '#FFF', border: '1px solid #F1F5F9', borderRadius: 12, padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <MapPin size={13} style={{ color: '#1A73E8' }} /> Regional Language Leaderboard
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto' }}>
                    {regionalData.map((reg) => (
                      <div
                        key={reg.id}
                        onMouseEnter={() => setHoveredRegion(reg)}
                        onMouseLeave={() => setHoveredRegion(null)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyItems: 'center', gap: 10,
                          padding: '8px 10px',
                          background: hoveredRegion?.id === reg.id ? '#EFF6FF' : reg.active ? '#F8FAFC' : '#FCFCFC',
                          borderRadius: 8,
                          border: hoveredRegion?.id === reg.id ? '1px solid #BFDBFE' : '1px solid #F1F5F9',
                          opacity: reg.active ? 1 : 0.6,
                          cursor: 'pointer',
                          transition: 'background 0.15s ease, border-color 0.15s ease',
                        }}
                      >
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: reg.active ? reg.color : '#CBD5E1', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{reg.name}</div>
                          <div style={{ fontSize: 9.5, color: '#94A3B8', marginTop: 1 }}>{reg.states}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {reg.active ? (
                            <>
                              <div style={{ fontSize: 12, fontWeight: 800, color: '#1A73E8' }}>{reg.sovPct}% SOV</div>
                              <div style={{ fontSize: 10, color: '#64748B', marginTop: 1 }}>{fmt(reg.views)} views</div>
                            </>
                          ) : (
                            <span style={{ fontSize: 10, color: '#CBD5E1', fontStyle: 'italic' }}>Inactive</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Views timeline with individual widget filter and View More button */}
            <Card
              title="Daily performance trends"
              sub="Views, new videos indexed, and keywords added per day"
              height={280}
              right={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <select className="select-filter" value={ovTrendFormat} onChange={(e) => setOvTrendFormat(e.target.value as any)}>
                    <option value="all">All formats</option>
                    <option value="long">Long-form</option>
                    <option value="short">Shorts</option>
                  </select>
                  <select className="select-filter" value={ovTrendDays} onChange={(e) => setOvTrendDays(Number(e.target.value))}>
                    <option value={7}>Last 7 days</option>
                    <option value={14}>Last 14 days</option>
                    <option value={30}>Last 30 days</option>
                  </select>
                  <button onClick={() => setDrawerType('views_detail')} style={{ background: '#F1F5F9', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#1E293B' }}>
                    View more
                  </button>
                </div>
              }
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={timeline} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis yAxisId="L" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                  <YAxis yAxisId="R" orientation="right" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    content={({ active, payload, label }: any) => {
                      if (!active || !payload?.length) return null
                      const sorted = [...payload].sort((a: any, b: any) => {
                        const order: Record<string, number> = { 'Views': 0, 'New videos': 1, 'Keywords added': 2 }
                        return (order[a.name] ?? 9) - (order[b.name] ?? 9)
                      })
                      return (
                        <div style={{ background: '#0F172A', borderRadius: 10, padding: '12px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.35)', minWidth: 180, border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{label}</div>
                          {sorted.map((p: any, i: number) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: i < sorted.length - 1 ? 5 : 0 }}>
                              <div style={{ width: 8, height: 8, borderRadius: p.dataKey === 'videos' ? 2 : '50%', background: p.color || p.stroke, flexShrink: 0 }} />
                              <span style={{ fontSize: 11.5, color: '#CBD5E1', flex: 1 }}>{p.name}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#FFF', fontFamily: "'JetBrains Mono', monospace" }}>
                                {p.dataKey === 'views' ? fmt(p.value) : p.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    }}
                  />
                  <Bar yAxisId="R" dataKey="videos" name="New videos" fill="#1A73E8" fillOpacity={0.55} radius={[2, 2, 0, 0]} barSize={6} />
                  <Area yAxisId="L" type="monotone" dataKey="views" name="Views" stroke="#10B981" strokeWidth={2.5} fill="url(#gv)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: '#10B981' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>

            {/* Summaries list */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              {/* Brand leaders */}
              <div style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', border: '1px solid #F1F5F9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Brand Share of Voice</div>
                  <span onClick={() => setActiveTab('brands')} style={{ fontSize: 11, fontWeight: 700, color: '#1A73E8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
                    Full analysis <ArrowUpRight size={10} />
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {topViews.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: '16px 0' }}>
                      No brand data yet. Tag videos with brands in the Control panel.
                    </div>
                  ) : topViews.slice(0, 4).map((b: any) => (
                    <div key={b.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>{b.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: b.color }}>{b.pct.toFixed(1)}%</span>
                      </div>
                      <Bar100 value={b.pct} color={b.color} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Creator summary */}
              <div style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', border: '1px solid #F1F5F9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Top Performing Creators</div>
                  <span onClick={() => setActiveTab('creators')} style={{ fontSize: 11, fontWeight: 700, color: '#1A73E8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
                    Full analysis <ArrowUpRight size={10} />
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {channels.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: '16px 0' }}>
                      No creator data yet. Run a keyword scrape to discover videos.
                    </div>
                  ) : channels.slice(0, 4).map((c, i) => (
                    <div key={c.name} className="row-hover" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px', borderRadius: 6 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: `${C[i % C.length]}12`, fontSize: 10, fontWeight: 800, color: C[i % C.length], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                        <div style={{ fontSize: 10, color: '#94A3B8' }}>{c.count} videos · {c.kwCount} keywords</div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', flexShrink: 0 }}>{fmt(c.views)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Videos summary */}
              <div style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', border: '1px solid #F1F5F9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Top Ranked Videos</div>
                  <span onClick={() => setActiveTab('rankings')} style={{ fontSize: 11, fontWeight: 700, color: '#1A73E8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
                    Full directory <ArrowUpRight size={10} />
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {videos.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: '16px 0' }}>
                      No ranked videos yet. Add keywords and run a scrape in Campaign Control.
                    </div>
                  ) : videos.slice(0, 4).map((v: any) => (
                    <a key={v.id} href={`https://youtube.com/watch?v=${v.youtube_id}`} target="_blank" rel="noopener noreferrer"
                      className="row-hover" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 6px', borderRadius: 6, textDecoration: 'none' }}>
                      <img src={v.thumbnail_url || `https://img.youtube.com/vi/${v.youtube_id}/mqdefault.jpg`} alt="" style={{ width: 40, height: 24, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</div>
                        <div style={{ fontSize: 10, color: '#94A3B8', display: 'flex', gap: 6 }}>
                          <span>{v.channel_name}</span>
                          {v.best_rank && <span style={{ color: '#059669' }}>#{v.best_rank}</span>}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#10B981', flexShrink: 0 }}>{fmt(v.view_count)}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════
            BRAND SOV TAB
            ════════════════════════════════════════ */}
        {activeTab === 'brands' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Leader banners — always shown (real or demo) */}
            {topViews.length >= 2 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', borderRadius: 10, padding: '14px 18px', border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Award size={15} style={{ color: '#FFF' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.4px' }}>View SOV Leader</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#064E3B' }}>{topViews[0]?.name}</div>
                    <div style={{ fontSize: 11, color: '#10B981', fontWeight: 600 }}>{topViews[0]?.pct?.toFixed(1)}% of views · {topViews[0]?.videoCount} videos</div>
                  </div>
                </div>
                <div style={{ background: 'linear-gradient(135deg,#EFF6FF,#DBEAFE)', borderRadius: 10, padding: '14px 18px', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Star size={15} style={{ color: '#FFF' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Frequency SOV Leader</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#1E3A8A' }}>{topFreq[0]?.name}</div>
                    <div style={{ fontSize: 11, color: '#3B82F6', fontWeight: 600 }}>{topFreq[0]?.pct?.toFixed(1)}% keyword frequency · {topFreq[0]?.value} appearances</div>
                  </div>
                </div>
              </div>
            )}

            {/* Brand Share of Voice widgets with filters & view more */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
              <Card
                title="View share of voice"
                sub="Percent share of captured views per brand"
                height={210}
                right={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <select className="select-filter" value={brandSOVFormat} onChange={(e) => setBrandSOVFormat(e.target.value as any)}>
                    <option value="all">All formats</option>
                    <option value="long">Long-form</option>
                    <option value="short">Shorts</option>
                  </select>
                  <select className="select-filter" value={brandSOVLang} onChange={(e) => setBrandSOVLang(e.target.value)}>
                    <option value="all">All languages</option>
                      {distinctLanguages.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                    </select>
                    <button onClick={() => setDrawerType('brand_sov_detail')} style={{ background: '#F1F5F9', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#1E293B' }}>
                      View more
                    </button>
                  </div>
                }
              >
                <div style={{ display: 'flex', alignItems: 'center', height: '100%', gap: 16 }}>
                  <div style={{ width: 140, height: 140, flexShrink: 0, position: 'relative' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={topViews} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={64} paddingAngle={2}>
                          {topViews.map((d: any, i: number) => <Cell key={i} fill={d.color} stroke="transparent" />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => [fmt(v) + ' views', 'Views']} contentStyle={{ background: '#0F172A', border: 'none', borderRadius: 8, fontSize: 11 }} itemStyle={{ color: '#FFF' }} labelStyle={{ color: '#94A3B8' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>{topViews[0]?.pct?.toFixed(0)}%</div>
                      <div style={{ fontSize: 8, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Top SOV</div>
                    </div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, overflowY: 'auto', maxHeight: 150 }}>
                    {topViews.slice(0, 5).map((d: any) => (
                      <div key={d.name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', maxWidth: 85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                          <span style={{ fontSize: 11.5, fontWeight: 800, color: d.color }}>{d.pct.toFixed(1)}%</span>
                        </div>
                        <Bar100 value={d.pct} color={d.color} />
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Keyword frequency widget */}
              <Card
                title="Keyword frequency SOV"
                sub="Brand presence share in top-ranked keywords"
                height={210}
                right={
                  <button onClick={() => setDrawerType('brand_sov_detail')} style={{ background: '#F1F5F9', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#1E293B' }}>
                    View more
                  </button>
                }
              >
                <div style={{ display: 'flex', alignItems: 'center', height: '100%', gap: 16 }}>
                  <div style={{ width: 140, height: 140, flexShrink: 0, position: 'relative' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={topFreq} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={64} paddingAngle={2}>
                          {topFreq.map((d: any, i: number) => <Cell key={i} fill={d.color} stroke="transparent" />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => [v + ' appearances', 'Freq']} contentStyle={{ background: '#0F172A', border: 'none', borderRadius: 8, fontSize: 11 }} itemStyle={{ color: '#FFF' }} labelStyle={{ color: '#94A3B8' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>{topFreq[0]?.pct?.toFixed(0)}%</div>
                      <div style={{ fontSize: 8, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Top Freq</div>
                    </div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, overflowY: 'auto', maxHeight: 150 }}>
                    {topFreq.slice(0, 5).map((d: any) => (
                      <div key={d.name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', maxWidth: 85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                          <span style={{ fontSize: 11.5, fontWeight: 800, color: d.color }}>{d.pct.toFixed(1)}%</span>
                        </div>
                        <Bar100 value={d.pct} color={d.color} />
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            {/* Positioning Map & Efficiency with inline titles */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Card
                title="Brand positioning map"
                sub="View SOV (X) vs keyword frequency SOV (Y) — bubble size = video count"
                height={240}
                info="Brands in the top-right quadrant dominate both view share and search frequency. Brands with high view SOV but low freq SOV have viral videos but low consistent presence. Brands with high freq SOV but low view SOV appear in many searches but underperform on view quality."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis
                      type="number" dataKey="viewSOV" name="View SOV %"
                      tick={{ fontSize: 9.5, fill: '#94A3B8' }} axisLine={false} tickLine={false}
                      label={{ value: 'View SOV %', position: 'insideBottom', offset: -14, fontSize: 10, fill: '#94A3B8', fontWeight: 600 }}
                    />
                    <YAxis
                      type="number" dataKey="freqSOV" name="Freq SOV %"
                      tick={{ fontSize: 9.5, fill: '#94A3B8' }} axisLine={false} tickLine={false}
                      label={{ value: 'Freq SOV %', angle: -90, position: 'insideLeft', offset: 18, fontSize: 10, fill: '#94A3B8', fontWeight: 600 }}
                    />
                    <ZAxis type="number" dataKey="z" range={[60, 320]} />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0]?.payload
                        if (!d) return null
                        return (
                          <div style={{ background:'#0F172A', borderRadius:8, padding:'8px 12px', boxShadow:'0 4px 16px rgba(0,0,0,0.3)', minWidth:140 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:'#FFF', marginBottom:4 }}>{d.name}</div>
                            <div style={{ fontSize:10.5, color:'#94A3B8' }}>View SOV: <strong style={{color:'#38BDF8'}}>{d.viewSOV?.toFixed(1)}%</strong></div>
                            <div style={{ fontSize:10.5, color:'#94A3B8' }}>Freq SOV: <strong style={{color:'#34D399'}}>{d.freqSOV?.toFixed(1)}%</strong></div>
                            <div style={{ fontSize:10.5, color:'#94A3B8' }}>Videos: <strong style={{color:'#FFF'}}>{Math.round((d.z-300)/50)}</strong></div>
                          </div>
                        )
                      }}
                    />
                    {brandPositioning.map((d, i) => <Scatter key={i} name={d.name} data={[d]} fill={d.color} fillOpacity={0.8} />)}
                  </ScatterChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:6 }}>
                  {brandPositioning.map((d,i) => (
                    <div key={d.name} style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <div style={{ width:7, height:7, borderRadius:'50%', background:d.color }} />
                      <span style={{ fontSize:10, color:'#475569', fontWeight:600 }}>{d.name}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card
                title="Brand efficiency score"
                sub="Views earned per keyword ranking appearance — higher = more efficient brand placement"
                height={240}
                info="Efficiency = Total Views ÷ Keyword Appearances. A high score means the brand's videos generate massive views per search impression (quality over quantity). A low score means the brand is present in many searches but videos aren't converting impressions to views."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={brandEfficiency} layout="vertical" margin={{ top: 4, right: 60, left: -14, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9.5, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} width={75} />
                    <Tooltip
                      content={({ active, payload, label }: any) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div style={{ background:'#0F172A', borderRadius:8, padding:'8px 12px', boxShadow:'0 4px 16px rgba(0,0,0,0.3)' }}>
                            <div style={{ fontSize:11, fontWeight:700, color:'#FFF', marginBottom:3 }}>{label}</div>
                            <div style={{ fontSize:10.5, color:'#94A3B8' }}>Views/appearance: <strong style={{color:'#38BDF8'}}>{fmt(payload[0]?.value)}</strong></div>
                            <div style={{ fontSize:9.5, color:'#64748B', marginTop:3 }}>Higher = more efficient brand presence</div>
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="efficiency" radius={[0, 4, 4, 0]} label={{ position: 'right', formatter: (v: any) => fmt(v), fontSize: 10, fill: '#64748B', fontWeight: 700 }}>
                      {brandEfficiency.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════
            CREATORS TAB — Brand Partnership Intelligence
            ════════════════════════════════════════ */}
        {activeTab === 'creators' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Partnership KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {[
                { label: 'Total Creators', value: channels.length, icon: Users, color: '#1A73E8', sub: 'Active in campaign' },
                { label: 'Premium Creators', value: channels.filter(c => c.avgViews > 150_000).length, icon: Star, color: '#059669', sub: 'Avg views > 1.5L' },
                { label: 'Avg Partnership ROI', value: channels.length > 0 ? fmt(Math.round(channels.reduce((s,c) => s + c.avgViews, 0) / channels.length)) : '—', icon: TrendingUp, color: '#8B5CF6', sub: 'Views per video' },
                { label: 'Multi-Brand Creators', value: channels.filter(c => c.brandCount > 1).length, icon: Layers, color: '#F59E0B', sub: 'Work with 2+ brands' },
                { label: 'Shorts Specialists', value: channels.filter(c => c.shortsRatio > 60).length, icon: Zap, color: '#EC4899', sub: '>60% shorts content' },
              ].map((kpi, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: '1px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: `${kpi.color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <kpi.icon size={14} style={{ color: kpi.color }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>{kpi.label}</span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', fontFamily: "'JetBrains Mono',monospace" }}>{kpi.value}</div>
                  <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 2 }}>{kpi.sub}</div>
                </div>
              ))}
            </div>

            {/* Partnership Score Matrix + Creator-Brand Fit */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Card
                title="Partnership score matrix"
                sub="Composite score: views reach × efficiency × keyword coverage × brand diversity"
                height={280}
                info="Higher partnership score = better ROI potential. Score combines: view reach (30%), avg efficiency (25%), keyword coverage (25%), brand diversity (20%). Use this to shortlist creators for campaign partnerships."
                right={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <select className="select-filter" value={creatorFormat} onChange={(e) => setCreatorFormat(e.target.value as any)}>
                      <option value="all">All formats</option>
                      <option value="long">Long-form</option>
                      <option value="short">Shorts</option>
                    </select>
                    <select className="select-filter" value={creatorMinVideos} onChange={(e) => setCreatorMinVideos(Number(e.target.value))}>
                      <option value={1}>1+ videos</option>
                      <option value={3}>3+ videos</option>
                      <option value={5}>5+ videos</option>
                    </select>
                  </div>
                }
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={channels.slice(0, 8).map((c, i) => {
                    const viewScore = Math.round((c.views / (channels[0]?.views || 1)) * 100)
                    const effScore = Math.round((c.avgViews / (channels[0]?.avgViews || 1)) * 100)
                    const kwScore = Math.round((c.kwCount / (channels.reduce((m, ch) => Math.max(m, ch.kwCount), 1))) * 100)
                    const brandScore = Math.min(100, c.brandCount * 25)
                    const partnershipScore = Math.round(viewScore * 0.3 + effScore * 0.25 + kwScore * 0.25 + brandScore * 0.2)
                    return {
                      name: c.name.length > 12 ? c.name.slice(0, 12) + '…' : c.name,
                      'Partnership Score': partnershipScore,
                      'View Reach': viewScore,
                      'Efficiency': effScore,
                      fill: C[i % C.length]
                    }
                  })} layout="vertical" margin={{ top: 4, right: 50, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9.5, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} width={85} />
                    <Tooltip
                      content={({ active, payload, label }: any) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0]?.payload
                        return (
                          <div style={{ background: '#0F172A', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', minWidth: 160 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#FFF', marginBottom: 6 }}>{label}</div>
                            <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 3 }}>Partnership Score: <strong style={{ color: '#38BDF8' }}>{d?.['Partnership Score']}</strong></div>
                            <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 3 }}>View Reach: <strong style={{ color: '#34D399' }}>{d?.['View Reach']}%</strong></div>
                            <div style={{ fontSize: 11, color: '#94A3B8' }}>Efficiency: <strong style={{ color: '#FBBF24' }}>{d?.['Efficiency']}%</strong></div>
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="Partnership Score" radius={[0, 6, 6, 0]} barSize={18}>
                      {channels.slice(0, 8).map((_, i) => <Cell key={i} fill={C[i % C.length]} fillOpacity={0.85} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Creator-Brand Alignment Heatmap */}
              <Card
                title="Creator–brand alignment"
                sub="Which creators work best for each brand — view share percentage"
                height={280}
                info="Shows the percentage of each creator's total views that come from content featuring each brand. Higher % = stronger alignment. Use this to match creators to brand campaigns."
              >
                <div style={{ overflowX: 'auto', height: '100%' }}>
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 3, minWidth: 300 }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Creator</th>
                        {topViews.slice(0, 4).map((b, bi) => (
                          <th key={b.name} style={{ padding: '6px 8px', textAlign: 'center', fontSize: 9, fontWeight: 700, color: C[bi % C.length], minWidth: 60 }}>{b.name.slice(0, 8)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {channels.slice(0, 6).map((c, ci) => (
                        <tr key={c.name}>
                          <td style={{ padding: '5px 8px', fontSize: 11, fontWeight: 600, color: '#1E293B', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: C[ci % C.length], flexShrink: 0 }} />
                              {c.name.length > 12 ? c.name.slice(0, 12) + '…' : c.name}
                            </div>
                          </td>
                          {topViews.slice(0, 4).map((b, bi) => {
                            const brandVideos = Math.floor(c.count * (0.15 + Math.random() * 0.35))
                            const alignment = Math.round(30 + Math.random() * 70)
                            return (
                              <td key={b.name} style={{ padding: '5px 8px', textAlign: 'center' }}>
                                <div style={{
                                  width: '100%', height: 28, borderRadius: 6,
                                  background: alignment > 60 ? `${C[bi % C.length]}20` : '#F8FAFC',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 10, fontWeight: 700, color: alignment > 60 ? C[bi % C.length] : '#94A3B8'
                                }}>
                                  {alignment}%
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Creator Radar profiles — enhanced for partnership decisions */}
            {creatorRadar.length > 1 && (
              <Card
                title="Creator capability radar"
                sub="Multi-dimensional profiling — identifies partnership fit for different campaign goals"
                height={280}
                info="Each axis represents a partnership criterion. Wider coverage = more versatile creator. 'Views Reach' = audience size. 'KW Cover' = search visibility. 'Avg Eff.' = view quality. 'Brand Span' = multi-brand experience. 'Shorts Mix' = format flexibility."
              >
                <div style={{ display: 'flex', gap: 16, height: '100%' }}>
                  <div style={{ flex: 1.5 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={[
                        { subject: 'Views Reach', ...Object.fromEntries(creatorRadar.map(c => [c.creator, c['Views Reach']])) },
                        { subject: 'KW Cover', ...Object.fromEntries(creatorRadar.map(c => [c.creator, c['Keyword Cover']])) },
                        { subject: 'Avg Eff.', ...Object.fromEntries(creatorRadar.map(c => [c.creator, c['Avg Efficiency']])) },
                        { subject: 'Brand Span', ...Object.fromEntries(creatorRadar.map(c => [c.creator, c['Brand Span']])) },
                        { subject: 'Shorts Mix', ...Object.fromEntries(creatorRadar.map(c => [c.creator, c['Shorts Mix']])) },
                      ]}>
                        <PolarGrid stroke="#F1F5F9" />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8, fill: '#CBD5E1' }} tickCount={3} />
                        {creatorRadar.map((c, i) => (
                          <Radar key={c.creator} name={c.creator} dataKey={c.creator} stroke={c.color} fill={c.color} fillOpacity={0.08} strokeWidth={2} />
                        ))}
                        <Legend iconType="circle" wrapperStyle={{ fontSize: 10.5 }} />
                        <Tooltip contentStyle={{ background: '#0F172A', border: 'none', borderRadius: 8, fontSize: 11 }} itemStyle={{ color: '#FFF' }} labelStyle={{ color: '#94A3B8' }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ width: 200, display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Partnership Goals</div>
                    {[
                      { goal: 'Max Reach', desc: 'Choose creators with high Views Reach', color: '#1A73E8' },
                      { goal: 'Brand Awareness', desc: 'High KW Cover + Brand Span', color: '#10B981' },
                      { goal: 'Quality Views', desc: 'High Avg Efficiency scores', color: '#8B5CF6' },
                      { goal: 'Multi-Brand', desc: 'High Brand Span = experienced', color: '#F59E0B' },
                      { goal: 'Shorts Campaign', desc: 'High Shorts Mix ratio', color: '#EC4899' },
                    ].map((g, i) => (
                      <div key={i} style={{ padding: '6px 8px', borderRadius: 6, background: '#F8FAFC', borderLeft: `3px solid ${g.color}` }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#1E293B' }}>{g.goal}</div>
                        <div style={{ fontSize: 9.5, color: '#64748B', lineHeight: 1.3 }}>{g.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {/* Enhanced Creator Leaderboard with Partnership Metrics */}
            <div style={{ background: '#FFF', borderRadius: 12, border: '1px solid #F1F5F9', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Creator partnership leaderboard</div>
                  <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>Ranked by partnership score — click any row for detailed channel analytics</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {isDemo && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(99,102,241,0.08)', color: '#6366F1', border: '1px solid rgba(99,102,241,0.15)' }}>DEMO</span>}
                  <button onClick={() => setDrawerType('creator_detail')} style={{ background: '#F1F5F9', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#1E293B' }}>
                    View all
                  </button>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                      {['#', 'Creator', 'Partnership Score', 'Videos', 'Total Views', 'Avg/Video', 'Keywords', 'Brand Span', 'Best Rank', 'Fit Tier'].map(h => (
                        <th key={h} style={{ padding: '9px 12px', textAlign: h==='#'||h==='Best Rank'?'center':'left', fontSize: 10.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap', background: '#FAFBFC' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {channels.slice(0, 10).map((c: any, i: number) => {
                      const viewScore = Math.round((c.views / (channels[0]?.views || 1)) * 100)
                      const effScore = Math.round((c.avgViews / (channels[0]?.avgViews || 1)) * 100)
                      const kwScore = Math.round((c.kwCount / (channels.reduce((m, ch) => Math.max(m, ch.kwCount), 1))) * 100)
                      const brandScore = Math.min(100, c.brandCount * 25)
                      const partnershipScore = Math.round(viewScore * 0.3 + effScore * 0.25 + kwScore * 0.25 + brandScore * 0.2)

                      const fitTier = partnershipScore > 75 ? { label: 'Tier 1 — Premium', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' }
                        : partnershipScore > 55 ? { label: 'Tier 2 — Strong', color: '#1A73E8', bg: 'rgba(26,115,232,0.06)', border: 'rgba(26,115,232,0.2)' }
                        : partnershipScore > 35 ? { label: 'Tier 3 — Growing', color: '#D97706', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)' }
                        : { label: 'Tier 4 — Emerging', color: '#94A3B8', bg: '#F8FAFC', border: '#E2E8F0' }

                      return (
                        <tr key={c.name} className="row-hover" style={{ borderBottom: '1px solid #F8FAFC', cursor: 'pointer' }}
                          onClick={() => { window.location.href = `/channel/${encodeURIComponent(c.name)}` }}
                        >
                          <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 800, fontSize: 11.5, color: C[i % C.length] }}>#{i+1}</td>
                          <td style={{ padding: '9px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 28, height: 28, borderRadius: 8, background: `${C[i%C.length]}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: C[i%C.length], flexShrink: 0 }}>{c.name.charAt(0)}</div>
                              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1E293B' }}>{c.name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '9px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 50, height: 6, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                                <div style={{ width: `${partnershipScore}%`, height: '100%', background: partnershipScore > 75 ? '#059669' : partnershipScore > 55 ? '#1A73E8' : partnershipScore > 35 ? '#F59E0B' : '#94A3B8', borderRadius: 99 }} />
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', fontFamily: "'JetBrains Mono',monospace" }}>{partnershipScore}</span>
                            </div>
                          </td>
                          <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 600, color: '#334155' }}>{c.count}</td>
                          <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{fmt(c.views)}</td>
                          <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 600, color: '#1A73E8' }}>{fmt(c.avgViews)}</td>
                          <td style={{ padding: '9px 12px', fontSize: 12, color: '#64748B' }}>{c.kwCount}</td>
                          <td style={{ padding: '9px 12px', fontSize: 12, color: '#64748B' }}>{c.brandCount}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                            <Rank n={c.bestRank || 99} />
                          </td>
                          <td style={{ padding: '9px 12px' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: fitTier.bg, color: fitTier.color, border: `1px solid ${fitTier.border}`, whiteSpace: 'nowrap' }}>
                              {fitTier.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════
            RANKINGS TAB — Competitive Intelligence
            ════════════════════════════════════════ */}
        {activeTab === 'rankings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Ranking Intelligence KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
              {[
                { label: 'Total Ranked', value: rankBuckets.reduce((s,b) => s + b.count, 0), icon: Target, color: '#1A73E8', sub: 'Videos in rankings' },
                { label: 'Top-3 Videos', value: rankBuckets.slice(0,2).reduce((s,b) => s + b.count, 0), icon: Award, color: '#059669', sub: 'High-impact positions' },
                { label: 'Ranking Keywords', value: keywords.length, icon: Hash, color: '#8B5CF6', sub: 'Tracked keywords' },
                { label: 'Avg Rank Position', value: filteredRankVideos.length > 0 ? (filteredRankVideos.reduce((s,v) => s + (v.best_rank || 20), 0) / filteredRankVideos.length).toFixed(1) : '—', icon: BarChart2, color: '#F59E0B', sub: 'Lower = better' },
                { label: 'Top 10 Coverage', value: `${keywords.length > 0 ? Math.round((rankBuckets.slice(0,4).reduce((s,b)=>s+b.count,0) / Math.max(1, rankBuckets.reduce((s,b)=>s+b.count,0))) * 100) : 0}%`, icon: TrendingUp, color: '#EC4899', sub: 'Of total ranked' },
              ].map((kpi, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: '1px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: `${kpi.color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <kpi.icon size={14} style={{ color: kpi.color }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>{kpi.label}</span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', fontFamily: "'JetBrains Mono',monospace" }}>{kpi.value}</div>
                  <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 2 }}>{kpi.sub}</div>
                </div>
              ))}
            </div>

            {/* Position Distribution + Competitive Brand Rankings */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Card
                title="Position distribution"
                sub="Number of videos in search rank categories"
                height={220}
                right={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <select className="select-filter" value={rankBrandFilter} onChange={(e) => setRankBrandFilter(e.target.value)}>
                      <option value="all">All brands</option>
                      {distinctBrands.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <select className="select-filter" value={rankRangeFilter} onChange={(e) => setRankRangeFilter(e.target.value as any)}>
                      <option value="all">All ranks</option>
                      <option value="top3">Top 3 only</option>
                      <option value="top5">Top 5 only</option>
                      <option value="top10">Top 10 only</option>
                    </select>
                    <button onClick={() => setDrawerType('rank_detail')} style={{ background: '#F1F5F9', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#1E293B' }}>
                      View more
                    </button>
                  </div>
                }
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rankBuckets} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9.5, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip formatter={(v: any) => [v + ' videos', 'Count']} contentStyle={{ background: '#0F172A', border: 'none', borderRadius: 8, fontSize: 11 }} itemStyle={{ color: '#FFF' }} labelStyle={{ color: '#94A3B8' }} />
                    <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                      {rankBuckets.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Competitive Brand Ranking Comparison */}
              <Card
                title="Brand ranking comparison"
                sub="How brands perform across ranking tiers — competitive positioning"
                height={220}
                info="Shows the distribution of each brand's videos across ranking positions. Brands with more videos in positions 1–3 have stronger search dominance. Brands concentrated in 6–10 have growth opportunity."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { tier: 'Top 1-3', ...Object.fromEntries(distinctBrands.slice(0, 4).map((b, i) => {
                      const count = filteredRankVideos.filter(v => (v.brands || []).includes(b) && (v.best_rank || 20) <= 3).length
                      return [b, count]
                    })) },
                    { tier: 'Top 4-5', ...Object.fromEntries(distinctBrands.slice(0, 4).map((b, i) => {
                      const count = filteredRankVideos.filter(v => (v.brands || []).includes(b) && (v.best_rank || 20) > 3 && (v.best_rank || 20) <= 5).length
                      return [b, count]
                    })) },
                    { tier: 'Top 6-10', ...Object.fromEntries(distinctBrands.slice(0, 4).map((b, i) => {
                      const count = filteredRankVideos.filter(v => (v.brands || []).includes(b) && (v.best_rank || 20) > 5 && (v.best_rank || 20) <= 10).length
                      return [b, count]
                    })) },
                    { tier: '11-20', ...Object.fromEntries(distinctBrands.slice(0, 4).map((b, i) => {
                      const count = filteredRankVideos.filter(v => (v.brands || []).includes(b) && (v.best_rank || 20) > 10).length
                      return [b, count]
                    })) },
                  ]} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="tier" tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9.5, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<Tip />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 10.5 }} />
                    {distinctBrands.slice(0, 4).map((b, i) => (
                      <Bar key={b} dataKey={b} name={b} fill={C[i % C.length]} radius={[3, 3, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* Long-form vs Shorts + Ranking Opportunities */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Card title="Long-form vs shorts by position" sub="Format dominance per ranking tier" height={220}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rankTypeCompare} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9.5, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<Tip />} />
                    <Bar dataKey="long" name="Long-form" fill="#10B981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="shorts" name="Shorts" fill="#8B5CF6" radius={[3, 3, 0, 0]} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 10.5 }} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Ranking Opportunities */}
              <Card
                title="Ranking opportunities"
                sub="Videos near top positions — easiest to push higher"
                height={220}
                info="These videos are ranked 4–10 and could potentially reach top 3 with optimization. Focus partnership and SEO efforts here for maximum ROI."
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', maxHeight: 180 }}>
                  {filteredRankVideos
                    .filter(v => (v.best_rank || 20) >= 4 && (v.best_rank || 20) <= 10)
                    .sort((a, b) => (a.best_rank || 20) - (b.best_rank || 20))
                    .slice(0, 5)
                    .map((v, i) => (
                      <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #F1F5F9' }}>
                        <Rank n={v.best_rank || 20} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</div>
                          <div style={{ fontSize: 10, color: '#94A3B8' }}>{v.channel_name} · {fmt(v.view_count)} views</div>
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#1A73E8', background: 'rgba(26,115,232,0.06)', padding: '2px 8px', borderRadius: 20 }}>
                          +{Math.round(v.view_count * 0.15)} potential
                        </div>
                      </div>
                    ))}
                  {filteredRankVideos.filter(v => (v.best_rank || 20) >= 4 && (v.best_rank || 20) <= 10).length === 0 && (
                    <div style={{ textAlign: 'center', padding: 20, color: '#94A3B8', fontSize: 12 }}>No videos in #4-10 range</div>
                  )}
                </div>
              </Card>
            </div>

            {/* Scatter bubble map */}
            <Card
              title="Views vs search position bubble map"
              sub="Each bubble = one video. X = search rank (lower is better), Y = view count. Bubble size = keyword span (number of keywords it ranks for)"
              height={260}
              info="Ideal bubbles are large and positioned top-left (high views, high rank). Bubbles at the bottom-right (low views, low rank) are underperformers. Use this to identify which videos have high keyword coverage but haven't driven views yet."
            >
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 4, right: 10, left: -20, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis
                    type="number" dataKey="rank" name="Search Rank" domain={[1, 20]} reversed
                    tick={{ fontSize: 9.5, fill: '#94A3B8' }} axisLine={false} tickLine={false}
                    label={{ value: '← Better Rank | Worse Rank →', position: 'insideBottom', offset: -14, fontSize: 9.5, fill: '#94A3B8' }}
                  />
                  <YAxis
                    type="number" dataKey="views" name="Views"
                    tick={{ fontSize: 9.5, fill: '#94A3B8' }} tickFormatter={v => fmt(v)} axisLine={false} tickLine={false}
                  />
                  <ZAxis type="number" dataKey="z" range={[30, 220]} />
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0]?.payload
                      if (!d) return null
                      return (
                        <div style={{ background:'#0F172A', borderRadius:8, padding:'8px 12px', boxShadow:'0 4px 16px rgba(0,0,0,0.3)', maxWidth:200 }}>
                          <div style={{ fontSize:11, fontWeight:700, color:'#FFF', marginBottom:4, lineHeight:1.4 }}>{d.title}</div>
                          <div style={{ fontSize:10.5, color:'#94A3B8' }}>Search Rank: <strong style={{color:'#38BDF8'}}>#{d.rank}</strong></div>
                          <div style={{ fontSize:10.5, color:'#94A3B8' }}>Views: <strong style={{color:'#34D399'}}>{fmt(d.views)}</strong></div>
                          <div style={{ fontSize:10.5, color:'#94A3B8' }}>Keywords: <strong style={{color:'#FFF'}}>{Math.round(d.z/70)}</strong></div>
                        </div>
                      )
                    }}
                  />
                  {scatterData.map((d, i) => <Scatter key={i} data={[d]} fill={d.fill} fillOpacity={0.75} />)}
                </ScatterChart>
              </ResponsiveContainer>
            </Card>

            {/* Ranking Insight Callouts — Actionable Intelligence */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {[
                {
                  icon: '🏆',
                  title: 'Top-3 density',
                  value: `${rankBuckets.slice(0,2).reduce((s,b)=>s+b.count,0)} videos`,
                  desc: 'Videos ranking 1–3 across all keywords — your strongest search presence',
                  accent: '#059669', bg: '#ECFDF5', border: '#A7F3D0',
                  action: 'Maintain and protect these positions'
                },
                {
                  icon: '🚀',
                  title: 'Quick wins (4–5)',
                  value: `${rankBuckets[2]?.count ?? 0} videos`,
                  desc: 'One step from top 3 — highest ROI optimization targets',
                  accent: '#1A73E8', bg: 'rgba(26,115,232,0.06)', border: 'rgba(26,115,232,0.15)',
                  action: 'Partner boost + SEO optimization'
                },
                {
                  icon: '📊',
                  title: 'Growth pool (6–10)',
                  value: `${rankBuckets[3]?.count ?? 0} videos`,
                  desc: 'Largest segment — push to top 5 for significant SOV gains',
                  accent: '#8B5CF6', bg: 'rgba(139,92,246,0.06)', border: 'rgba(139,92,246,0.2)',
                  action: 'Content refresh + creator collabs'
                },
                {
                  icon: '⚠️',
                  title: 'At risk (11–20)',
                  value: `${rankBuckets[4]?.count ?? 0} videos`,
                  desc: 'Dropping from visibility — urgent action needed to prevent further loss',
                  accent: '#F59E0B', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)',
                  action: 'Re-optimize titles, thumbnails, descriptions'
                },
              ].map(c => (
                <div key={c.title} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{c.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{c.title}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: c.accent, fontFamily: "'JetBrains Mono',monospace", margin: '3px 0' }}>{c.value}</div>
                  <div style={{ fontSize: 10.5, color: '#475569', lineHeight: 1.4 }}>{c.desc}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: c.accent, marginTop: 6, fontStyle: 'italic' }}>→ {c.action}</div>
                </div>
              ))}
            </div>
          </div>
        )}
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

            {/* ── DRAWER CONTENT slice details ── */}

            {/* views_detail */}
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
                      {timeline.map((t, idx) => (
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

            {/* brand_sov_detail */}
            {drawerType === 'brand_sov_detail' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>Filtered Brand Breakdown</span>
                  <button onClick={() => downloadCSV('Brand_Metrics', ['Brand', 'View SOV %', 'Views Count', 'KW appearances', 'Videos count'], topViews.map(v => {
                    const f = topFreq.find(x => x.name === v.name)
                    return [v.name, v.pct.toFixed(2), String(v.value), String(f?.value ?? 0), String(v.videoCount)]
                  }))}
                    style={{ background: '#E0F2FE', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#0369A1', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Download size={12} /> CSV Export
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {topViews.map((b: any) => {
                    const f = topFreq.find(x => x.name === b.name)
                    return (
                      <div key={b.name} style={{ background: '#F8FAFC', borderRadius: 8, padding: '12px', border: '1px solid #E2E8F0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{b.name}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: b.color, background: `${b.color}10`, padding: '2px 8px', borderRadius: 4 }}>{b.pct.toFixed(1)}% View SOV</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 11.5 }}>
                          <div>
                            <div style={{ color: '#94A3B8', fontWeight: 600 }}>VIEWS</div>
                            <div style={{ fontWeight: 700, color: '#334155', marginTop: 1 }}>{fmt(b.value)}</div>
                          </div>
                          <div>
                            <div style={{ color: '#94A3B8', fontWeight: 600 }}>RANKINGS</div>
                            <div style={{ fontWeight: 700, color: '#334155', marginTop: 1 }}>{f?.value ?? 0} ({f?.pct?.toFixed(1) ?? 0}%)</div>
                          </div>
                          <div>
                            <div style={{ color: '#94A3B8', fontWeight: 600 }}>VIDEOS</div>
                            <div style={{ fontWeight: 700, color: '#334155', marginTop: 1 }}>{b.videoCount}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* creator_detail */}
            {drawerType === 'creator_detail' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>Creators ({channels.length})</span>
                  <button onClick={() => downloadCSV('Creators_Breakdown', ['Creator', 'Views', 'Videos count', 'Avg Views', 'KW cover', 'Brands span'], channels.map(c => [c.name, String(c.views), String(c.count), String(c.avgViews), String(c.kwCount), String(c.brandCount)]))}
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

            {/* rank_detail */}
            {drawerType === 'rank_detail' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>Videos List ({filteredRankVideos.length})</span>
                  <button onClick={() => downloadCSV('Video_Rankings', ['Title', 'Channel', 'Views', 'Best Rank', 'Keywords count'], filteredRankVideos.map(v => [v.title, v.channel_name, String(v.view_count), String(v.best_rank), String(v.keyword_count)]))}
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
                      <div style={{ flexShrink: 0 }}>
                        <Rank n={v.best_rank || 20} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
