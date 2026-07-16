'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Treemap
} from 'recharts'
import { useCampaignStore } from '@/lib/store'
import { Loader2, AlertCircle, RefreshCw, Hash, Target, BarChart2 } from 'lucide-react'
import Link from 'next/link'

const COLORS = ['#1A73E8', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899', '#94A3B8']

// Demo Data for Water Purifier Market
const DEMO_BRANDS = ['Aquaguard', 'KENT RO', 'Livpure', 'Pureit', 'AO Smith']
const DEMO_KEYWORD_SOV = [
  { keyword: 'best water purifier 2026', total_videos: 42, Aquaguard: 38.2, 'KENT RO': 24.5, Livpure: 15.8, Pureit: 12.4, 'AO Smith': 6.1, Other: 3.0 },
  { keyword: 'water purifier review', total_videos: 38, Aquaguard: 35.6, 'KENT RO': 22.3, Livpure: 18.2, Pureit: 13.1, 'AO Smith': 7.8, Other: 3.0 },
  { keyword: 'RO water purifier', total_videos: 35, Aquaguard: 32.4, 'KENT RO': 28.1, Livpure: 16.5, Pureit: 11.2, 'AO Smith': 8.3, Other: 3.5 },
  { keyword: 'water purifier under 15000', total_videos: 31, Aquaguard: 28.9, 'KENT RO': 25.6, Livpure: 19.4, Pureit: 14.2, 'AO Smith': 8.4, Other: 3.5 },
  { keyword: 'Aquaguard water purifier', total_videos: 28, Aquaguard: 52.3, 'KENT RO': 12.1, Livpure: 10.5, Pureit: 9.8, 'AO Smith': 8.2, Other: 7.1 },
  { keyword: 'KENT RO review', total_videos: 26, Aquaguard: 10.2, 'KENT RO': 48.6, Livpure: 12.4, Pureit: 11.8, 'AO Smith': 9.5, Other: 7.5 },
  { keyword: 'best RO purifier India', total_videos: 24, Aquaguard: 30.5, 'KENT RO': 26.8, Livpure: 17.2, Pureit: 13.4, 'AO Smith': 7.6, Other: 4.5 },
  { keyword: 'water purifier comparison', total_videos: 22, Aquaguard: 27.8, 'KENT RO': 24.2, Livpure: 19.6, Pureit: 14.8, 'AO Smith': 9.1, Other: 4.5 },
  { keyword: 'Livpure water purifier', total_videos: 20, Aquaguard: 12.5, 'KENT RO': 14.2, Livpure: 42.8, Pureit: 12.6, 'AO Smith': 10.4, Other: 7.5 },
  { keyword: 'AO Smith water purifier', total_videos: 18, Aquaguard: 14.2, 'KENT RO': 12.8, Livpure: 11.5, Pureit: 9.8, 'AO Smith': 42.6, Other: 9.1 },
  { keyword: 'water purifier price list', total_videos: 16, Aquaguard: 26.4, 'KENT RO': 22.8, Livpure: 18.6, Pureit: 16.2, 'AO Smith': 10.5, Other: 5.5 },
  { keyword: 'hot and cold water purifier', total_videos: 14, Aquaguard: 32.1, 'KENT RO': 20.5, Livpure: 16.8, Pureit: 14.2, 'AO Smith': 11.4, Other: 5.0 },
  { keyword: 'water purifier service near me', total_videos: 12, Aquaguard: 28.6, 'KENT RO': 26.4, Livpure: 15.2, Pureit: 13.8, 'AO Smith': 10.5, Other: 5.5 },
  { keyword: 'zero water purifier', total_videos: 10, Aquaguard: 22.5, 'KENT RO': 18.6, Livpure: 14.8, Pureit: 12.4, 'AO Smith': 8.2, Other: 23.5 },
  { keyword: 'water purifier maintenance cost', total_videos: 8, Aquaguard: 30.2, 'KENT RO': 24.8, Livpure: 16.4, Pureit: 12.6, 'AO Smith': 9.5, Other: 6.5 },
]

const LANGUAGE_OPTS = [
  { value: 'all', label: 'Overall' },
  { value: 'ta', label: '🇮🇳 Tamil' },
  { value: 'te', label: '🇮🇳 Telugu' },
  { value: 'ml', label: '🇮🇳 Malayalam' },
  { value: 'en', label: '🌐 English' },
]

const TYPE_OPTS = [
  { value: 'all', label: 'Overall' },
  { value: 'generic', label: 'Generic' },
  { value: 'branded', label: 'Branded' },
]

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const sorted = [...payload].filter(p => p.value > 0).sort((a, b) => b.value - a.value)
  return (
    <div style={{ background: '#1E293B', border: 'none', borderRadius: 10, padding: '10px 14px', minWidth: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 8, wordBreak: 'break-word', maxWidth: 220, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 6 }}>
        {label}
      </div>
      {sorted.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: 2, background: p.fill || p.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#CBD5E1' }}>{p.name}</span>
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#FFF' }}>{p.value.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  )
}

function ChartCard({ title, subtitle, height = 260, children, action }: {
  title: string; subtitle?: string; height?: number; children: React.ReactNode; action?: React.ReactNode
}) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '20px 22px', border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      <div style={{ height }}>{children}</div>
    </div>
  )
}

