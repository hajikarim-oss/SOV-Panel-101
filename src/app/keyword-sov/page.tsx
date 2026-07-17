'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, PieChart, Pie, Cell
} from 'recharts'
import { useCampaignStore } from '@/lib/store'
import { getClientCache, setClientCache } from '@/lib/cache'
import { AlertCircle, RefreshCw, Hash, Target, BarChart2, Download, Pencil, X, Loader2 } from 'lucide-react'
import { PageSkeleton } from '@/components/PageSkeleton'
import Link from 'next/link'

const COLORS = ['#1A73E8', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899', '#94A3B8']

const LANGUAGE_OPTS = [
  { value: 'all', label: 'All Languages' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'ml', label: 'Malayalam' },
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hinglish' },
  { value: 'kn', label: 'Kannada' },
]

const EDIT_LANG_OPTS = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hinglish' },
  { value: 'kn', label: 'Kannada' },
  { value: 'te', label: 'Telugu' },
  { value: 'ta', label: 'Tamil' },
  { value: 'ml', label: 'Malayalam' },
]

const TYPE_OPTS = [
  { value: 'all', label: 'All Types' },
  { value: 'generic', label: 'Generic' },
  { value: 'branded', label: 'Branded' },
  { value: 'comparison', label: 'Comparison' },
]

const EDIT_TYPE_OPTS = [
  { value: 'generic', label: 'Generic' },
  { value: 'branded', label: 'Branded' },
  { value: 'comparison', label: 'Comparison' },
]

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const sorted = [...payload].filter(p => p.value > 0).sort((a, b) => b.value - a.value)
  return (
    <div style={{ background: '#1E293B', border: 'none', borderRadius: 10, padding: '10px 14px', minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 6 }}>{label}</div>
      {sorted.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: 2, background: p.fill || p.color }} />
            <span style={{ fontSize: 11, color: '#CBD5E1' }}>{p.name}</span>
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#FFF' }}>{p.value.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  )
}

