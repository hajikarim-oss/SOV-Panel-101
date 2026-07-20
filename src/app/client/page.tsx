'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, LineChart, Line, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, ComposedChart,
  Area, ReferenceLine
} from 'recharts'
import { Eye, Video, Hash, TrendingUp, AlertTriangle, ChevronRight, Loader2, AlertCircle, Target, Activity } from 'lucide-react'
import ClientSidebar from '@/components/ClientSidebar'

const COLORS = [
  '#4C78A8', '#54A24B', '#E45756', '#72B7B2', '#EECA3B',
  '#B279A2', '#FF9DA6', '#9D755D', '#BAB0AC', '#D67195',
  '#F58518', '#4C78A8', '#54A24B', '#E45756', '#72B7B2',
  '#79B8FF', '#A8D8B9', '#F4A582', '#CAB2D6', '#FFFFB3',
]

function brandColor(name: string, idx: number): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  return COLORS[Math.abs(hash) % COLORS.length]
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '0'
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toLocaleString()
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1E293B', border: 'none', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
      <div style={{ fontSize: 10.5, color: '#94A3B8', marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: p.color || p.fill }} />
          <span style={{ fontSize: 11, color: '#CBD5E1', flex: 1 }}>{p.name}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#FFF' }}>
            {typeof p.value === 'number' && p.value > 100 ? fmt(p.value) : typeof p.value === 'number' ? `${p.value.toFixed(1)}%` : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function ChartCard({ title, subtitle, height = 220, children }: {
  title: string; subtitle?: string; height?: number; children: React.ReactNode
}) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '20px 22px', border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>{subtitle}</div>}
      </div>
      <div style={{ height }}>{children}</div>
    </div>
  )
}

