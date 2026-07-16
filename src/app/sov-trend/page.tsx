'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, Cell, ComposedChart, ReferenceLine,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import { useCampaignStore } from '@/lib/store'
import { Loader2, AlertCircle, TrendingUp, TrendingDown, RefreshCw, Activity, ChevronUp, ChevronDown, BarChart2, Zap, FlaskConical, Trash2 } from 'lucide-react'
import Link from 'next/link'

// ─── Demo time-series data ────────────────────────────────────────────────────
const DEMO_BRANDS_LIST = ['LG Electronics', 'Samsung', 'Sony', 'Whirlpool', 'Havells']
function genDemoSOVData(numDays: number) {
  const base = [38, 29, 17, 10, 6]
  const rows: any[] = []
  for (let i = numDays - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000).toLocaleDateString('en-IN', { month: 'short', day: '2-digit' })
    const row: any = { date }
    let rem = 100
    DEMO_BRANDS_LIST.forEach((b, bi) => {
      const noise = (Math.random() - 0.5) * 3
      row[b] = bi < DEMO_BRANDS_LIST.length - 1
        ? Math.max(2, Math.min(rem - 2, base[bi] + noise + (bi === 0 ? i * 0.06 : -i * 0.02)))
        : Math.max(1, rem - DEMO_BRANDS_LIST.slice(0, -1).reduce((s, bb) => s + row[bb], 0))
      rem -= row[b]
    })
    rows.push(row)
  }
  return rows
}

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
    <div style={{ background: '#1E293B', border: 'none', borderRadius: 10, padding: '10px 14px', minWidth: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
      <div style={{ fontSize: 10.5, color: '#94A3B8', marginBottom: 8, fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 6 }}>{label}</div>
      {sorted.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.fill, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#CBD5E1', fontWeight: 600 }}>{p.name}</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, color: p.color || p.fill }}>{(p.value as number).toFixed(1)}%</span>
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

// Compute rolling average
function rollingAvg(data: any[], key: string, window = 3) {
  return data.map((d, i) => {
    const slice = data.slice(Math.max(0, i - window + 1), i + 1)
    const avg = slice.reduce((s, x) => s + (x[key] ?? 0), 0) / slice.length
    return { ...d, [`${key}_avg`]: Math.round(avg * 10) / 10 }
  })
}

// Compute latest stats per brand from time-series
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
  const [showDemo, setShowDemo] = useState(true)

  const fetchTrend = useCallback(async (campId: string, d: string) => {
    if (!campId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/sov-trend?campaign_id=${campId}&days=${d}`)
      const json = await res.json()
      const b: string[] = json.brands ?? []
      setBrands(b)
      setActiveBrands(b)
      setData(json.data ?? [])
      setHasScrapeData(json.has_scrape_data ?? false)
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 12 }}>
      <Loader2 size={32} style={{ color: '#1A73E8', animation: 'spin 1s linear infinite' }} />
      <div style={{ fontSize: 13.5, color: '#64748B', fontWeight: 600 }}>Loading SOV trend data…</div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  // Demo data injection
  const hasRealBrands = brands.length > 0
  const isDemo = !hasRealBrands && showDemo
  const activeB = isDemo ? DEMO_BRANDS_LIST : brands
  const activeD = isDemo ? genDemoSOVData(parseInt(days, 10) || 30) : data

  const brandStats = computeBrandStats(activeD, activeB)
  const effectiveActiveBrands = activeBrands.length > 0 && !isDemo ? activeBrands : activeB
  const chartData = showAvg && activeD.length > 0
    ? effectiveActiveBrands.reduce((d, b) => rollingAvg(d, b), activeD)
    : activeD

  // For the bar comparison (last snapshot per brand)
  const lastSnapshot = activeD.length > 0 ? activeD[activeD.length - 1] : null
  const barCompare = activeB.map((b, i) => ({
    brand: b.slice(0, 12),
    sov: lastSnapshot?.[b] ?? 0,
    color: COLORS[i % COLORS.length],
  })).sort((a, b) => b.sov - a.sov)

  // Heatmap: for each brand, show sov per date row
  const heatmapDates = activeD.slice(-7).map(d => d.date)

  return (
    <div className="anim-fade-up">
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Share-of-Voice <span className="accent">Trend Analysis</span></h1>
          <p className="page-subtitle">Time-series SOV evolution with brand comparison and trend signals</p>
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

      {/* Demo banner */}
      {isDemo && (
        <div style={{
          display: 'flex', gap: 14, padding: '14px 20px', borderRadius: 12, marginBottom: 20,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(26,115,232,0.08))',
          border: '1px solid rgba(99,102,241,0.2)', alignItems: 'center',
        }}>
          <FlaskConical size={20} style={{ color: '#6366F1', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#312E81' }}>Demo Data — Reference Mode</div>
            <div style={{ fontSize: 11.5, color: '#4338CA', marginTop: 1, lineHeight: 1.5 }}>
              Showing simulated 30-day SOV trend for 5 sample brands. Real data will populate once brands are registered and scrapes are triggered.
            </div>
          </div>
          <button onClick={() => setShowDemo(false)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, cursor: 'pointer', background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
            <Trash2 size={13} /> Clear Demo Data
          </button>
        </div>
      )}

      {!hasRealBrands && !showDemo ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 280, gap: 14, background: '#FFFFFF', borderRadius: 14, border: '1px solid #F1F5F9' }}>
          <AlertCircle size={36} style={{ color: '#CBD5E1' }} />
          <div style={{ fontSize: 14, fontWeight: 700 }}>No Brands Added</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>Add brand names in Campaign Control to start plotting trends.</div>
          <button onClick={() => setShowDemo(true)} style={{ padding: '8px 18px', borderRadius: 8, background: '#F1F5F9', border: '1px solid #E2E8F0', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
            <FlaskConical size={14} /> Show Demo Data
          </button>
        </div>
      ) : (
        <>
          {hasRealBrands && !hasScrapeData && (
            <div style={{ display: 'flex', gap: 12, padding: '16px 20px', borderRadius: 12, background: 'rgba(26,115,232,0.06)', border: '1px solid rgba(26,115,232,0.18)', marginBottom: 20, alignItems: 'center' }}>
              <RefreshCw size={20} style={{ color: '#1A73E8', flexShrink: 0, animation: 'spin 8s linear infinite' }} />
              <div style={{ fontSize: 13, color: '#1E3A8A', lineHeight: 1.5 }}>
                <strong>Trend Snapshots Pending:</strong> Trigger a scrape from the{' '}
                <Link href="/control" style={{ fontWeight: 700, color: '#1A73E8', textDecoration: 'underline' }}>Campaign Control</Link>{' '}
                to log daily view count snapshots.
              </div>
            </div>
          )}

          {/* ── Brand Summary KPI Strip ── */}
          {brandStats.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
              {brandStats.map(bs => {
                const pos = bs.delta >= 0
                return (
                  <div key={bs.brand} style={{
                    background: '#FFFFFF', borderRadius: 12, padding: '14px 16px',
                    border: `1px solid ${bs.color}20`, boxShadow: `0 1px 3px ${bs.color}10`,
                    transition: 'all 0.2s',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${bs.color}20` }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 1px 3px ${bs.color}10` }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: bs.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bs.brand}</span>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: bs.color, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>
                      {bs.current.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 3, fontWeight: 600 }}>current SOV</div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
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
                    <div style={{ marginTop: 6, display: 'flex', gap: 10, fontSize: 9.5, color: '#94A3B8', fontWeight: 600 }}>
                      <span>Peak: <strong style={{ color: bs.color }}>{bs.peak.toFixed(1)}%</strong></span>
                      <span>Avg: <strong style={{ color: '#64748B' }}>{bs.avg.toFixed(1)}%</strong></span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── MAIN TREND CHART ── */}
          <div className="card" style={{ padding: '24px 20px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>SOV Timeline</div>
                <div style={{ fontSize: 11.5, color: '#94A3B8' }}>Daily share-of-voice % per brand over selected period{showAvg ? ' · 7-day rolling average applied' : ''}</div>
              </div>
              {isDemo && <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(99,102,241,0.08)', color: '#6366F1', border: '1px solid rgba(99,102,241,0.2)', flexShrink: 0 }}>DEMO DATA</span>}
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

          {/* ── ANALYTICS GRID ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 20 }}>

            {/* Latest Snapshot Bar Comparison */}
            <ChartCard title="Latest SOV snapshot" subtitle="Current SOV % per brand from most recent data point" height={220}>
              {(isDemo || hasScrapeData) && barCompare.length > 0 ? (
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
                  Awaiting snapshot data
                </div>
              )}
            </ChartCard>

            {/* SOV Snapshot Data Table */}
            <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '20px 22px', border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Signal Summary</div>
              <div style={{ fontSize: 11.5, color: '#94A3B8', marginBottom: 14 }}>Accelerating, stable, or declining per brand</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {brandStats.map(bs => {
                  const signal = bs.delta > 1 ? 'Accelerating' : bs.delta < -1 ? 'Declining' : 'Stable'
                  const signalColor = signal === 'Accelerating' ? '#10B981' : signal === 'Declining' ? '#EF4444' : '#F59E0B'
                  return (
                    <div key={bs.brand} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: '#FAFBFC', border: '1px solid #F1F5F9' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: bs.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bs.brand}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: bs.color, fontFamily: "'JetBrains Mono',monospace" }}>{bs.current.toFixed(1)}%</span>
                      <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: `${signalColor}12`, color: signalColor, border: `1px solid ${signalColor}30` }}>{signal}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── Snapshot Date Matrix (Heatmap style) ── */}
          {(isDemo || hasScrapeData) && activeD.length > 0 && heatmapDates.length > 0 && (
            <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '20px 22px', border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 20, overflowX: 'auto' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>SOV Snapshot Matrix</div>
              <div style={{ fontSize: 11.5, color: '#94A3B8', marginBottom: 16 }}>Last 7 snapshots — color intensity = SOV strength</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Brand</th>
                    {heatmapDates.map(d => (
                      <th key={d} style={{ padding: '8px 8px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#94A3B8', minWidth: 60 }}>{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeB.map((b, bi) => (
                    <tr key={b}>
                      <td style={{ padding: '6px 12px', fontWeight: 700, fontSize: 12, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: COLORS[bi % COLORS.length] }} />
                        {b}
                      </td>
                      {heatmapDates.map(date => {
                        const val = activeD.find(d => d.date === date)?.[b] ?? 0
                        const intensity = val / 100
                        return (
                          <td key={date} style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <div style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: 50, height: 28, borderRadius: 6,
                              background: val > 0 ? `${COLORS[bi % COLORS.length]}${Math.round(10 + intensity * 80).toString(16).padStart(2, '0')}` : '#F8FAFC',
                              fontSize: 10.5, fontWeight: 700,
                              color: val > 0 ? COLORS[bi % COLORS.length] : '#CBD5E1',
                            }}>
                              {val > 0 ? `${val.toFixed(1)}%` : '—'}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Brand Filter ── */}
          {!isDemo && (
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Filter Trend Brands</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {activeB.map((b, i) => {
                  const active = effectiveActiveBrands.includes(b)
                  const color = COLORS[i % COLORS.length]
                  return (
                    <button
                      key={b}
                      onClick={() => toggleBrand(b)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 8,
                        background: active ? `${color}10` : '#F8FAFC',
                        border: `1px solid ${active ? `${color}40` : '#E2E8F0'}`,
                        color: active ? color : '#64748B',
                        fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit',
                      }}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: active ? color : '#CBD5E1' }} />
                      {b}
                      {active && (
                        <span style={{ fontSize: 10, fontWeight: 700, color, fontFamily: "'JetBrains Mono',monospace" }}>
                          {brandStats.find(s => s.brand === b)?.current.toFixed(1)}%
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
