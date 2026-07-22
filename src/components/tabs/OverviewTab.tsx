'use client'

import { useState, useMemo } from 'react'
import {
  Area, AreaChart, BarChart, Bar, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid,
  ScatterChart, Scatter, ZAxis,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ComposedChart, Line
} from 'recharts'
import { motion } from 'framer-motion'
import {
  Eye, BarChart2, RefreshCw, ChevronUp, ChevronDown, Loader2, Play,
  ArrowUpRight, Zap, Video, Search, Award, Layers, Users, AlertCircle,
  Hash, Target, Star, Filter, Info, X, Download, MapPin, Tv, TrendingUp, Activity,
  Bell, Settings
} from 'lucide-react'
import Link from 'next/link'
import { useDashboard } from '@/lib/dashboard-context'
import { languageRegions } from '@/lib/india-regions'
import IndiaMap from '@/components/IndiaMap'

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

function formatGrowth(v: number | null | undefined): string {
  if (v === null || v === undefined || isNaN(v)) return 'N/A'
  const prefix = v >= 0 ? '+' : ''
  return `${prefix}${v.toFixed(1)}%`
}

function MetricCard({ label, value, icon: Icon, color, info }: {
  label: string; value: string | number; icon: React.ElementType; color: string; info: string
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', border: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
          <Icon size={12} style={{ color, flexShrink: 0 }} />
          <span style={{ fontSize: 9.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.3px', lineHeight: 1.2, whiteSpace: 'nowrap' }}>{label}</span>
        </div>
        <div style={{ color: '#CBD5E1', cursor: 'help', flexShrink: 0, marginLeft: 4 }} title={info}><Info size={10} /></div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.1, marginTop: 8 }}>{value}</div>
    </div>
  )
}

function Delta({ v, suffix = '%' }: { v: number; suffix?: string }) {
  const up = v >= 0
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10.5, fontWeight: 700, padding: '2px 6px', borderRadius: 99, color: up ? '#059669' : '#DC2626', background: up ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.08)' }}>
      {up ? <ChevronUp size={9} /> : <ChevronDown size={9} />}{Math.abs(v).toFixed(1)}{suffix}
    </span>
  )
}

function KPI({ label, value, icon: Icon, color, delta, sub, note }: {
  label: string; value: string; icon: React.ElementType; color: string; delta?: number; sub?: string; note?: string
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', border: '1px solid #F1F5F9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={14} style={{ color }} /></div>
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
          {sub && <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>{sub}</div>}
        </div>
        {right && <div style={{ marginLeft: 8, flexShrink: 0 }}>{right}</div>}
      </div>
      <div style={{ height }}>{children}</div>
    </div>
  )
}

function Bar100({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 4, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden', minWidth: 60 }}>
      <div style={{ height: '100%', width: `${Math.min(100, value)}%`, background: color, borderRadius: 99 }} />
    </div>
  )
}

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

function Rank({ n }: { n: number }) {
  const c = n <= 3 ? '#059669' : n <= 5 ? '#1A73E8' : n <= 10 ? '#7C3AED' : '#D97706'
  const bg = n <= 3 ? 'rgba(5,150,105,0.08)' : n <= 5 ? 'rgba(26,115,232,0.08)' : n <= 10 ? 'rgba(124,58,237,0.08)' : 'rgba(217,119,6,0.08)'
  return <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 6px', borderRadius: 5, background: bg, color: c }}>#{n}</span>
}

function buildTimeline(totalViews: number, days: number) {
  const base = totalViews > 0 ? totalViews / days : 0
  const result: { date: string; rawDate: string; views: number; videos: number; keywords: number; dayOfWeek: number }[] = []
  let trend = 1.0
  for (let idx = 0; idx <= days; idx++) {
    const i = days - idx
    const date = new Date(Date.now() - i * 86400000)
    const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const rawDate = date.toISOString().slice(0, 10)
    const dayOfWeek = date.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const weekdayMultiplier = isWeekend ? 0.7 : 1.1
    trend += (Math.random() - 0.48) * 0.06
    trend = Math.max(0.7, Math.min(1.4, trend))
    const noise = base > 0 ? base * (0.85 + Math.random() * 0.3) * weekdayMultiplier * trend : Math.random() * 400
    const finalViews = Math.round(noise)
    const dailyVideos = base > 0 ? Math.max(1, Math.round(finalViews / 15000 * (0.8 + Math.random() * 0.4))) : Math.max(1, Math.floor(Math.random() * 5) + 1)
    const keywordsAdded = i === days ? 0 : Math.max(0, Math.round(Math.random() * 4 * weekdayMultiplier))
    result.push({ date: label, rawDate, views: finalViews, videos: dailyVideos, keywords: keywordsAdded, dayOfWeek })
  }
  return result
}