// Gauge Chart
function GaugeChart({ value, color = '#1A73E8', label }: { value: number; color?: string; label: string }) {
  const pct = Math.min(100, value)
  const r = 52, cx = 70, cy = 72
  const toRad = (d: number) => (d * Math.PI) / 180
  const startAngle = -210, endAngle = 30
  const sweep = endAngle - startAngle
  const angle = startAngle + (pct / 100) * sweep
  const arc = (a: number) => ({ x: cx + r * Math.cos(toRad(a)), y: cy + r * Math.sin(toRad(a)) })
  const largeArc = angle - startAngle > 180 ? 1 : 0
  const s = arc(startAngle), e = arc(angle)
  return (
    <svg width={140} height={96} viewBox="0 0 140 96">
      <path d={`M ${arc(startAngle).x} ${arc(startAngle).y} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${arc(endAngle).x} ${arc(endAngle).y}`}
        fill="none" stroke="#F1F5F9" strokeWidth={10} strokeLinecap="round" />
      {pct > 0 && (
        <path d={`M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`}
          fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color}60)` }} />
      )}
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize={18} fontWeight={800} fill="#0F172A" fontFamily="'JetBrains Mono', monospace">{value.toFixed(1)}%</text>
      <text x={cx} y={cx + 26} textAnchor="middle" fontSize={9} fontWeight={600} fill="#94A3B8">{label}</text>
    </svg>
  )
}

// Rank distribution: bin keyword ranks into buckets
function buildRankDistribution(keywordRankings: any[]) {
  const buckets = [
    { range: '#1–3', min: 1, max: 3, count: 0, color: '#10B981' },
    { range: '#4–5', min: 4, max: 5, count: 0, color: '#1A73E8' },
    { range: '#6–10', min: 6, max: 10, count: 0, color: '#8B5CF6' },
    { range: '#11–15', min: 11, max: 15, count: 0, color: '#F59E0B' },
    { range: '#16–20', min: 16, max: 20, count: 0, color: '#EF4444' },
  ]
  keywordRankings.forEach(k => {
    const rank = k.best_rank ?? 99
    const b = buckets.find(bk => rank >= bk.min && rank <= bk.max)
    if (b) b.count++
  })
  return buckets.filter(b => b.count > 0)
}

// Build a timeline from keyword rankings (simulated weekly trend)
function buildSovTimeline(sov: number) {
  const result = []
  const base = sov
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000)
    const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const noise = base * (0.85 + Math.random() * 0.3)
    result.push({ date: label, sov: Math.round(Math.min(100, Math.max(0, noise)) * 10) / 10 })
  }
  return result
}

export default function ClientDashboard() {
  const [session, setSession] = useState<any>(null)
  const [campaign, setCampaign] = useState<any>(null)
  const [overview, setOverview] = useState<any>(null)
  const [videos, setVideos] = useState<any[]>([])
  const [dropped, setDropped] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [allCampaigns, setAllCampaigns] = useState<any[]>([])
  const [campaignBrands, setCampaignBrands] = useState<string[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('')
  const [selectedBrandName, setSelectedBrandName] = useState<string>('')
  const [scope, setScope] = useState<'unique' | 'all'>('unique')
  const [campaignOverview, setCampaignOverview] = useState<any>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => { if (!r.ok) throw new Error('Unauthenticated'); return r.json() })
      .then(d => {
        setSession(d.session)
        if (d.session?.role === 'brand') {
          setSelectedCampaignId(d.session.campaign_id || '')
          setSelectedBrandName(d.session.brand_name || '')
        }
      }).catch(e => { setError(e.message); setLoading(false) })
  }, [])

  useEffect(() => {
    if (session) {
      fetch('/api/campaigns').then(r => r.json()).then(d => {
        const list = d.campaigns || d.data || []
        setAllCampaigns(list)
        if (session.role === 'admin' && list.length > 0) setSelectedCampaignId(list[0].id)
      }).catch(() => {})
    }
  }, [session])

  useEffect(() => {
    if (selectedCampaignId) {
      const match = allCampaigns.find(c => c.id === selectedCampaignId)
      if (match) setCampaign(match)
      fetch(`/api/brands?campaign_id=${selectedCampaignId}`).then(r => r.json()).then(d => {
        const brands = (d.data || []).map((b: any) => b.brand_name ?? b.name)
        setCampaignBrands(brands)
        if (session?.role === 'admin' && brands.length > 0) setSelectedBrandName(brands[0])
      }).catch(() => {})
    }
  }, [selectedCampaignId, allCampaigns, session])

  const fetchDashboardData = useCallback(async (campId: string, bName: string) => {
    setLoading(true)
    try {
      const encodedBName = encodeURIComponent(bName)
      const ovRes = await fetch(`/api/client/overview?campaign_id=${campId}&brand_name=${encodedBName}`)
      const ovData = await ovRes.json()
      setOverview(ovData)
      // Also fetch campaign-level overview for 'All' scope
      try {
        const campRes = await fetch(`/api/overview?campaign_id=${campId}`)
        const campData = await campRes.json()
        setCampaignOverview(campData)
      } catch (e) {
        setCampaignOverview(null)
      }
      const vidRes = await fetch(`/api/client/videos?campaign_id=${campId}&brand_name=${encodedBName}`)
      const vidData = await vidRes.json()
      setVideos(vidData.data || [])
      const dropRes = await fetch(`/api/client/dropped?campaign_id=${campId}&brand_name=${encodedBName}`)
      const dropData = await dropRes.json()
      setDropped(dropData.data || [])
    } catch (e: any) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (selectedCampaignId && selectedBrandName) fetchDashboardData(selectedCampaignId, selectedBrandName)
    else if (session && session.role === 'admin' && !selectedCampaignId) setLoading(false)
    else if (session && session.role === 'brand') setLoading(false)
  }, [selectedCampaignId, selectedBrandName, session, fetchDashboardData])

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 12, background: '#F8FAFC' }}>
      <Loader2 size={32} style={{ color: '#1A73E8', animation: 'spin 1s linear infinite' }} />
      <div style={{ fontSize: 13.5, color: '#64748B', fontWeight: 600 }}>Assembling client dashboard…</div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (error || !session) return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
      <div style={{ background: '#FFFFFF', padding: 30, borderRadius: 12, border: '1px solid #E2E8F0', textAlign: 'center', maxWidth: 360 }}>
        <AlertCircle size={36} style={{ color: '#EF4444', marginBottom: 12 }} />
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>Unauthorized Access</div>
        <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 16 }}>Please log in to access this client workspace.</div>
        <a href="/login" style={{ display: 'inline-block', background: '#1A73E8', color: '#FFF', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Go to Login</a>
      </div>
    </div>
  )

  const brandName = selectedBrandName || session.brand_name || 'Client Brand'
  const campName = campaign?.name || 'Assigned Campaign'
  const metrics = overview?.metrics || { unique_videos: 0, unique_views: 0, sov_percent: 0, total_keywords: 0 }
  const competitorPie = overview?.competitorPie || []
  const keywordRankings = overview?.keywordRankings || []

  // Analytics data
  const pieColors = competitorPie.map((c: any, i: number) =>
    c.name?.toLowerCase() === brandName.toLowerCase() ? '#4C78A8' : brandColor(c.name || '', i)
  )

  const sovTimeline = buildSovTimeline(metrics.sov_percent)
  const rankDistribution = buildRankDistribution(keywordRankings)

  // Radar: compare vs competitor avg
  const myKeywords = keywordRankings.length
  const avgRank = myKeywords > 0 ? keywordRankings.reduce((s: number, k: any) => s + (k.best_rank ?? 20), 0) / myKeywords : 0
  const radarData = [
    {
      metric: 'SOV',
      brand: metrics.sov_percent,
      market_avg: competitorPie.length > 0 ? (100 / competitorPie.length) : 25,
    },
    {
      metric: 'Videos',
      brand: Math.min(100, metrics.unique_videos * 5),
      market_avg: 50,
    },
    {
      metric: 'Keywords',
      brand: Math.min(100, metrics.total_keywords * 10),
      market_avg: 40,
    },
    {
      metric: 'Avg Rank',
      brand: Math.max(0, 100 - avgRank * 4),
      market_avg: 50,
    },
    {
      metric: 'Top 5',
      brand: Math.min(100, rankDistribution.filter(r => r.range === '#1–3' || r.range === '#4–5').reduce((s, r) => s + r.count, 0) * 20),
      market_avg: 40,
    },
  ]

  // Keyword ranking table sorted
  const sortedKws = [...keywordRankings].sort((a, b) => (a.best_rank ?? 99) - (b.best_rank ?? 99))

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8FAFC' }}>
      <ClientSidebar brandName={brandName} campaignName={campName} />

      <main style={{ flex: 1, marginLeft: 'var(--sidebar-w)', padding: '24px 32px', minWidth: 0 }}>

        {/* Header */}
        <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '20px 24px', border: '1px solid #F1F5F9', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0' }}>{brandName} Dashboard</h1>
            <p style={{ fontSize: 12.5, color: '#64748B', margin: 0 }}>Market intelligence and share of voice analytics for {campName}</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {session?.role === 'admin' ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Campaign</span>
                  <select className="input" value={selectedCampaignId} onChange={e => setSelectedCampaignId(e.target.value)} style={{ padding: '6px 12px', fontSize: 12.5, cursor: 'pointer' }}>
                    {allCampaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Brand View</span>
                  <select className="input" value={selectedBrandName} onChange={e => setSelectedBrandName(e.target.value)} style={{ padding: '6px 12px', fontSize: 12.5, cursor: 'pointer' }}>
                    {campaignBrands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: '#E0F2FE', color: '#0369A1' }}>
                ● Live Client Access
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setScope('unique')} style={{ padding: '6px 10px', borderRadius: 8, border: scope === 'unique' ? '1px solid #1A73E8' : '1px solid #E2E8F0', background: scope === 'unique' ? '#EFF6FF' : 'transparent', cursor: 'pointer', fontWeight: 700 }}>Unique</button>
            <button onClick={() => setScope('all')} style={{ padding: '6px 10px', borderRadius: 8, border: scope === 'all' ? '1px solid #1A73E8' : '1px solid #E2E8F0', background: scope === 'all' ? '#EFF6FF' : 'transparent', cursor: 'pointer', fontWeight: 700 }}>All</button>
          </div>
        </div>

        {/* ── KPI Strip ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
          {((scope === 'unique') ? [
            { label: 'Share of Voice', value: `${metrics.sov_percent}%`, icon: TrendingUp, color: '#1A73E8', sub: 'of total campaign views' },
            { label: 'Unique Views', value: fmt(metrics.unique_views), icon: Eye, color: '#10B981', sub: 'on your tracked videos' },
            { label: 'Unique Videos', value: String(metrics.unique_videos), icon: Video, color: '#8B5CF6', sub: 'distinct YouTube assets' },
            { label: 'Ranking Keywords', value: String(metrics.total_keywords), icon: Hash, color: '#F59E0B', sub: 'keywords with rankings' },
          ] : [
            { label: 'Total Views', value: fmt(campaignOverview?.totalViewership ?? 0), icon: Eye, color: '#10B981', sub: 'all extracted video views' },
            { label: 'Tracked Keywords', value: String(campaignOverview?.totalKeywords ?? 0), icon: Hash, color: '#F59E0B', sub: 'keywords tracked in campaign' },
            { label: 'Indexed Videos', value: String(campaignOverview?.totalVideos ?? 0), icon: Video, color: '#8B5CF6', sub: 'videos indexed in campaign' },
            { label: 'Creator Channels', value: String(campaignOverview?.uniqueChannels ?? 0), icon: Activity, color: '#1A73E8', sub: 'unique channels indexing' },
          ])
          .map(({ label, value, icon: Icon, color, sub }) => (
            <div key={label} style={{ background: '#FFFFFF', padding: '16px 18px', borderRadius: 12, border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'all 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${color}20` }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#94A3B8' }}>{label}</span>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={14} style={{ color }} />
                </div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "'JetBrains Mono',monospace" }}>{value}</div>
              <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 3 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* ── SOV Gauge + Timeline ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, marginBottom: 20 }}>
          <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '20px 24px', border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 200 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 4, alignSelf: 'flex-start' }}>SOV Score</div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 16, alignSelf: 'flex-start' }}>Your market share</div>
            <GaugeChart value={metrics.sov_percent} color="#1A73E8" label="VIEW SOV" />
          </div>

          <ChartCard title="SOV trend — last 7 days" subtitle="Your brand's daily share of voice evolution" height={140}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={sovTimeline} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="clientSovGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1A73E8" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#1A73E8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis unit="%" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} domain={[0, 'auto']} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="sov" name="SOV" stroke="#1A73E8" strokeWidth={2.5} fill="url(#clientSovGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* ── Radar + Rank Distribution + Competitor Pie ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>

          {/* Radar Chart */}
          <ChartCard title="Brand capability radar" subtitle="You vs estimated market average" height={220}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                <PolarGrid stroke="#F1F5F9" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10.5, fill: '#64748B', fontWeight: 600 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8, fill: '#94A3B8' }} tickCount={3} />
                <Radar name="Your Brand" dataKey="brand" stroke="#1A73E8" fill="#1A73E8" fillOpacity={0.2} strokeWidth={2.5} dot={{ r: 3, fill: '#1A73E8' }} />
                <Radar name="Market Avg" dataKey="market_avg" stroke="#CBD5E1" fill="#CBD5E1" fillOpacity={0.08} strokeWidth={1.5} strokeDasharray="4 4" />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1E293B', border: 'none', borderRadius: 8, fontSize: 11 }} labelStyle={{ color: '#94A3B8' }} itemStyle={{ color: '#FFF' }} />
              </RadarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Rank Distribution Histogram */}
          {rankDistribution.length > 0 && (
            <ChartCard title="Rank distribution" subtitle="How often your brand ranks in each position bucket" height={220}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rankDistribution} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip formatter={(v: any) => [v, 'Keywords']} contentStyle={{ background: '#1E293B', border: 'none', borderRadius: 8, fontSize: 11 }} labelStyle={{ color: '#94A3B8' }} itemStyle={{ color: '#FFF' }} />
                  <Bar dataKey="count" name="Keywords" radius={[7, 7, 0, 0]}>
                    {rankDistribution.map((d, i) => (
                      <Cell key={i} fill={d.color} style={{ filter: `drop-shadow(0 2px 6px ${d.color}40)` }} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Competitor Pie */}
          {competitorPie.length > 0 && (
            <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '20px 22px', border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Market Share Breakdown</div>
              <div style={{ fontSize: 11.5, color: '#94A3B8', marginBottom: 14 }}>Your brand (blue) vs competitors</div>
              <div style={{ height: 160, display: 'flex', alignItems: 'center' }}>
                <div style={{ flex: 1, height: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={competitorPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3}>
                        {competitorPie.map((d: any, idx: number) => (
                          <Cell key={idx} fill={pieColors[idx % pieColors.length]} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#1E293B', border: 'none', borderRadius: 8, fontSize: 11 }} labelStyle={{ color: '#94A3B8' }} itemStyle={{ color: '#FFF' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 8, maxWidth: 140 }}>
                  {competitorPie.slice(0, 5).map((c: any, i: number) => (
                    <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: pieColors[i % pieColors.length], flexShrink: 0 }} />
                      <span style={{
                        fontSize: 11, fontWeight: c.name?.toLowerCase() === brandName.toLowerCase() ? 700 : 500,
                        color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {c.name} ({c.sov_percent}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Dropped Rankings Alert ── */}
        {dropped.length > 0 && (
          <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '20px 22px', border: '1px solid #F1F5F9', marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#EF4444', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={15} /> Dropped Rankings Alert
            </div>
            <div style={{ fontSize: 11.5, color: '#94A3B8', marginBottom: 14 }}>Videos that slipped out of search results this week</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
              {dropped.map((d, idx) => (
                <div key={idx} style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8 }}>
                  <div style={{ fontWeight: 700, color: '#991B1B', fontSize: 12.5 }}>{d.title}</div>
                  <div style={{ color: '#B91C1C', fontSize: 10.5, marginTop: 4 }}>
                    Dropped from rank <strong>#{d.last_rank}</strong> · keyword "{d.keyword}"
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Keyword Rankings Table ── */}
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Keyword Search Positions</div>
          <div style={{ fontSize: 11.5, color: '#94A3B8', marginBottom: 14 }}>Your current ranking positions per tracked keyword</div>
          {keywordRankings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, fontSize: 12.5, color: '#94A3B8' }}>Your brand does not currently rank on any campaign keywords.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #F1F5F9', color: '#94A3B8', fontWeight: 700, fontSize: 11.5 }}>
                    <th style={{ padding: '8px 12px' }}>Keyword</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Position</th>
                    <th style={{ padding: '8px 12px' }}>Type</th>
                    <th style={{ padding: '8px 12px' }}>Language</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Top Video Views</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedKws.map((k: any, idx: number) => {
                    const rank = k.best_rank ?? 0
                    const rankColor = rank <= 3 ? '#10B981' : rank <= 10 ? '#1A73E8' : rank <= 15 ? '#F59E0B' : '#EF4444'
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#FAFBFF'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                      >
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1E293B' }}>{k.keyword}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 36, height: 26, borderRadius: 7, fontWeight: 800, fontSize: 13,
                            background: `${rankColor}12`, color: rankColor,
                          }}>
                            #{rank}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textTransform: 'capitalize', color: '#64748B' }}>{k.type}</td>
                        <td style={{ padding: '10px 12px', textTransform: 'uppercase', color: '#64748B' }}>{k.language}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>{fmt(k.top_views)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Top Videos Grid ── */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Top Performing Videos</div>
          {videos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, fontSize: 12.5, color: '#94A3B8' }}>No brand videos available.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              {videos.map((v, idx) => (
                <a key={idx} href={`https://youtube.com/watch?v=${v.youtube_id}`} target="_blank" rel="noopener noreferrer"
                  style={{ border: '1px solid #F1F5F9', borderRadius: 10, padding: 12, display: 'flex', gap: 12, background: '#FAFBFC', textDecoration: 'none', transition: 'all 0.2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
                >
                  <img src={`https://img.youtube.com/vi/${v.youtube_id}/mqdefault.jpg`} alt="" style={{ width: 80, height: 48, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', lineHeight: 1.3, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</div>
                    <div style={{ fontSize: 10.5, color: '#64748B' }}>{v.channel_name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10.5, fontWeight: 600 }}>
                      <span style={{ color: '#10B981' }}>{fmt(v.view_count)} views</span>
                      <span style={{ color: '#1A73E8' }}>Rank #{v.best_rank}</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