// Treemap content renderer
function TreemapContent({ x, y, width, height, name, root, value, color }: any) {
  if (width < 30 || height < 20) return null
  return (
    <g>
      <rect x={x + 1} y={y + 1} width={width - 2} height={height - 2} style={{ fill: color, stroke: '#fff', strokeWidth: 2, fillOpacity: 0.85, borderRadius: 6 }} rx={4} />
      {width > 60 && height > 30 && (
        <text x={x + width / 2} y={y + height / 2 - 5} textAnchor="middle" fill="#fff" fontSize={11} fontWeight={700} dy={5}>
          {name?.slice(0, 14)}
        </text>
      )}
      {width > 60 && height > 44 && (
        <text x={x + width / 2} y={y + height / 2 + 12} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize={9} dy={5}>
          {value?.toFixed(1)}%
        </text>
      )}
    </g>
  )
}

export default function KeywordSovPage() {
  const { campaigns, activeCampaignId, fetchCampaigns } = useCampaignStore()
  const [lang, setLang] = useState('all')
  const [type, setType] = useState('all')
  const [data, setData] = useState<any[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'chart' | 'heatmap' | 'table'>('chart')
  const [moversBrand, setMoversBrand] = useState<string>('')
  const [showWatchlist, setShowWatchlist] = useState(false)
  const [watchlistItems, setWatchlistItems] = useState<string[]>([])
  const [sortKey, setSortKey] = useState<string>('total_videos')
  const [sortDesc, setSortDesc] = useState<boolean>(true)
  const [metrics, setMetrics] = useState<any>({ unique_videos: 0, unique_views: 0, sov_percent: 0, total_keywords: 0 })
  const [campaignOverview, setCampaignOverview] = useState<any>(null)
  const [copiedKw, setCopiedKw] = useState<string | null>(null)
  const [showDemo, setShowDemo] = useState(true)

  const selectedCampaign = campaigns.find(c => c.id === activeCampaignId)

  const fetchSOV = useCallback(async (campId: string, l: string, t: string) => {
    if (!campId) {
      // Use demo data when no campaign is selected
      if (showDemo) {
        setData(DEMO_KEYWORD_SOV)
        setBrands(DEMO_BRANDS)
        setMetrics({ unique_videos: 283, unique_views: 4_820_000, sov_percent: 36.2, total_keywords: DEMO_KEYWORD_SOV.length })
      }
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/keywords/sov?campaign_id=${campId}&language=${l}&type=${t}`)
      const d = await res.json()
      if (d.data && d.data.length > 0) {
        setData(d.data)
        setBrands(d.brandNames ?? [])
        setShowDemo(false)
      } else if (showDemo) {
        // Fallback to demo data if real data is empty
        setData(DEMO_KEYWORD_SOV)
        setBrands(DEMO_BRANDS)
        setMetrics({ unique_videos: 283, unique_views: 4_820_000, sov_percent: 36.2, total_keywords: DEMO_KEYWORD_SOV.length })
      }
    } catch (e) {
      console.error(e)
      if (showDemo) {
        setData(DEMO_KEYWORD_SOV)
        setBrands(DEMO_BRANDS)
        setMetrics({ unique_videos: 283, unique_views: 4_820_000, sov_percent: 36.2, total_keywords: DEMO_KEYWORD_SOV.length })
      }
    }
    finally { setLoading(false) }
  }, [showDemo])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])
  useEffect(() => {
    if (activeCampaignId) fetchSOV(activeCampaignId, lang, type)
    else fetchSOV('', lang, type) // Load demo data when no campaign
  }, [activeCampaignId, lang, type, fetchSOV])

  const fetchOverview = useCallback(async (campId: string, brandName?: string) => {
    try {
      if (brandName) {
        const enc = encodeURIComponent(brandName)
        const res = await fetch(`/api/client/overview?campaign_id=${campId}&brand_name=${enc}`)
        const d = await res.json()
        setMetrics(d?.metrics || { unique_videos: 0, unique_views: 0, sov_percent: 0, total_keywords: 0 })
      }
      try {
        const cRes = await fetch(`/api/overview?campaign_id=${campId}`)
        const cd = await cRes.json()
        setCampaignOverview(cd || null)
      } catch (e) {
        setCampaignOverview(null)
      }
    } catch (e) { console.error('overview fetch', e) }
  }, [])

  useEffect(() => {
    if (activeCampaignId) fetchOverview(activeCampaignId, moversBrand || brands[0])
  }, [activeCampaignId, moversBrand, brands, fetchOverview])

  // sync movers brand when brands list updates
  useEffect(() => {
    if (brands && brands.length > 0) setMoversBrand(prev => prev || brands[0])
  }, [brands])

  // load watchlist from localStorage
  useEffect(() => {
    try {
      const items = JSON.parse(localStorage.getItem('sov_watchlist') || '[]') as string[]
      setWatchlistItems(items)
    } catch { setWatchlistItems([]) }
  }, [])

  // Helpers: export CSV, refresh data, add to watchlist
  const exportCSV = () => {
    if (!data || data.length === 0) return alert('No data to export')
    const headers = ['keyword', 'total_videos', ...brands, 'Other']
    const rows = data.map((d: any) => [
      `"${d.keyword.replace(/"/g, '""')}"`,
      d.total_videos ?? 0,
      ...brands.map(b => (d[b] ?? 0).toFixed ? (d[b] ?? 0).toFixed(1) : (d[b] ?? 0)),
      (d.Other ?? 0).toFixed ? (d.Other ?? 0).toFixed(1) : (d.Other ?? 0),
    ].join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `keyword_sov_${activeCampaignId || 'campaign'}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const exportKPIs = () => {
    const rows: string[] = []
    const header = ['metric', 'value']
    rows.push(header.join(','))
    // metrics (brand unique)
    rows.push([`Unique Videos`, String(metrics.unique_videos)].join(','))
    rows.push([`Unique Views`, String(metrics.unique_views)].join(','))
    rows.push([`SOV Percent`, String(metrics.sov_percent)].join(','))
    rows.push([`Tracked Keywords`, String(metrics.total_keywords)].join(','))
    // campaign level if present
    if (campaignOverview) {
      rows.push([`Campaign Total Videos`, String(campaignOverview.totalVideos || 0)].join(','))
      rows.push([`Campaign Total Views`, String(campaignOverview.totalViewership || 0)].join(','))
      rows.push([`Campaign Total Keywords`, String(campaignOverview.totalKeywords || 0)].join(','))
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `keyword_sov_kpis_${activeCampaignId || 'campaign'}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const onRefresh = () => {
    if (!activeCampaignId) return alert('Select a campaign to refresh')
    fetchSOV(activeCampaignId, lang, type)
  }

  const addToWatchlist = () => {
    if (!data || data.length === 0) return alert('No keywords to add')
    const primary = brands[0] ?? null
    const top = data.slice(0, 10).map((d: any) => d.keyword)
    const existing = JSON.parse(localStorage.getItem('sov_watchlist') || '[]') as string[]
    const merged = Array.from(new Set([...existing, ...top]))
    localStorage.setItem('sov_watchlist', JSON.stringify(merged))
    setWatchlistItems(merged)
    setShowWatchlist(true)
  }

  const removeFromWatchlist = (kw: string) => {
    const next = (watchlistItems || []).filter(w => w !== kw)
    localStorage.setItem('sov_watchlist', JSON.stringify(next))
    setWatchlistItems(next)
  }

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 12 }}>
      <Loader2 size={32} style={{ color: '#1A73E8', animation: 'spin 1s linear infinite' }} />
      <div style={{ fontSize: 13.5, color: '#64748B', fontWeight: 600 }}>Loading keyword SOV data…</div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  const chartHeight = Math.max(320, data.length * 60)
  const allOther = data.length > 0 && data.every(item => Number(item.Other) === 100)

  // Compute brand dominance: which brand dominates each keyword
  const dominance: Record<string, number> = {}
  brands.forEach(b => { dominance[b] = 0 })
  data.forEach(kw => {
    const maxBrand = brands.reduce((best, b) => (Number(kw[b] ?? 0) > Number(kw[best] ?? 0) ? b : best), brands[0])
    if (maxBrand) dominance[maxBrand] = (dominance[maxBrand] ?? 0) + 1
  })

  // Donut: brand keyword dominance
  const dominancePie = brands.map((b, i) => ({
    name: b, value: dominance[b] ?? 0, color: COLORS[i % COLORS.length]
  })).filter(d => d.value > 0)

  // Avg SOV per brand across all keywords
  const avgSov = brands.map((b, i) => ({
    brand: b.slice(0, 14),
    avg: data.length > 0 ? data.reduce((s, kw) => s + Number(kw[b] ?? 0), 0) / data.length : 0,
    color: COLORS[i % COLORS.length],
  })).sort((a, b) => b.avg - a.avg)

  // Treemap: top keywords by total_videos
  const treemapData = data
    .filter(d => (d.total_videos ?? 0) > 0)
    .map((d, i) => ({
      name: d.keyword,
      value: d.total_videos ?? 0,
      size: d.total_videos ?? 1,
      color: COLORS[i % COLORS.length],
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 20)

  // Keyword KPI cards
  const topKeyword = data.slice().sort((a, b) => (b.total_videos ?? 0) - (a.total_videos ?? 0))[0]
  const mostContested = data.slice().sort((a, b) => {
    const countA = brands.filter(br => (a[br] ?? 0) > 5).length
    const countB = brands.filter(br => (b[br] ?? 0) > 5).length
    return countB - countA
  })[0]

  const sortedData = data.slice().sort((a, b) => {
    const av = Number(a[sortKey] ?? 0)
    const bv = Number(b[sortKey] ?? 0)
    return sortDesc ? bv - av : av - bv
  })

  return (
    <div className="anim-fade-up">
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Keyword-wise <span className="accent">SOV</span></h1>
          <p className="page-subtitle">Brand dominance per keyword, heatmap analysis, and competitive breakdown</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, padding: 2, gap: 1 }}>
            <button onClick={() => setViewMode('chart')} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: viewMode === 'chart' ? '#1A73E8' : 'transparent', color: viewMode === 'chart' ? '#FFF' : '#475569', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Chart</button>
            <button onClick={() => setViewMode('heatmap')} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: viewMode === 'heatmap' ? '#1A73E8' : 'transparent', color: viewMode === 'heatmap' ? '#FFF' : '#475569', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Heatmap</button>
            <button onClick={() => setViewMode('table')} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: viewMode === 'table' ? '#1A73E8' : 'transparent', color: viewMode === 'table' ? '#FFF' : '#475569', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Table</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={onRefresh} className="btn btn-outline" style={{ padding: '8px 12px', borderRadius: 9, background: 'transparent', cursor: 'pointer' }}>Refresh</button>
            <button onClick={exportCSV} className="btn btn-ghost" style={{ padding: '8px 12px', borderRadius: 9, background: 'transparent', cursor: 'pointer' }}>Export CSV</button>
            <button onClick={addToWatchlist} className="btn btn-primary" style={{ padding: '8px 12px', borderRadius: 9, background: '#1A73E8', color: '#FFF', cursor: 'pointer' }}>Add to watchlist</button>
            </div>
          </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 6 }}>Language</label>
          <select className="input" style={{ width: 180 }} value={lang} onChange={e => setLang(e.target.value)}>
            {LANGUAGE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 6 }}>Keyword Type</label>
          <select className="input" style={{ width: 180 }} value={type} onChange={e => setType(e.target.value)}>
            {TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Demo Mode Banner */}
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
              Showing keyword SOV data for 5 brands across 15 tracked keywords. Real data will replace this once a campaign is selected.
            </div>
          </div>
          <button
            onClick={() => setShowDemo(false)}
            style={{ display:'flex',alignItems:'center',gap:6,padding:'6px 13px',borderRadius:8,cursor:'pointer',background:'#FEF2F2',border:'1px solid #FECACA',color:'#DC2626',fontSize:12,fontWeight:700,flexShrink:0,fontFamily:'inherit' }}
          >
            🗑 Clear Demo
          </button>
        </div>
      )}
      {!showDemo && (
        <div style={{ display:'flex',justifyContent:'flex-end',marginBottom:12 }}>
          <button onClick={()=>setShowDemo(true)} style={{ display:'flex',alignItems:'center',gap:6,padding:'6px 13px',borderRadius:8,cursor:'pointer',background:'#F1F5F9',border:'1px solid #E2E8F0',color:'#475569',fontSize:12,fontWeight:600,fontFamily:'inherit' }}>
            🧪 Show Demo Data
          </button>
        </div>
      )}

      {/* Banner: all Other */}
      {allOther && !showDemo && (
        <div style={{ display: 'flex', gap: 12, padding: '16px 20px', borderRadius: 12, background: 'rgba(26,115,232,0.06)', border: '1px solid rgba(26,115,232,0.18)', marginBottom: 20, alignItems: 'center' }}>
          <RefreshCw size={20} style={{ color: '#1A73E8', flexShrink: 0, animation: 'spin 12s linear infinite' }} />
          <div style={{ fontSize: 13, color: '#1E3A8A', lineHeight: 1.5 }}>
            <strong>Waiting for Tagging Match:</strong> Run a scrape or check brand spellings in{' '}
            <Link href="/control" style={{ fontWeight: 700, color: '#1A73E8', textDecoration: 'underline' }}>Campaign Control</Link>.
          </div>
        </div>
      )}

      {data.length === 0 ? (
        <div style={{ display: 'flex', gap: 12, padding: 28, borderRadius: 14, background: '#FFFFFF', border: '1px solid #F1F5F9', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <AlertCircle size={32} style={{ color: '#94A3B8', marginBottom: 8 }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>No Keyword SOV Data Available</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>Add keywords and execute a scrape job to generate SOV statistics.</div>
        </div>
      ) : (
        <>
          {/* ── Top Movers (quick) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={{ background: '#FFFFFF', borderRadius: 12, padding: 12, border: '1px solid #F1F5F9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Top dominated keywords</div>
                    {moversBrand && <div style={{ fontSize: 12, color: '#475569', background: '#F1F5F9', padding: '4px 8px', borderRadius: 999 }}>{moversBrand}</div>}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>Highest SOV for selected brand</div>
                </div>
                <div>
                  <select className="input" value={moversBrand} onChange={e => setMoversBrand(e.target.value)} style={{ padding: '6px 10px' }}>
                    {brands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {data.slice().sort((a, b) => ((b[moversBrand] ?? 0) - (a[moversBrand] ?? 0))).slice(0,3).map((k: any, i: number) => (
                  <li key={k.keyword} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 6px', borderBottom: i < 2 ? '1px solid #F8FAFC' : 'none', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{k.keyword}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{(k.total_videos ?? 0)} videos</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ color: '#1A73E8', fontWeight: 800 }}>{((k[moversBrand] ?? 0)).toFixed(1)}%</span>
                      <button onClick={() => { navigator.clipboard?.writeText(k.keyword); setCopiedKw(k.keyword); setTimeout(() => setCopiedKw(null), 1500) }} style={{ fontSize: 11, padding: '6px 10px', borderRadius: 6, border: 'none', background: '#F1F5F9', cursor: 'pointer' }}>{copiedKw === k.keyword ? 'Copied' : 'Copy'}</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ background: '#FFFFFF', borderRadius: 12, padding: 12, border: '1px solid #F1F5F9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Least dominated keywords</div>
                    {moversBrand && <div style={{ fontSize: 12, color: '#475569', background: '#F1F5F9', padding: '4px 8px', borderRadius: 999 }}>{moversBrand}</div>}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>Lowest SOV for selected brand</div>
                </div>
                <div>
                  <button onClick={() => exportCSV()} style={{ padding: '6px 10px', borderRadius: 8, background: 'transparent', border: '1px solid #E2E8F0', cursor: 'pointer' }}>Export movers</button>
                </div>
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {data.slice().sort((a, b) => ((a[moversBrand] ?? 0) - (b[moversBrand] ?? 0))).slice(0,3).map((k: any, i: number) => (
                  <li key={k.keyword} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 6px', borderBottom: i < 2 ? '1px solid #F8FAFC' : 'none', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{k.keyword}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{(k.total_videos ?? 0)} videos</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ color: '#EF4444', fontWeight: 800 }}>{((k[moversBrand] ?? 0)).toFixed(1)}%</span>
                      <button onClick={() => removeFromWatchlist(k.keyword)} style={{ fontSize: 11, padding: '6px 10px', borderRadius: 6, border: 'none', background: '#F1F5F9', cursor: 'pointer' }}>Remove</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ── KPI Highlights Strip ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div style={{ background: '#FFFFFF', borderRadius: 12, padding: '14px 16px', border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Hash size={14} style={{ color: '#1A73E8' }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Keywords tracked</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', fontFamily: "'JetBrains Mono',monospace" }}>{campaignOverview?.totalKeywords ?? data.length}</div>
            </div>
            <div style={{ background: '#FFFFFF', borderRadius: 12, padding: '14px 16px', border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Target size={14} style={{ color: '#10B981' }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Top keyword</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topKeyword?.keyword ?? '—'}</div>
              <div style={{ fontSize: 10.5, color: '#10B981', fontWeight: 600, marginTop: 2 }}>{topKeyword?.total_videos ?? campaignOverview?.totalVideos ?? 0} videos ranked</div>
            </div>
            <div style={{ background: '#FFFFFF', borderRadius: 12, padding: '14px 16px', border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#FDF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BarChart2 size={14} style={{ color: '#8B5CF6' }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Avg brand SOV</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', fontFamily: "'JetBrains Mono',monospace" }}>
                {metrics?.sov_percent ? `${metrics.sov_percent.toFixed(1)}%` : (avgSov.length > 0 ? `${avgSov[0].avg.toFixed(1)}%` : '—')}
              </div>
              <div style={{ fontSize: 10.5, color: '#8B5CF6', fontWeight: 600, marginTop: 2 }}>{avgSov[0]?.brand} leads</div>
            </div>
            <div style={{ background: '#FFFFFF', borderRadius: 12, padding: '14px 16px', border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RefreshCw size={14} style={{ color: '#F59E0B' }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Most contested</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mostContested?.keyword ?? '—'}</div>
              <div style={{ fontSize: 10.5, color: '#F59E0B', fontWeight: 600, marginTop: 2 }}>
                {mostContested ? brands.filter(b => (mostContested[b] ?? 0) > 5).length : 0} brands competing
              </div>
            </div>
          </div>

          {/* Watchlist panel (local) */}
          {showWatchlist && (
            <div style={{ background: '#FFFFFF', borderRadius: 12, padding: 16, border: '1px solid #F1F5F9', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Watchlist</div>
                <div style={{ fontSize: 12, color: '#64748B' }}>{watchlistItems.length} keywords</div>
              </div>
              {watchlistItems.length === 0 ? (
                <div style={{ color: '#94A3B8' }}>No keywords in watchlist</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                  {watchlistItems.map(w => (
                    <div key={w} style={{ padding: '8px 10px', borderRadius: 8, background: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700 }}>{w}</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => { navigator.clipboard?.writeText(w); alert('Copied') }} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer' }}>Copy</button>
                        <button onClick={() => removeFromWatchlist(w)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: 'none', background: 'transparent', color: '#EF4444', cursor: 'pointer' }}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Analytics Row: Avg SOV + Dominance Pie ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 20 }}>

            {/* Avg SOV horizontal bar */}
            <ChartCard title="Average SOV per brand" subtitle="Mean share of voice across all tracked keywords" height={200}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={avgSov} layout="vertical" margin={{ top: 4, right: 50, left: 60, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                  <XAxis type="number" unit="%" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} domain={[0, 100]} ticks={[0,25,50,75,100]} tickFormatter={(v:any)=>`${v}%`} />
                  <YAxis type="category" dataKey="brand" tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'Avg SOV']} contentStyle={{ background: '#1E293B', border: 'none', borderRadius: 8, fontSize: 11 }} labelStyle={{ color: '#94A3B8' }} itemStyle={{ color: '#FFF' }} />
                  <Bar dataKey="avg" radius={[0, 6, 6, 0]} barSize={18}>
                    {avgSov.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Keyword Dominance Donut */}
            {dominancePie.length > 0 && (
              <ChartCard title="Keyword dominance" subtitle="How many keywords each brand dominates" height={200}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dominancePie} dataKey="value" nameKey="name" cx="40%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3}>
                      {dominancePie.map((d, i) => <Cell key={i} fill={d.color} stroke="transparent" />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [`${v} keywords`, 'Dominates']} contentStyle={{ background: '#1E293B', border: 'none', borderRadius: 8, fontSize: 11 }} labelStyle={{ color: '#94A3B8' }} itemStyle={{ color: '#FFF' }} />
                    <Legend iconType="circle" layout="horizontal" align="left" verticalAlign="top" wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          {/* ── Treemap: Keyword Volume ── */}
          {treemapData.length > 0 && (
            <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '20px 22px', border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Keyword volume treemap</div>
              <div style={{ fontSize: 11.5, color: '#94A3B8', marginBottom: 16 }}>Top keywords by video count — larger block = more ranked videos</div>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <Treemap
                    data={treemapData}
                    dataKey="size"
                    aspectRatio={4 / 3}
                    content={<TreemapContent />}
                  />
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Main chart: stacked horizontal bars or heatmap ── */}
          {viewMode === 'chart' ? (
            <div className="card" style={{ padding: '24px 20px', marginBottom: 20 }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Keyword-wise brand SOV — stacked breakdown</div>
                <div style={{ fontSize: 11.5, color: '#94A3B8' }}>Horizontal stacked bars showing SOV % share per brand for each keyword</div>
              </div>
              <div style={{ height: chartHeight }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 60, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                    <XAxis type="number" unit="%" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} ticks={[0,25,50,75,100]} tickFormatter={(v:any)=>`${v}%`} />
                    <YAxis
                      dataKey="keyword"
                      type="category"
                      tick={({ x, y, payload }) => {
                        const matched = data.find(d => d.keyword === payload.value)
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text x={-10} y={0} dy={4} textAnchor="end" fill="#1E293B" fontSize={11.5} fontWeight={600}>
                              {payload.value}
                            </text>
                            {matched?.total_videos !== undefined && (
                              <text x={-10} y={14} dy={4} textAnchor="end" fill="#94A3B8" fontSize={9.5} fontWeight={500}>
                                ({matched.total_videos} videos)
                              </text>
                            )}
                          </g>
                        )
                      }}
                      axisLine={false}
                      tickLine={false}
                      width={300}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(26,115,232,0.02)' }} />
                    <Legend iconType="circle" layout="horizontal" verticalAlign="top" align="right" wrapperStyle={{ paddingTop: 8, fontSize: 12 }} />
                    {brands.map((bName, index) => (
                      <Bar key={bName} dataKey={bName} name={bName} stackId="a" fill={COLORS[index % COLORS.length]} barSize={16}
                        radius={index === brands.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]} />
                    ))}
                    <Bar key="Other" dataKey="Other" name="Other" stackId="a" fill="#E2E8F0" barSize={16} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : viewMode === 'heatmap' ? (
            <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '18px 18px', border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 20, overflowX: 'auto' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Keyword × brand SOV heatmap</div>
              <div style={{ fontSize: 11.5, color: '#94A3B8', marginBottom: 16 }}>Color intensity shows SOV % — darker = higher dominance</div>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 3, minWidth: 500 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', minWidth: 140 }}>Keyword</th>
                    {brands.map((b, bi) => (
                      <th key={b} style={{ padding: '8px 8px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: COLORS[bi % COLORS.length], minWidth: 80 }}>{b.slice(0, 10)}</th>
                    ))}
                    <th style={{ padding: '8px 8px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#94A3B8', minWidth: 60 }}>Other</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((kw, ki) => (
                    <tr key={kw.keyword}>
                      <td style={{ padding: '6px 12px', fontWeight: 600, fontSize: 12, color: '#1E293B', whiteSpace: 'nowrap' }}>
                        <div>{kw.keyword}</div>
                        {kw.total_videos !== undefined && <div style={{ fontSize: 9.5, color: '#94A3B8', fontWeight: 500 }}>{kw.total_videos} videos</div>}
                      </td>
                      {brands.map((b, bi) => {
                        const val = Number(kw[b] ?? 0)
                        const color = COLORS[bi % COLORS.length]
                        const opacity = Math.max(0.04, Math.min(1, val / 100))
                        const barWidth = `${Math.round(opacity * 100)}%`
                        return (
                          <td key={b} style={{ padding: '6px 8px', textAlign: 'center' }} title={`${b}: ${val.toFixed(1)}%`}>
                            <div style={{ width: '100%', height: 34, borderRadius: 6, background: '#F8FAFC', display: 'flex', alignItems: 'center' }}>
                              <div style={{ height: '80%', borderRadius: 6, background: color, width: barWidth, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 11 }}>
                                {val > 0 ? `${val.toFixed(0)}%` : ''}
                              </div>
                            </div>
                          </td>
                        )
                      })}
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: '100%', height: 32, borderRadius: 6,
                          background: Number(kw.Other ?? 0) > 0 ? `#94A3B820` : '#F8FAFC',
                          fontSize: 11, fontWeight: 600, color: '#94A3B8',
                        }}>
                          {Number(kw.Other ?? 0) > 0 ? `${Number(kw.Other).toFixed(0)}%` : '—'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '18px 18px', border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 20, overflowX: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Keyword table</div>
                  <div style={{ fontSize: 11.5, color: '#94A3B8' }}>Sortable table view with exact values — useful for exports and quick filtering</div>
                </div>
                <div>
                  <button onClick={() => exportCSV()} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'transparent', cursor: 'pointer' }}>Export CSV</button>
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: '#64748B' }}>Keyword</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 12, color: '#64748B', cursor: 'pointer' }} onClick={() => { setSortKey('total_videos'); setSortDesc(prev => sortKey === 'total_videos' ? !prev : true) }}>Videos {sortKey === 'total_videos' ? (sortDesc ? '▼' : '▲') : ''}</th>
                    {brands.map(b => (
                      <th key={b} style={{ textAlign: 'right', padding: '10px 12px', fontSize: 12, color: '#64748B', cursor: 'pointer' }} onClick={() => { setSortKey(b); setSortDesc(prev => sortKey === b ? !prev : true) }}>{b.slice(0,10)} {sortKey === b ? (sortDesc ? '▼' : '▲') : ''}</th>
                    ))}
                    <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 12, color: '#64748B' }}>Other</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((kw: any) => (
                    <tr key={kw.keyword} style={{ borderTop: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{kw.keyword}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{kw.total_videos ?? 0}</td>
                      {brands.map(b => (
                        <td key={b} style={{ padding: '10px 12px', textAlign: 'right', color: '#0F172A', fontWeight: 700 }}>{(Number(kw[b] ?? 0)).toFixed(1)}%</td>
                      ))}
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748B' }}>{(Number(kw.Other ?? 0)).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
