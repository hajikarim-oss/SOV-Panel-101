'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts'
import { useCampaignStore } from '@/lib/store'
import { getClientCache, setClientCache } from '@/lib/cache'
import { AlertCircle, TrendingUp, TrendingDown, RefreshCw, ChevronUp, ChevronDown, Download } from 'lucide-react'
import { PageSkeleton } from '@/components/PageSkeleton'
import Link from 'next/link'

const COLORS = ['#1A73E8', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#F06292']

const RANGES = [
  { key: '1', label: 'Daily' },
  { key: '7', label: '7 Days' },
  { key: '30', label: '30 Days' },
  { key: '90', label: '3 Months' },
  { key: '180', label: '6 Months' },
  { key: '365', label: '1 Year' },
]

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const sorted = [...payload].filter(p => p.value > 0).sort((a: any, b: any) => b.value - a.value)
  return (
    <div style={{ background: '#1E293B', border: 'none', borderRadius: 10, padding: '10px 14px', minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
      <div style={{ fontSize: 10.5, color: '#94A3B8', marginBottom: 8, fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 6 }}>{label}</div>
      {sorted.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.fill }} />
            <span style={{ fontSize: 11, color: '#CBD5E1', fontWeight: 600 }}>{p.name}</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, color: p.color || p.fill }}>{(p.value as number).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  )
}

function rollingAvg(data: any[], key: string, window = 3) {
  return data.map((d, i) => {
    const slice = data.slice(Math.max(0, i - window + 1), i + 1)
    const avg = slice.reduce((s, x) => s + (x[key] ?? 0), 0) / slice.length
    return { ...d, [`${key}_avg`]: Math.round(avg * 10) / 10 }
  })
}

function computeBrandStats(data: any[], brands: string[]) {
  if (!data.length) return []
  const last = data[data.length - 1]
  const prev = data.length > 1 ? data[data.length - 2] : null
  const peak = (b: string) => Math.max(...data.map(d => d[b] ?? 0))
  const avg = (b: string) => data.reduce((s, d) => s + (d[b] ?? 0), 0) / data.length
  return brands.map((b, i) => ({
    brand: b,
    current: last[b] ?? 0,
    prev: prev?.[b] ?? 0,
    delta: prev ? ((last[b] ?? 0) - (prev[b] ?? 0)) : 0,
    peak: peak(b),
    avg: avg(b),
    color: COLORS[i % COLORS.length],
  })).sort((a, b) => b.current - a.current)
}