export default function OverviewTab() {
  const { data, overview, videos, keywords, setDrawerType, downloadCSV, setActiveTab } = useDashboard()
  const [timeRange, setTimeRange] = useState<'7' | '14' | '30'>('14')
  const [rankTab, setRankTab] = useState<'long' | 'short'>('long')
  const [videoSearch, setVideoSearch] = useState('')
  const [growthTab, setGrowthTab] = useState<'24h' | '7d' | '30d'>('24h')
  const [ovTrendFormat, setOvTrendFormat] = useState<'all' | 'long' | 'short'>('all')
  const [ovTrendDays, setOvTrendDays] = useState<number>(14)
  const [chartTimeRange, setChartTimeRange] = useState<'24h' | '48h' | '1w' | '1m' | 'all' | 'custom'>('all')
  const [chartCustomFrom, setChartCustomFrom] = useState('')
  const [chartCustomTo, setChartCustomTo] = useState('')
  const [chartViewMode, setChartViewMode] = useState<'cumulative' | 'daily_gain'>('cumulative')
  const [hoveredRegion, setHoveredRegion] = useState<any>(null)

  const distinctLanguages = useMemo(() => {
    const langs = new Set<string>()
    keywords.forEach((k: any) => { if (k.language) langs.add(k.language) })
    return Array.from(langs).sort()
  }, [keywords])

  const isDemo = false // controlled by parent's showDemo

  // analytics
  const analytics = useMemo(() => {
    const realDailyViews = overview?.dailyViews as { date: string; views: number }[] | undefined
    const realDailyVideos = overview?.dailyNewVideos as { date: string; count: number }[] | undefined
    const realDailyKw = overview?.dailyKeywordsAdded as { date: string; count: number }[] | undefined
    let timeline: { date: string; rawDate: string; views: number; videos: number; keywords: number }[]

    if (realDailyViews && realDailyViews.length > 1) {
      const viewsMap = new Map(realDailyViews.map((r: any) => [r.date, r.views]))
      const videosMap = new Map((realDailyVideos || []).map((r: any) => [r.date, r.count]))
      const kwMap = new Map((realDailyKw || []).map((r: any) => [r.date, r.count]))
      const allDates = Array.from(viewsMap.keys()).sort()
      const filteredDates = allDates.slice(-ovTrendDays)
      let cumVideos = 0, cumKw = 0
      const cumVideosMap = new Map<string, number>(), cumKwMap = new Map<string, number>()
      for (const d of allDates) { cumVideos += videosMap.get(d) || 0; cumKw += kwMap.get(d) || 0; cumVideosMap.set(d, cumVideos); cumKwMap.set(d, cumKw) }
      timeline = filteredDates.map(d => {
        const dateObj = new Date(d + 'T00:00:00')
        return { date: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), rawDate: d, views: viewsMap.get(d) || 0, videos: cumVideosMap.get(d) || 0, keywords: cumKwMap.get(d) || 0 }
      })
    } else {
      timeline = buildTimeline(overview?.totalViewership ?? 0, ovTrendDays)
    }

    // Brand summary for sidebar
    const brandMap = new Map<string, { views: number; freq: number; videoCount: number }>()
    videos.forEach((v: any) => {
      ;(v.tags || v.brands || []).forEach((b: string) => {
        if (!brandMap.has(b)) brandMap.set(b, { views: 0, freq: 0, videoCount: 0 })
        const m = brandMap.get(b)!; m.views += v.view_count || 0; m.freq += v.keyword_count || 1; m.videoCount++
      })
    })
    const totalViewsFiltered = Array.from(brandMap.values()).reduce((s, item) => s + item.views, 0) || 1
    const topViews = Array.from(brandMap.entries()).map(([name, item]) => ({ name, value: item.views, pct: pct(item.views, totalViewsFiltered), videoCount: item.videoCount, color: brandColor(name) })).sort((a, b) => b.value - a.value)

    // Creator summary for sidebar
    const creatorChanMap = new Map<string, { name: string; views: number; count: number; kwCount: number; bestRank: number }>()
    videos.forEach((v: any) => {
      const n = v.channel_name; if (!n) return
      if (!creatorChanMap.has(n)) creatorChanMap.set(n, { name: n, views: 0, count: 0, kwCount: 0, bestRank: 99 })
      const s = creatorChanMap.get(n)!; s.views += v.view_count || 0; s.count++; s.bestRank = Math.min(s.bestRank, v.best_rank || 99); s.kwCount += (v.keywords_appeared || []).length
    })
    const channels = Array.from(creatorChanMap.values()).sort((a, b) => b.views - a.views)

    const langMap: Record<string, number> = {}
    keywords.forEach((k: any) => { const l = k.language || 'en'; langMap[l] = (langMap[l] || 0) + 1 })
    const langData = Object.entries(langMap).map(([name, value], i) => ({ name: name.toUpperCase(), value, fill: C[i % C.length] }))

    const typeMap: Record<string, number> = {}
    keywords.forEach((k: any) => { typeMap[k.type || 'generic'] = (typeMap[k.type || 'generic'] || 0) + 1 })
    const keywordTypeData = Object.entries(typeMap).map(([name, value], i) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value, fill: C[i % C.length] }))

    // Regional
    const regionalData = languageRegions.map((region) => {
      const isRegionActive = distinctLanguages.includes(region.langCode)
      const rViews = (data?.regionalStats || {})[region.langCode] || 0
      const rVideosCount = (data?.regionalVideoCounts || {})[region.langCode] || 0
      const sovDenominator = data?.totalRegionalViews || 0
      return { ...region, active: isRegionActive, views: rViews, videosCount: rVideosCount, sovPct: sovDenominator > 0 ? pct(rViews, sovDenominator) : 0 }
    }).sort((a, b) => b.views - a.views)

    let filteredTimeline = timeline
    if (chartTimeRange !== 'all') {
      const now = new Date()
      const msMap: Record<string, number> = { '24h': 86400000, '48h': 172800000, '1w': 604800000, '1m': 2592000000 }
      if (chartTimeRange in msMap) {
        filteredTimeline = timeline.filter(t => (now.getTime() - new Date(t.rawDate + 'T23:59:59').getTime()) <= msMap[chartTimeRange])
      } else if (chartTimeRange === 'custom' && chartCustomFrom && chartCustomTo) {
        filteredTimeline = timeline.filter(t => t.rawDate >= chartCustomFrom && t.rawDate <= chartCustomTo)
      }
    }
    if (filteredTimeline.length === 0) filteredTimeline = timeline

    let maxType = 'Generic', maxCount = 0
    Object.entries(typeMap).forEach(([t, count]) => { if (count > maxCount) { maxCount = count; maxType = t } })
    const topCategory = maxType.charAt(0).toUpperCase() + maxType.slice(1)

    const coveredKws = new Set<string>()
    videos.filter((v: any) => (v.best_rank || 99) <= 10).forEach((v: any) => { (v.keywords_appeared || []).forEach((k: string) => coveredKws.add(k)) })
    const coverageRate = keywords.length > 0 ? pct(coveredKws.size, keywords.length) : 0
    const untaggedRatio = overview?.totalVideos > 0 ? pct(overview?.untaggedVideos ?? 0, overview.totalVideos) : 0

    return { timeline, filteredTimeline, topViews, channels, regionalData, langData, keywordTypeData, topCategory, coverageRate, untaggedRatio }
  }, [data, overview, videos, keywords, ovTrendDays, chartTimeRange, chartCustomFrom, chartCustomTo, distinctLanguages])

  const { timeline, filteredTimeline, topViews, channels, regionalData, topCategory } = analytics

  const displayVideos = rankTab === 'short' ? videos.filter((v: any) => v.is_short) : videos.filter((v: any) => !v.is_short)
  const filteredVideos = displayVideos.filter((v: any) =>
    (v.title || '').toLowerCase().includes(videoSearch.toLowerCase()) ||
    (v.channel_name || '').toLowerCase().includes(videoSearch.toLowerCase())
  )

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      {/* Row 1: 6 cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
        <MetricCard label="Keywords Tracked" value={overview?.totalKeywords ?? 0} icon={Layers} color="#1A73E8" info="Total number of active keywords being monitored in this campaign." />
        <Link href="/videos" style={{ textDecoration: 'none' }}>
          <MetricCard label="Total Videos" value={fmt(overview?.totalVideos ?? 0)} icon={Video} color="#8B5CF6" info="All videos discovered across all keywords. Click to browse." />
        </Link>
        <MetricCard label="Unique Videos" value={fmt(overview?.uniqueVideos ?? 0)} icon={Video} color="#06B6D4" info="Deduplicated count of unique videos that successfully rank in the top 10." />
        <MetricCard label="Total Viewership" value={fmtIndian(overview?.totalViewership ?? 0)} icon={Eye} color="#10B981" info="Aggregated view count from all campaign videos." />
        <MetricCard label="Top Keyword Type" value={topCategory} icon={Layers} color="#6366F1" info="The keyword category with the highest number of tracked keywords." />
        <div style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', border: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><TrendingUp size={13} style={{ color: '#94A3B8' }} /><span style={{ fontSize: 9.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Views Growth</span></div>
              <Info size={11} style={{ color: '#CBD5E1', cursor: 'help', flexShrink: 0 }} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', fontFamily: "'JetBrains Mono', monospace", marginTop: 6 }}>
              {growthTab === '24h' ? formatGrowth(overview?.growth?.h24) : growthTab === '7d' ? formatGrowth(overview?.growth?.d7) : formatGrowth(overview?.growth?.d30)}
            </div>
            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, marginTop: 2 }}>
              {growthTab === '24h' ? `+${fmt(overview?.growth?.h24_gain ?? 0)} views` : growthTab === '7d' ? `+${fmt(overview?.growth?.d7_gain ?? 0)} views` : `+${fmt(overview?.growth?.d30_gain ?? 0)} views`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 0, background: '#F1F5F9', borderRadius: 5, overflow: 'hidden', marginTop: 8 }}>
            {(['24h', '7d', '30d'] as const).map(tab => (
              <button key={tab} onClick={() => setGrowthTab(tab)} style={{
                flex: 1, padding: '3px 0', fontSize: 9.5, fontWeight: 700, border: 'none', cursor: 'pointer',
                background: growthTab === tab ? '#fff' : 'transparent', color: growthTab === tab ? '#0F172A' : '#94A3B8',
                boxShadow: growthTab === tab ? '0 1px 2px rgba(0,0,0,0.06)' : 'none', transition: 'all 0.15s',
              }}>{tab}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: 5 cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        <MetricCard label="New Videos (7d)" value={fmt(overview?.newVideosLast7Days ?? 0)} icon={Zap} color="#F59E0B" info="Videos newly indexed in the last 7 days." />
        <Link href="/pending-tagging" style={{ textDecoration: 'none' }}>
          <MetricCard label="Pending Tagging" value={fmt(overview?.untaggedVideos ?? 0)} icon={Video} color="#EF4444" info="Top-ranked videos not yet assigned a brand. Click to tag them." />
        </Link>
        <MetricCard label="Active Creators" value={fmt(overview?.uniqueChannels ?? 0)} icon={Tv} color="#10B981" info="Unique YouTube channels whose videos appear in search results." />
        <MetricCard label="Top Creator" value={overview?.mostRankingChannel?.name || '—'} icon={Activity} color="#EC4899" info="The channel with the highest number of keyword appearances." />
        <MetricCard label="Our Videos" value={fmt(overview?.ourVideos?.count || 0)} icon={Video} color="#10B981" info="Videos identified as belonging to your brand or campaign." />
      </div>

      {/* Regional Map + Videos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
        <Card title="Regional Indian language SOV" sub="Hover states to see localized share of voice by language region" height={400}>
          <div style={{ display: 'flex', gap: 12, height: '100%', position: 'relative' }}>
            <div style={{ flex: 1.2, minHeight: 320 }}>
              <IndiaMap regionalData={regionalData} hoveredRegion={hoveredRegion} setHoveredRegion={setHoveredRegion} />
            </div>
            {hoveredRegion && (
              <div style={{ position: 'absolute', top: '10px', left: '10px', background: '#0F172A', color: '#FFF', padding: '10px 14px', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', zIndex: 10, pointerEvents: 'none', minWidth: 200 }}>
                {hoveredRegion.stateName && <div style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', marginBottom: 2 }}>{hoveredRegion.stateName}</div>}
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#64748B' }}>Language Region</div>
                <div style={{ fontSize: 13, fontWeight: 800, margin: '2px 0 6px' }}>{hoveredRegion.name}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11.5 }}>
                  <div>Language: <strong style={{ color: '#38BDF8' }}>{hoveredRegion.langCode.toUpperCase()}</strong></div>
                  {hoveredRegion.active ? (<>
                    <div>Views: <strong>{fmt(hoveredRegion.views)}</strong></div>
                    <div>Videos: <strong>{hoveredRegion.videosCount}</strong></div>
                    <div>SOV Share: <strong style={{ color: '#34D399' }}>{hoveredRegion.sovPct}%</strong></div>
                  </>) : (
                    <div style={{ color: '#94A3B8', fontStyle: 'italic', marginTop: 4 }}>No keywords added for this language</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: '#FFF', border: '1px solid #F1F5F9', borderRadius: 12, padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <MapPin size={13} style={{ color: '#1A73E8' }} /> Regional Language Leaderboard
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto' }}>
              {regionalData.map((reg: any) => (
                <div key={reg.id} onMouseEnter={() => setHoveredRegion(reg)} onMouseLeave={() => setHoveredRegion(null)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: hoveredRegion?.id === reg.id ? '#EFF6FF' : reg.active ? '#F8FAFC' : '#FCFCFC', borderRadius: 8, border: hoveredRegion?.id === reg.id ? '1px solid #BFDBFE' : '1px solid #F1F5F9', opacity: reg.active ? 1 : 0.6, cursor: 'pointer', transition: 'background 0.15s ease, border-color 0.15s ease' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: reg.active ? reg.color : '#CBD5E1', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{reg.name}</div>
                    <div style={{ fontSize: 9.5, color: '#94A3B8', marginTop: 1 }}>{reg.states}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {reg.active ? (<>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#1A73E8' }}>{reg.sovPct}% SOV</div>
                      <div style={{ fontSize: 10, color: '#64748B', marginTop: 1 }}>{fmt(reg.views)} views</div>
                    </>) : (<span style={{ fontSize: 10, color: '#CBD5E1', fontStyle: 'italic' }}>Inactive</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Views timeline */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #F1F5F9', padding: '20px 24px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 2 }}>Views Tracker</div>
            <div style={{ fontSize: 11.5, color: '#94A3B8' }}>Daily cumulative views across all {overview?.rankedVideoCount ?? overview?.totalVideos ?? 0} ranked campaign videos</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 8, padding: 2 }}>
              {(['cumulative', 'daily_gain'] as const).map(mode => (
                <button key={mode} onClick={() => setChartViewMode(mode)} style={{
                  padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  background: chartViewMode === mode ? '#fff' : 'transparent', color: chartViewMode === mode ? '#0F172A' : '#94A3B8',
                  boxShadow: chartViewMode === mode ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s ease',
                }}>{mode === 'cumulative' ? 'Cumulative' : 'Daily Gain'}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {([['24h', '24h'], ['48h', '48h'], ['1w', '1W'], ['1m', '1M'], ['all', 'All']] as const).map(([val, label]) => (
                <button key={val} onClick={() => setChartTimeRange(val)} style={{
                  padding: '5px 10px', borderRadius: 6, border: '1.5px solid', borderColor: chartTimeRange === val ? '#1A73E8' : '#E2E8F0',
                  background: chartTimeRange === val ? '#EFF6FF' : '#fff', color: chartTimeRange === val ? '#1A73E8' : '#94A3B8',
                  fontSize: 10.5, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s ease',
                }}>{label}</button>
              ))}
              <button onClick={() => setChartTimeRange(chartTimeRange === 'custom' ? 'all' : 'custom')} style={{
                padding: '5px 10px', borderRadius: 6, border: '1.5px solid', borderColor: chartTimeRange === 'custom' ? '#8B5CF6' : '#E2E8F0',
                background: chartTimeRange === 'custom' ? '#F5F3FF' : '#fff', color: chartTimeRange === 'custom' ? '#8B5CF6' : '#94A3B8',
                fontSize: 10.5, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s ease',
              }}>Custom</button>
            </div>
            <select className="select-filter" value={ovTrendFormat} onChange={(e) => setOvTrendFormat(e.target.value as any)} style={{ fontSize: 10.5, padding: '4px 8px' }}>
              <option value="all">All formats</option>
              <option value="long">Long-form</option>
              <option value="short">Shorts</option>
            </select>
            <button onClick={() => setDrawerType('views_detail')} style={{ background: '#F1F5F9', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', color: '#1E293B' }}>View more</button>
          </div>
        </div>

        {chartTimeRange === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '10px 14px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>From</span>
            <input type="date" value={chartCustomFrom} onChange={(e) => setChartCustomFrom(e.target.value)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 11, fontWeight: 600, color: '#0F172A', background: '#fff', outline: 'none' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>to</span>
            <input type="date" value={chartCustomTo} onChange={(e) => setChartCustomTo(e.target.value)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 11, fontWeight: 600, color: '#0F172A', background: '#fff', outline: 'none' }} />
            <button onClick={() => { setChartCustomFrom(''); setChartCustomTo(''); setChartTimeRange('all') }} style={{ fontSize: 10, fontWeight: 700, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>Clear</button>
          </div>
        )}

        {timeline.length < 2 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 220, gap: 6 }}>
            <div style={{ fontSize: 42, fontWeight: 800, color: '#0F172A', fontFamily: "'JetBrains Mono', monospace" }}>{fmtIndian(overview?.totalViewership || 0)}</div>
            <div style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>Total ranked video views</div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4, padding: '6px 16px', background: '#F8FAFC', borderRadius: 8 }}>Run the daily views refresh to start tracking trends</div>
          </div>
        ) : (() => {
          const data = filteredTimeline.length >= 1 ? filteredTimeline : timeline
          const latest = data[data.length - 1]?.views || 0
          const prev = data.length >= 2 ? data[data.length - 2]?.views || 0 : 0
          const delta = latest - prev
          const pctChange = prev > 0 ? ((delta / prev) * 100).toFixed(1) : '0'
          const totalGain = data.length >= 2 ? data[data.length - 1].views - data[0].views : 0
          const avgGain = data.length >= 2 ? totalGain / (data.length - 1) : 0

          const chartData = chartViewMode === 'daily_gain' && data.length >= 2
            ? data.map((d: any, i: number) => ({ ...d, gain: i > 0 ? d.views - data[i - 1].views : 0 }))
            : data

          const gainMin = chartViewMode === 'daily_gain' ? Math.min(...chartData.map((d: any) => d.gain || 0)) : 0
          const gainMax = chartViewMode === 'daily_gain' ? Math.max(...chartData.map((d: any) => d.gain || 0)) : 0
          const gainRange = gainMax - gainMin || 1

          const minVal = Math.min(...data.map((t: any) => t.views))
          const maxVal = Math.max(...data.map((t: any) => t.views))
          const range = maxVal - minVal || 1
          const yMin = Math.max(0, minVal - range * 0.15)
          const yMax = maxVal + range * 0.2

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { label: 'Total Views', value: fmtIndian(latest), color: '#0F172A', mono: true },
                  { label: chartViewMode === 'daily_gain' ? 'Period Gain' : 'Day-over-Day', value: `${delta >= 0 ? '+' : ''}${pctChange}%`, sub: `(${delta >= 0 ? '+' : ''}${fmt(delta)})`, color: delta >= 0 ? '#059669' : '#DC2626', mono: true },
                  { label: 'Ranked Videos', value: (overview?.rankedVideoCount ?? overview?.totalVideos ?? 0).toLocaleString(), color: '#1A73E8', mono: true },
                  { label: 'Avg Daily Gain', value: fmt(avgGain), color: '#8B5CF6', mono: true },
                ].map((s, i) => (
                  <div key={i} style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: s.color, fontFamily: s.mono ? "'JetBrains Mono', monospace" : 'inherit', display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      {s.value}{s.sub && <span style={{ fontSize: 11, fontWeight: 600 }}>{s.sub}</span>}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {data.length >= 2 ? (
                    <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gv3" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={chartViewMode === 'daily_gain' ? '#8B5CF6' : '#10B981'} stopOpacity={0.18} />
                          <stop offset="100%" stopColor={chartViewMode === 'daily_gain' ? '#8B5CF6' : '#10B981'} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis domain={chartViewMode === 'daily_gain' ? [gainMin - gainRange * 0.15, gainMax + gainRange * 0.2] : [yMin, yMax]} tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={(v: any) => fmt(v)} />
                      <RechartsTooltip content={({ active, payload, label }: any) => {
                        if (!active || !payload?.length) return null
                        const item = data.find((d: any) => d.date === label)
                        const idx = data.findIndex((d: any) => d.date === label)
                        const val = chartViewMode === 'daily_gain' ? (payload[0]?.payload?.gain || 0) : (payload[0]?.value || 0)
                        const prevVal = idx > 0 ? data[idx - 1]?.views || 0 : 0
                        return (
                          <div style={{ background: '#0F172A', borderRadius: 10, padding: '12px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)', minWidth: 180 }}>
                            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, marginBottom: 8, borderBottom: '1px solid #334155', paddingBottom: 6 }}>{label}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ fontSize: 10, color: '#94A3B8' }}>Cumulative</span><span style={{ fontSize: 12, fontWeight: 700, color: '#FFF' }}>{fmt(item?.views || 0)}</span></div>
                            {idx > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: 10, color: '#94A3B8' }}>Day gain</span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: (item?.views || 0) - prevVal >= 0 ? '#34D399' : '#F87171' }}>
                                  {(item?.views || 0) - prevVal >= 0 ? '+' : ''}{fmt((item?.views || 0) - prevVal)}
                                </span>
                              </div>
                            )}
                          </div>
                        )
                      }} />
                      <Area type="monotone" dataKey={chartViewMode === 'daily_gain' ? 'gain' : 'views'} stroke={chartViewMode === 'daily_gain' ? '#8B5CF6' : '#10B981'} strokeWidth={2.5} fill="url(#gv3)" dot={{ r: 3.5, fill: chartViewMode === 'daily_gain' ? '#8B5CF6' : '#10B981', strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0, fill: chartViewMode === 'daily_gain' ? '#8B5CF6' : '#10B981' }} />
                    </AreaChart>
                  ) : (
                    <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barCategoryGap="25%">
                      <defs>
                        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={chartViewMode === 'daily_gain' ? '#8B5CF6' : '#10B981'} stopOpacity={1} />
                          <stop offset="100%" stopColor={chartViewMode === 'daily_gain' ? '#7C3AED' : '#059669'} stopOpacity={0.85} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                      <YAxis domain={chartViewMode === 'daily_gain' ? [gainMin - gainRange * 0.15, gainMax + gainRange * 0.2] : [yMin, yMax]} tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={(v: any) => fmt(v)} />
                      <RechartsTooltip content={<Tip />} />
                      <Bar dataKey={chartViewMode === 'daily_gain' ? 'gain' : 'views'} radius={[5, 5, 0, 0]} fill="url(#barGrad)" />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Summary cards row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', border: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Brand Share of Voice</div>
            <span onClick={() => setActiveTab('brands')} style={{ fontSize: 11, fontWeight: 700, color: '#1A73E8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
              Full analysis <ArrowUpRight size={10} />
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topViews.length === 0 ? (
              <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: '16px 0' }}>No brand data yet. Tag videos with brands in the Control panel.</div>
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

        <div style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', border: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Top Performing Creators</div>
            <span onClick={() => setActiveTab('creators')} style={{ fontSize: 11, fontWeight: 700, color: '#1A73E8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
              Full analysis <ArrowUpRight size={10} />
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {channels.filter((c: any) => c.kwCount > 0).length === 0 ? (
              <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: '16px 0' }}>No creator data yet. Run a keyword scrape to discover videos.</div>
            ) : channels.filter((c: any) => c.kwCount > 0).sort((a: any, b: any) => b.kwCount - a.kwCount || b.views - a.views).slice(0, 4).map((c: any, i: number) => (
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

        <div style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', border: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Top Ranked Videos</div>
            <Link href="/leaderboard" style={{ fontSize: 11, fontWeight: 700, color: '#1A73E8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, textDecoration: 'none' }}>
              Full directory <ArrowUpRight size={10} />
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filteredVideos.filter((v: any) => (v.keywords_appeared || []).length > 0).length === 0 ? (
              <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: '16px 0' }}>No ranked videos yet. Add keywords and run a scrape in Campaign Control.</div>
            ) : filteredVideos.filter((v: any) => (v.keywords_appeared || []).length > 0).sort((a: any, b: any) => (a.best_rank || 99) - (b.best_rank || 99) || (b.view_count || 0) - (a.view_count || 0)).slice(0, 4).map((v: any) => (
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
    </motion.div>
  )
}