export default function KeywordSovPage() {
  const { campaigns, activeCampaignId, fetchCampaigns } = useCampaignStore()
  const [lang, setLang] = useState('all')
  const [type, setType] = useState('all')
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'ours' | 'theirs'>('all')
  const [data, setData] = useState<any[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'chart' | 'heatmap' | 'table'>('chart')
  const [sortKey, setSortKey] = useState<string>('total_videos')
  const [sortDesc, setSortDesc] = useState<boolean>(true)
  const [metrics, setMetrics] = useState<any>({})
  const [campaignOverview, setCampaignOverview] = useState<any>(null)
  const [editModal, setEditModal] = useState<{ open: boolean; keyword: any }>({ open: false, keyword: null })
  const [editText, setEditText] = useState('')
  const [editLang, setEditLang] = useState('en')
  const [editType, setEditType] = useState('generic')
  const [editSaving, setEditSaving] = useState(false)

  const fetchSOV = useCallback(async (campId: string, l: string, t: string, o?: string) => {
    if (!campId) { setLoading(false); return }
    const ck = `kwsov:${campId}:${l}:${t}:${o ?? 'all'}`
    const cached = getClientCache<any>(ck)
    if (cached) {
      if (cached.data && cached.data.length > 0) {
        setData(cached.data)
        setBrands(cached.brandNames ?? [])
      } else { setData([]); setBrands([]) }
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const ownershipParam = o && o !== 'all' ? `&is_ours=${o === 'ours'}` : ''
      const res = await fetch(`/api/keywords/sov?campaign_id=${campId}&language=${l}&type=${t}${ownershipParam}`)
      const d = await res.json()
      if (d.data && d.data.length > 0) {
        setData(d.data)
        setBrands(d.brandNames ?? [])
      } else { setData([]); setBrands([]) }
      setClientCache(ck, d)
    } catch (e) { console.error(e); setData([]); setBrands([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])
  useEffect(() => {
    if (activeCampaignId) fetchSOV(activeCampaignId, lang, type, ownershipFilter)
    else { setLoading(false); setData([]); setBrands([]) }
  }, [activeCampaignId, lang, type, ownershipFilter, fetchSOV])

  useEffect(() => {
    if (!activeCampaignId) return
    const fetchOverview = async () => {
      try {
        const res = await fetch(`/api/overview?campaign_id=${activeCampaignId}`)
        const cd = await res.json()
        setCampaignOverview(cd || null)
      } catch { setCampaignOverview(null) }
    }
    fetchOverview()
  }, [activeCampaignId])

  const openEditModal = (kw: any) => {
    setEditText(kw.keyword || kw.text || '')
    setEditLang(kw.language || 'en')
    setEditType(kw.type || kw.category || 'generic')
    setEditModal({ open: true, keyword: kw })
  }

  const saveEdit = async () => {
    if (!editModal.keyword?.id || !editText.trim()) return
    setEditSaving(true)
    try {
      const res = await fetch('/api/keywords', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editModal.keyword.id,
          text: editText.trim(),
          language: editLang,
          category: editType,
        }),
      })
      if (res.ok) {
        setEditModal({ open: false, keyword: null })
        if (activeCampaignId) fetchSOV(activeCampaignId, lang, type, ownershipFilter)
      }
    } catch (e) { console.error(e) }
    finally { setEditSaving(false) }
  }

  const exportCSV = () => {
    if (!data || data.length === 0) return
    const headers = ['keyword', 'total_videos', ...brands, 'Other']
    const rows = data.map((d: any) => [
      `"${d.keyword.replace(/"/g, '""')}"`,
      d.total_videos ?? 0,
      ...brands.map(b => (d[b] ?? 0).toFixed(1)),
      (d.Other ?? 0).toFixed(1),
    ].join(','))
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `keyword_sov.csv`; a.click()
  }

  if (loading) return (
    <div className="anim-fade-up">
      <PageSkeleton cols={4} rows={5} />
    </div>
  )

  if (!activeCampaignId) return (
    <div className="anim-fade-up">
      <div className="page-header">
        <div>
          <h1 className="page-title">Keyword-wise <span className="accent">SOV</span></h1>
          <p className="page-subtitle">Brand dominance per keyword and competitive breakdown</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, background: '#fff', borderRadius: 14, border: '1px solid #F1F5F9' }}>
        <AlertCircle size={36} style={{ color: '#CBD5E1' }} />
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1E293B' }}>Select a Campaign</div>
        <div style={{ fontSize: 13, color: '#64748B' }}>Choose a campaign to view keyword SOV analysis</div>
      </div>
    </div>
  )

  // Compute analytics
  const avgSov = brands.map((b, i) => ({
    brand: b.length > 14 ? b.slice(0, 14) + '…' : b,
    avg: data.length > 0 ? data.reduce((s, kw) => s + Number(kw[b] ?? 0), 0) / data.length : 0,
    color: COLORS[i % COLORS.length],
  })).sort((a, b) => b.avg - a.avg)

  const dominance: Record<string, number> = {}
  brands.forEach(b => { dominance[b] = 0 })
  data.forEach(kw => {
    const maxBrand = brands.reduce((best, b) => (Number(kw[b] ?? 0) > Number(kw[best] ?? 0) ? b : best), brands[0])
    if (maxBrand) dominance[maxBrand] = (dominance[maxBrand] ?? 0) + 1
  })
  const dominancePie = brands.map((b, i) => ({ name: b, value: dominance[b] ?? 0, color: COLORS[i % COLORS.length] })).filter(d => d.value > 0)

  const chartHeight = Math.max(300, data.length * 40)
  const topKeyword = [...data].sort((a, b) => (b.total_videos ?? 0) - (a.total_videos ?? 0))[0]
  const mostContested = [...data].sort((a, b) => {
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

      <div className="page-header">
        <div>
          <h1 className="page-title">Keyword-wise <span className="accent">SOV</span></h1>
          <p className="page-subtitle">Brand dominance per keyword and competitive breakdown</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="toggle-group">
            {(['chart', 'heatmap', 'table'] as const).map(m => (
              <button key={m} className={`toggle-btn ${viewMode === m ? 'active' : ''}`} onClick={() => setViewMode(m)}>
                {m === 'chart' ? 'Chart' : m === 'heatmap' ? 'Heatmap' : 'Table'}
              </button>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={exportCSV} disabled={data.length === 0}>
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Language</label>
          <select className="input" style={{ width: 160 }} value={lang} onChange={e => setLang(e.target.value)}>
            {LANGUAGE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Type</label>
          <select className="input" style={{ width: 160 }} value={type} onChange={e => setType(e.target.value)}>
            {TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 130 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Ownership</label>
          <select className="input" style={{ cursor: 'pointer', padding: '6px 12px', minWidth: 130 }} value={ownershipFilter} onChange={e => setOwnershipFilter(e.target.value as 'all' | 'ours' | 'theirs')}>
            <option value="all">All Videos</option>
            <option value="ours">Our Videos</option>
            <option value="theirs">Not Our Videos</option>
          </select>
        </div>
      </div>

      {data.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, background: '#fff', borderRadius: 14, border: '1px solid #F1F5F9' }}>
          <AlertCircle size={36} style={{ color: '#CBD5E1' }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1E293B' }}>No Keyword SOV Data</div>
          <div style={{ fontSize: 13, color: '#64748B', textAlign: 'center', maxWidth: 360 }}>
            Add keywords and trigger a scrape from <Link href="/control" style={{ color: '#1A73E8', fontWeight: 600 }}>Campaign Control</Link> to generate SOV statistics.
          </div>
        </div>
      ) : (
        <>
          {/* KPI Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Hash size={14} style={{ color: '#1A73E8' }} />
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Keywords</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', fontFamily: "'JetBrains Mono',monospace" }}>{campaignOverview?.totalKeywords ?? data.length}</div>
            </div>
            <div className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Target size={14} style={{ color: '#10B981' }} />
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Top Keyword</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topKeyword?.keyword ?? '—'}</div>
              <div style={{ fontSize: 10, color: '#10B981', fontWeight: 600, marginTop: 2 }}>{topKeyword?.total_videos ?? 0} videos</div>
            </div>
            <div className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#FDF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BarChart2 size={14} style={{ color: '#8B5CF6' }} />
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Lead Brand</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{avgSov[0]?.brand ?? '—'}</div>
              <div style={{ fontSize: 10, color: '#8B5CF6', fontWeight: 600, marginTop: 2 }}>{avgSov[0]?.avg.toFixed(1)}% avg SOV</div>
            </div>
            <div className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RefreshCw size={14} style={{ color: '#F59E0B' }} />
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Most Contested</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mostContested?.keyword ?? '—'}</div>
              <div style={{ fontSize: 10, color: '#F59E0B', fontWeight: 600, marginTop: 2 }}>{mostContested ? brands.filter(b => (mostContested[b] ?? 0) > 5).length : 0} brands competing</div>
            </div>
          </div>

          {/* Avg SOV + Dominance Pie */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div className="card" style={{ padding: '20px 22px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Average SOV per Brand</div>
              <div style={{ fontSize: 11.5, color: '#94A3B8', marginBottom: 16 }}>Mean share of voice across all tracked keywords</div>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={avgSov} layout="vertical" margin={{ top: 4, right: 50, left: 60, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                    <XAxis type="number" unit="%" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v: any) => `${v}%`} />
                    <YAxis type="category" dataKey="brand" tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} width={60} />
                    <Tooltip formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'Avg SOV']} contentStyle={{ background: '#1E293B', border: 'none', borderRadius: 8, fontSize: 11 }} labelStyle={{ color: '#94A3B8' }} itemStyle={{ color: '#FFF' }} />
                    <Bar dataKey="avg" radius={[0, 6, 6, 0]} barSize={18}>
                      {avgSov.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            {dominancePie.length > 0 && (
              <div className="card" style={{ padding: '20px 22px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Keyword Dominance</div>
                <div style={{ fontSize: 11.5, color: '#94A3B8', marginBottom: 16 }}>How many keywords each brand dominates</div>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={dominancePie} dataKey="value" nameKey="name" cx="40%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3}>
                        {dominancePie.map((d, i) => <Cell key={i} fill={d.color} stroke="transparent" />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => [`${v} keywords`, 'Dominates']} contentStyle={{ background: '#1E293B', border: 'none', borderRadius: 8, fontSize: 11 }} labelStyle={{ color: '#94A3B8' }} itemStyle={{ color: '#FFF' }} />
                      <Legend iconType="circle" layout="horizontal" align="left" verticalAlign="top" wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Main Visualization */}
          {viewMode === 'chart' ? (
            <div className="card" style={{ padding: '24px 20px', marginBottom: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Keyword-wise Brand SOV</div>
                <div style={{ fontSize: 11.5, color: '#94A3B8' }}>Stacked breakdown showing SOV % per brand for each keyword</div>
              </div>
              <div style={{ height: chartHeight }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                    <XAxis type="number" unit="%" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v: any) => `${v}%`} />
                    <YAxis
                      dataKey="keyword"
                      type="category"
                      tick={({ x, y, payload }) => {
                        const matched = data.find(d => d.keyword === payload.value)
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text x={-10} y={0} dy={4} textAnchor="end" fill="#1E293B" fontSize={11} fontWeight={600}>
                              {payload.value.length > 28 ? payload.value.slice(0, 28) + '…' : payload.value}
                            </text>
                            {matched?.total_videos !== undefined && (
                              <text x={-10} y={13} dy={4} textAnchor="end" fill="#94A3B8" fontSize={9}>
                                {matched.total_videos} videos
                              </text>
                            )}
                          </g>
                        )
                      }}
                      axisLine={false}
                      tickLine={false}
                      width={260}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(26,115,232,0.02)' }} />
                    <Legend iconType="circle" layout="horizontal" verticalAlign="top" align="right" wrapperStyle={{ paddingTop: 8, fontSize: 11 }} />
                    {brands.map((bName, index) => (
                      <Bar key={bName} dataKey={bName} name={bName} stackId="a" fill={COLORS[index % COLORS.length]} barSize={14}
                        radius={index === brands.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]} />
                    ))}
                    <Bar key="Other" dataKey="Other" name="Other" stackId="a" fill="#E2E8F0" barSize={14} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : viewMode === 'heatmap' ? (
            <div className="card" style={{ padding: '18px', marginBottom: 20, overflowX: 'auto' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Keyword × Brand Heatmap</div>
              <div style={{ fontSize: 11.5, color: '#94A3B8', marginBottom: 16 }}>Color intensity = SOV % — darker means higher dominance</div>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 3, minWidth: 500 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', minWidth: 140 }}>Keyword</th>
                    {brands.map((b, bi) => (
                      <th key={b} style={{ padding: '8px 8px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: COLORS[bi % COLORS.length], minWidth: 70 }}>{b.length > 10 ? b.slice(0, 10) + '…' : b}</th>
                    ))}
                    <th style={{ padding: '8px 8px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#94A3B8', minWidth: 50 }}>Other</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((kw) => (
                    <tr key={kw.keyword}>
                      <td style={{ padding: '6px 12px', fontWeight: 600, fontSize: 12, color: '#1E293B', whiteSpace: 'nowrap' }}>
                        <div>{kw.keyword}</div>
                        {kw.total_videos !== undefined && <div style={{ fontSize: 9.5, color: '#94A3B8' }}>{kw.total_videos} videos</div>}
                      </td>
                      {brands.map((b, bi) => {
                        const val = Number(kw[b] ?? 0)
                        const color = COLORS[bi % COLORS.length]
                        const barWidth = `${Math.round(Math.max(0.04, Math.min(1, val / 100)) * 100)}%`
                        return (
                          <td key={b} style={{ padding: '6px 8px', textAlign: 'center' }} title={`${b}: ${val.toFixed(1)}%`}>
                            <div style={{ width: '100%', height: 32, borderRadius: 6, background: '#F8FAFC', display: 'flex', alignItems: 'center' }}>
                              <div style={{ height: '80%', borderRadius: 6, background: color, width: barWidth, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 10 }}>
                                {val > 5 ? `${val.toFixed(0)}%` : ''}
                              </div>
                            </div>
                          </td>
                        )
                      })}
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                        <div style={{ width: '100%', height: 32, borderRadius: 6, background: Number(kw.Other ?? 0) > 0 ? '#94A3B820' : '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#94A3B8' }}>
                          {Number(kw.Other ?? 0) > 0 ? `${Number(kw.Other).toFixed(0)}%` : '—'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card" style={{ padding: '18px', marginBottom: 20, overflowX: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Keyword Table</div>
                  <div style={{ fontSize: 11.5, color: '#94A3B8' }}>Sortable table with exact values — click column headers to sort</div>
                </div>
                <button onClick={exportCSV} className="btn btn-ghost btn-sm"><Download size={13} /> Export CSV</button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 750 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: '#64748B', cursor: 'pointer' }} onClick={() => { setSortKey('keyword'); setSortDesc(prev => sortKey === 'keyword' ? !prev : true) }}>Keyword {sortKey === 'keyword' ? (sortDesc ? '▼' : '▲') : ''}</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 11, color: '#64748B', cursor: 'pointer' }} onClick={() => { setSortKey('total_videos'); setSortDesc(prev => sortKey === 'total_videos' ? !prev : true) }}>Videos {sortKey === 'total_videos' ? (sortDesc ? '▼' : '▲') : ''}</th>
                    {brands.map(b => (
                      <th key={b} style={{ textAlign: 'right', padding: '10px 12px', fontSize: 11, color: '#64748B', cursor: 'pointer' }} onClick={() => { setSortKey(b); setSortDesc(prev => sortKey === b ? !prev : true) }}>{b.length > 10 ? b.slice(0, 10) + '…' : b} {sortKey === b ? (sortDesc ? '▼' : '▲') : ''}</th>
                    ))}
                    <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 11, color: '#64748B' }}>Other</th>
                    <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: 11, color: '#64748B' }}>Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((kw: any) => (
                    <tr key={kw.keyword} style={{ borderTop: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: 13 }}>{kw.keyword}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{kw.total_videos ?? 0}</td>
                      {brands.map(b => (
                        <td key={b} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>{(Number(kw[b] ?? 0)).toFixed(1)}%</td>
                      ))}
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748B' }}>{(Number(kw.Other ?? 0)).toFixed(1)}%</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <button
                          onClick={() => openEditModal(kw)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#475569', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#EFF6FF'; e.currentTarget.style.borderColor = '#1A73E8'; e.currentTarget.style.color = '#1A73E8' }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#475569' }}
                        >
                          <Pencil size={12} /> Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Edit Keyword Modal */}
      {editModal.open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
          onClick={() => setEditModal({ open: false, keyword: null })}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: '1px solid #E2E8F0' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A' }}>Edit Keyword Target</div>
                <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 4 }}>Update keyword text, language, or classification type</div>
              </div>
              <button
                onClick={() => setEditModal({ open: false, keyword: null })}
                style={{ padding: 6, borderRadius: 8, border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} style={{ color: '#64748B' }} />
              </button>
            </div>

            {/* Keyword Text */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Keyword Text</label>
              <input
                type="text"
                value={editText}
                onChange={e => setEditText(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13.5, fontWeight: 500, color: '#0F172A', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
                onFocus={e => e.currentTarget.style.borderColor = '#1A73E8'}
                onBlur={e => e.currentTarget.style.borderColor = '#E2E8F0'}
                placeholder="e.g. best water purifier 2026"
              />
            </div>

            {/* Language */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Language</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {EDIT_LANG_OPTS.map(o => (
                  <button
                    key={o.value}
                    onClick={() => setEditLang(o.value)}
                    style={{
                      padding: '7px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                      background: editLang === o.value ? '#0F172A' : '#F8FAFC',
                      color: editLang === o.value ? '#FFF' : '#475569',
                      border: `1.5px solid ${editLang === o.value ? '#0F172A' : '#E2E8F0'}`,
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Classification Type */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Keyword Classification Type</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {EDIT_TYPE_OPTS.map(o => (
                  <button
                    key={o.value}
                    onClick={() => setEditType(o.value)}
                    style={{
                      padding: '7px 20px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                      background: editType === o.value ? '#0F172A' : '#F8FAFC',
                      color: editType === o.value ? '#FFF' : '#475569',
                      border: `1.5px solid ${editType === o.value ? '#0F172A' : '#E2E8F0'}`,
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={saveEdit}
                disabled={editSaving || !editText.trim()}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: editSaving || !editText.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  background: editSaving || !editText.trim() ? '#CBD5E1' : '#1A73E8',
                  color: '#FFF', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {editSaving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : '✓'} {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                onClick={() => setEditModal({ open: false, keyword: null })}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}