export default function SovTrendPage() {
  const { campaigns, activeCampaignId, fetchCampaigns } = useCampaignStore()
  const [days, setDays] = useState('30')
  const [chartType, setChartType] = useState<'area' | 'line'>('area')
  const [activeBrands, setActiveBrands] = useState<string[]>([])
  const [showAvg, setShowAvg] = useState(false)
  const [data, setData] = useState<any[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [hasScrapeData, setHasScrapeData] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchTrend = useCallback(async (campId: string, d: string) => {
    if (!campId) return
    const ck = `trend:${campId}:${d}`
    const cached = getClientCache<any>(ck)
    if (cached) {
      const b: string[] = cached.brands ?? []
      setBrands(b)
      setActiveBrands(b)
      setData(cached.data ?? [])
      setHasScrapeData(cached.has_scrape_data ?? false)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/sov-trend?campaign_id=${campId}&days=${d}`)
      const json = await res.json()
      const b: string[] = json.brands ?? []
      setBrands(b)
      setActiveBrands(b)
      setData(json.data ?? [])
      setHasScrapeData(json.has_scrape_data ?? false)
      setClientCache(ck, json)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])
  useEffect(() => {
    if (activeCampaignId) fetchTrend(activeCampaignId, days)
    else setLoading(false)
  }, [activeCampaignId, days, fetchTrend])

  const toggleBrand = (b: string) =>
    setActiveBrands(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])

  if (loading) return (
    <div className="anim-fade-up">
      <PageSkeleton cols={6} rows={3} />
    </div>
  )

  if (!activeCampaignId || brands.length === 0) return (
    <div className="anim-fade-up">
      <div className="page-header">
        <div>
          <h1 className="page-title">Share-of-Voice <span className="accent">Trend</span></h1>
          <p className="page-subtitle">Time-series SOV evolution with brand comparison</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, background: '#fff', borderRadius: 14, border: '1px solid #F1F5F9' }}>
        <AlertCircle size={36} style={{ color: '#CBD5E1' }} />
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1E293B' }}>{!activeCampaignId ? 'Select a Campaign' : 'No Brand Data'}</div>
        <div style={{ fontSize: 13, color: '#64748B', textAlign: 'center', maxWidth: 360 }}>
          {!activeCampaignId
            ? 'Choose a campaign to view SOV trends'
            : <>Add brands in <Link href="/control" style={{ color: '#1A73E8', fontWeight: 600 }}>Campaign Control</Link> to start plotting trends.</>}
        </div>
      </div>
    </div>
  )

  const brandStats = computeBrandStats(data, brands)
  const effectiveActiveBrands = activeBrands.length > 0 ? activeBrands : brands
  const chartData = showAvg && data.length > 0
    ? effectiveActiveBrands.reduce((d, b) => rollingAvg(d, b), data)
    : data

  const lastSnapshot = data.length > 0 ? data[data.length - 1] : null
  const barCompare = brands.map((b, i) => ({
    brand: b.length > 14 ? b.slice(0, 14) + '…' : b,
    sov: lastSnapshot?.[b] ?? 0,
    color: COLORS[i % COLORS.length],
  })).sort((a, b) => b.sov - a.sov)

  return (
    <div className="anim-fade-up">
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div className="page-header">
        <div>
          <h1 className="page-title">Share-of-Voice <span className="accent">Trend</span></h1>
          <p className="page-subtitle">Time-series SOV evolution with brand comparison</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="toggle-group">
            {RANGES.map(r => (
              <button key={r.key} className={`toggle-btn ${days === r.key ? 'active' : ''}`} onClick={() => setDays(r.key)}>
                {r.label}
              </button>
            ))}
          </div>
          <div className="toggle-group">
            <button className={`toggle-btn ${chartType === 'area' ? 'active' : ''}`} onClick={() => setChartType('area')}>Stacked Area</button>
            <button className={`toggle-btn ${chartType === 'line' ? 'active' : ''}`} onClick={() => setChartType('line')}>Multi Line</button>
          </div>
          <button
            onClick={() => setShowAvg(v => !v)}
            className={`toggle-btn ${showAvg ? 'active' : ''}`}
            style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, border: '1px solid #E2E8F0', cursor: 'pointer', background: showAvg ? '#1A73E8' : '#F8FAFC', color: showAvg ? '#FFF' : '#64748B', fontFamily: 'inherit' }}
          >
            7-Day Avg
          </button>
        </div>
      </div>

      {!hasScrapeData && (
        <div className="card" style={{ padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, borderLeft: '3px solid #1A73E8' }}>
          <RefreshCw size={18} style={{ color: '#1A73E8', flexShrink: 0, animation: 'spin 8s linear infinite' }} />
          <div style={{ fontSize: 13, color: '#1E3A8A' }}>
            <strong>Snapshots pending.</strong> Run a scrape from <Link href="/control" style={{ fontWeight: 700, color: '#1A73E8', textDecoration: 'underline' }}>Campaign Control</Link> to log daily view snapshots.
          </div>
        </div>
      )}

      {/* Brand KPI Strip */}
      {brandStats.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(brandStats.length, 6)}, 1fr)`, gap: 12, marginBottom: 20 }}>
          {brandStats.slice(0, 6).map(bs => {
            const pos = bs.delta >= 0
            return (
              <div key={bs.brand} className="card" style={{ padding: '14px 16px', borderLeft: `3px solid ${bs.color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: bs.color }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bs.brand}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: bs.color, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>
                  {bs.current.toFixed(1)}%
                </div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 3, fontWeight: 600 }}>current SOV</div>
                <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10.5, fontWeight: 700,
                    padding: '2px 6px', borderRadius: 20,
                    color: pos ? '#059669' : '#DC2626',
                    background: pos ? '#ECFDF5' : '#FEF2F2',
                    border: `1px solid ${pos ? '#A7F3D0' : '#FECACA'}`,
                  }}>
                    {pos ? <ChevronUp size={8} /> : <ChevronDown size={8} />}
                    {Math.abs(bs.delta).toFixed(1)}%
                  </span>
                  <span style={{ fontSize: 9.5, color: '#94A3B8' }}>vs prev</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Main Trend Chart */}
      <div className="card" style={{ padding: '24px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>SOV Timeline</div>
            <div style={{ fontSize: 11.5, color: '#94A3B8' }}>Daily share-of-voice % per brand{showAvg ? ' · 7-day rolling average' : ''}</div>
          </div>
        </div>
        <div style={{ height: 340 }}>
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  {effectiveActiveBrands.map((b, i) => (
                    <linearGradient key={b} id={`sov_grad_${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis unit="%" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                {effectiveActiveBrands.map((b, i) => (
                  <Area
                    key={b} type="monotone"
                    dataKey={showAvg ? `${b}_avg` : b}
                    name={b}
                    stackId="1"
                    stroke={COLORS[i % COLORS.length]}
                    fill={`url(#sov_grad_${i})`}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                ))}
              </AreaChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis unit="%" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                {effectiveActiveBrands.map((b, i) => (
                  <Line
                    key={b} type="monotone"
                    dataKey={showAvg ? `${b}_avg` : b}
                    name={b}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Analytics Row: Snapshot Bar + Signal Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ padding: '20px 22px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Latest SOV Snapshot</div>
          <div style={{ fontSize: 11.5, color: '#94A3B8', marginBottom: 16 }}>Current SOV % per brand</div>
          <div style={{ height: 200 }}>
            {barCompare.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barCompare} layout="vertical" margin={{ top: 4, right: 40, left: 60, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                  <XAxis type="number" unit="%" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <YAxis type="category" dataKey="brand" tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'SOV']} contentStyle={{ background: '#1E293B', border: 'none', borderRadius: 8, fontSize: 11 }} labelStyle={{ color: '#94A3B8' }} itemStyle={{ color: '#FFF' }} />
                  <Bar dataKey="sov" radius={[0, 6, 6, 0]} barSize={20}>
                    {barCompare.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 12 }}>
                No snapshot data yet
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: '20px 22px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Signal Summary</div>
          <div style={{ fontSize: 11.5, color: '#94A3B8', marginBottom: 14 }}>Accelerating, stable, or declining per brand</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {brandStats.map(bs => {
              const signal = bs.delta > 1 ? 'Accelerating' : bs.delta < -1 ? 'Declining' : 'Stable'
              const signalColor = signal === 'Accelerating' ? '#10B981' : signal === 'Declining' ? '#EF4444' : '#F59E0B'
              return (
                <div key={bs.brand} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: '#FAFBFC', border: '1px solid #F1F5F9' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: bs.color }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bs.brand}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: bs.color, fontFamily: "'JetBrains Mono',monospace" }}>{bs.current.toFixed(1)}%</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: `${signalColor}12`, color: signalColor, border: `1px solid ${signalColor}30` }}>{signal}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Brand Filter */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 10 }}>Filter Brands</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {brands.map((b, i) => {
            const active = effectiveActiveBrands.includes(b)
            const color = COLORS[i % COLORS.length]
            return (
              <button
                key={b}
                onClick={() => toggleBrand(b)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
                  background: active ? `${color}10` : '#F8FAFC',
                  border: `1px solid ${active ? `${color}40` : '#E2E8F0'}`,
                  color: active ? color : '#64748B',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit',
                }}
              >
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: active ? color : '#CBD5E1' }} />
                {b}
                {active && (
                  <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>
                    {brandStats.find(s => s.brand === b)?.current.toFixed(1)}%
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}