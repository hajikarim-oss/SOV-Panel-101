'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, Minus, Download, AlertTriangle,
  Loader2, AlertCircle, RefreshCw, Award, Zap, Target, Activity, FlaskConical, Trash2
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  ScatterChart, Scatter, ZAxis, ComposedChart, Line, Area, ReferenceLine,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend
} from 'recharts'
import { useCampaignStore } from '@/lib/store'
import Link from 'next/link'

const COLORS = ['#1A73E8', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899', '#94A3B8']

// ─── Demo data (shown when no real scrape data exists) ───────────────────────
const DEMO_BRANDS = [
  {
    brand_name: 'LG Electronics',
    currentValue: 4_820_000, previousValue: 3_910_000,
    growthPercent: 23.3, rankMovement: 2, video_count: 42,
    sparklineData: [3.1, 3.4, 3.6, 3.9, 4.0, 4.3, 4.8],
  },
  {
    brand_name: 'Samsung',
    currentValue: 6_100_000, previousValue: 5_850_000,
    growthPercent: 4.3, rankMovement: 0, video_count: 58,
    sparklineData: [5.6, 5.7, 5.8, 5.9, 5.8, 6.0, 6.1],
  },
  {
    brand_name: 'Sony',
    currentValue: 2_340_000, previousValue: 2_640_000,
    growthPercent: -11.4, rankMovement: -1, video_count: 27,
    sparklineData: [2.8, 2.7, 2.6, 2.5, 2.4, 2.3, 2.3],
  },
  {
    brand_name: 'Whirlpool',
    currentValue: 1_180_000, previousValue: 990_000,
    growthPercent: 19.2, rankMovement: 1, video_count: 15,
    sparklineData: [0.9, 0.95, 1.0, 1.05, 1.1, 1.15, 1.18],
  },
  {
    brand_name: 'Havells',
    currentValue: 890_000, previousValue: 920_000,
    growthPercent: -3.3, rankMovement: -1, video_count: 11,
    sparklineData: [0.95, 0.92, 0.91, 0.90, 0.89, 0.89, 0.89],
  },
]

function fmt(n: number | null | undefined) {
  if (n === null || n === undefined || isNaN(n)) return '—'
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
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
            {typeof p.value === 'number' && p.name === 'Growth' ? `${p.value.toFixed(1)}%` : fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

function ScatterTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div style={{ background: '#1E293B', border: 'none', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#FFF', marginBottom: 6 }}>{d.brand}</div>
      <div style={{ fontSize: 11, color: '#CBD5E1' }}>Views: <strong>{fmt(d.views)}</strong></div>
      <div style={{ fontSize: 11, color: '#CBD5E1' }}>Growth: <strong style={{ color: d.growth >= 0 ? '#10B981' : '#EF4444' }}>{d.growth.toFixed(1)}%</strong></div>
      <div style={{ fontSize: 11, color: '#CBD5E1' }}>Videos: <strong>{d.videos}</strong></div>
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

// Mini sparkline bars
function MiniSparkBar({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length === 0 || data.every(v => v === 0)) {
    return <div style={{ fontSize: 10, color: '#94A3B8', fontStyle: 'italic' }}>No snapshots</div>
  }
  const max = Math.max(...data) || 1
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 28, width: 56 }}>
      {data.map((v, i) => (
        <div key={i} style={{
          flex: 1, height: `${Math.max(15, (v / max) * 100)}%`, borderRadius: 2,
          background: i === data.length - 1 ? color : `${color}35`,
          boxShadow: i === data.length - 1 ? `0 0 6px ${color}60` : 'none',
          transition: 'all 0.3s',
        }} />
      ))}
    </div>
  )
}

function RankBadge({ val }: { val: number }) {
  if (val > 0) return <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#10B981', fontWeight: 700, fontSize: 12 }}><TrendingUp size={13} /> +{val}</span>
  if (val < 0) return <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#EF4444', fontWeight: 700, fontSize: 12 }}><TrendingDown size={13} /> {val}</span>
  return <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#94A3B8', fontWeight: 600, fontSize: 12 }}><Minus size={12} /> —</span>
}

// Funnel progress bar
function FunnelBar({ brand, current, previous, max, color, growth, rank }: any) {
  const pctCurrent = max > 0 ? (current / max) * 100 : 0
  const pctPrev = max > 0 ? (previous / max) * 100 : 0
  const pos = growth >= 0
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color }}># {rank}</div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{brand}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: '#64748B' }}>{fmt(current)}</span>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
            color: pos ? '#059669' : '#DC2626',
            background: pos ? '#ECFDF5' : '#FEF2F2',
            border: `1px solid ${pos ? '#A7F3D0' : '#FECACA'}`,
          }}>
            {pos ? '+' : ''}{growth.toFixed(1)}%
          </span>
        </div>
      </div>
      {/* Previous period bar */}
      <div style={{ height: 6, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden', marginBottom: 3 }}>
        <div style={{ height: '100%', width: `${pctPrev}%`, background: `${color}40`, borderRadius: 99 }} />
      </div>
      {/* Current bar */}
      <div style={{ height: 10, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pctCurrent}%`,
          background: `linear-gradient(90deg, ${color}, ${color}BB)`,
          borderRadius: 99,
          transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: `0 0 10px ${color}40`,
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
        <span style={{ fontSize: 9, color: '#CBD5E1', fontWeight: 600 }}>Previous: {fmt(previous)}</span>
        <span style={{ fontSize: 9, color, fontWeight: 700 }}>{pctCurrent.toFixed(0)}% of max</span>
      </div>
    </div>
  )
}

export default function BrandGrowthPage() {
  const { campaigns, activeCampaignId, fetchCampaigns } = useCampaignStore()
  const [metric, setMetric] = useState<'views' | 'frequency'>('views')
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('7d')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any[]>([])
  const [hasScrapeData, setHasScrapeData] = useState(false)
  const [showDemo, setShowDemo] = useState(true)

  const fetchGrowth = useCallback(async (campId: string, m: 'views' | 'frequency', p: string) => {
    if (!campId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/brands/growth?campaign_id=${campId}&metric=${m}&period=${p}`)
      const d = await res.json()
      if (d.data) setData(d.data)
      setHasScrapeData(d.has_scrape_data ?? false)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])
  useEffect(() => {
    if (activeCampaignId) fetchGrowth(activeCampaignId, metric, period)
    else setLoading(false)
  }, [activeCampaignId, metric, period, fetchGrowth])

  const handleExport = () => {
    const headers = 'Brand,Current Value,Previous Value,Growth %,Videos Tracked'
    const rows = data.map(b => `"${b.brand_name}",${b.currentValue},${b.previousValue},${b.growthPercent}%,${b.video_count}`)
    const blob = new Blob([headers + '\n' + rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `brand_growth_${metric}.csv`; a.click()
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 12 }}>
      <Loader2 size={32} style={{ color: '#1A73E8', animation: 'spin 1s linear infinite' }} />
      <div style={{ fontSize: 13.5, color: '#64748B', fontWeight: 600 }}>Loading brand growth analysis…</div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  // If no real data but demo is enabled, inject demo
  const hasRealData = data.length > 0
  const activeData = hasRealData ? data : (showDemo ? DEMO_BRANDS : [])
  const hasData = activeData.length > 0
  const isDemo = !hasRealData && showDemo

  const sorted = [...activeData].sort((a, b) => b.growthPercent - a.growthPercent)
  const topGainer = sorted[0]
  const topLoser = sorted[sorted.length - 1]
  const maxValue = Math.max(...activeData.map(d => d.currentValue), 1)

  // Radar for multi-dim comparison
  const radarData = activeData.slice(0, 5).map((b) => ({
    brand: (b.brand_name ?? '').slice(0, 10),
    Current: Math.min(100, (b.currentValue / maxValue) * 100),
    Growth: Math.max(0, Math.min(100, b.growthPercent + 50)), // normalize around 50
    Videos: Math.min(100, ((b.video_count ?? 0) / Math.max(...activeData.map((d: any) => d.video_count ?? 0), 1)) * 100),
  }))

  // Scatter: x=currentValue, y=growthPercent, z=videoCount
  const scatterData = activeData.map((b, i) => ({
    views: b.currentValue,
    growth: b.growthPercent,
    videos: Math.max(50, (b.video_count ?? 1) * 120),
    brand: b.brand_name,
    color: COLORS[i % COLORS.length],
  }))

  // Period comparison bar
  const periodBar = activeData.map((b, i) => ({
    name: (b.brand_name ?? '').slice(0, 12),
    Current: b.currentValue,
    Previous: b.previousValue,
    color: COLORS[i % COLORS.length],
  }))

  return (
    <div className="anim-fade-up">
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Brand <span className="accent">Growth Analysis</span></h1>
          <p className="page-subtitle">Velocity tracking, period comparison, and growth scatter intelligence</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="toggle-group">
            {(['24h', '7d', '30d'] as const).map(p => (
              <button key={p} className={`toggle-btn ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>
                {p === '24h' ? '24h' : p === '7d' ? '7 Days' : '30 Days'}
              </button>
            ))}
          </div>
          <div className="toggle-group">
            <button className={`toggle-btn ${metric === 'views' ? 'active' : ''}`} onClick={() => setMetric('views')}>By Views</button>
            <button className={`toggle-btn ${metric === 'frequency' ? 'active' : ''}`} onClick={() => setMetric('frequency')}>By Frequency</button>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleExport} disabled={!hasData}>
            <Download size={13} /> Export CSV
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
              Showing sample brands (LG, Samsung, Sony, Whirlpool, Havells) for layout preview. 
              Real data will populate automatically once brands are tagged in Campaign Control.
            </div>
          </div>
          <button
            onClick={() => setShowDemo(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
              background: '#FEF2F2', border: '1px solid #FECACA',
              color: '#DC2626', fontSize: 12, fontWeight: 700,
              flexShrink: 0,
            }}
          >
            <Trash2 size={13} /> Clear Demo Data
          </button>
        </div>
      )}

      {!hasData ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 16, background: '#FFFFFF', borderRadius: 14, border: '1px solid #F1F5F9' }}>
          <AlertCircle size={40} style={{ color: '#CBD5E1' }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1E293B' }}>No Brand Velocity Data Yet</div>
          <div style={{ fontSize: 13, color: '#64748B', textAlign: 'center', maxWidth: 380 }}>
            Register brands and trigger a scrape campaign to populate velocity metrics.
          </div>
          <button onClick={() => setShowDemo(true)} style={{ padding: '8px 18px', borderRadius: 8, background: '#F1F5F9', border: '1px solid #E2E8F0', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
            <FlaskConical size={14} /> Show Demo Data
          </button>
        </div>
      ) : (
        <>
          {hasRealData && !hasScrapeData && (
            <div style={{ display: 'flex', gap: 12, padding: '16px 20px', borderRadius: 12, background: 'rgba(26,115,232,0.06)', border: '1px solid rgba(26,115,232,0.18)', marginBottom: 20, alignItems: 'center' }}>
              <RefreshCw size={20} style={{ color: '#1A73E8', flexShrink: 0, animation: 'spin 8s linear infinite' }} />
              <div style={{ fontSize: 13, color: '#1E3A8A', lineHeight: 1.5 }}>
                <strong>Waiting for Scraping:</strong> Trigger a scrape from{' '}
                <Link href="/control" style={{ fontWeight: 700, color: '#1A73E8', textDecoration: 'underline' }}>Campaign Control</Link>{' '}
                to generate views snapshots and track growth velocity.
              </div>
            </div>
          )}

          {/* ── Winner / Loser Banner ── */}
          {sorted.length >= 2 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div style={{ background: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)', borderRadius: 12, padding: '16px 20px', border: '1px solid #A7F3D0', display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#10B981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
                  <TrendingUp size={20} style={{ color: '#FFF' }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🚀 Top Gainer</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#064E3B', marginTop: 2 }}>{topGainer?.brand_name}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#10B981', marginTop: 2 }}>+{topGainer?.growthPercent.toFixed(1)}% growth</div>
                  <div style={{ fontSize: 11, color: '#064E3B', opacity: 0.7 }}>{fmt(topGainer?.currentValue)} {metric === 'views' ? 'views' : 'appearances'}</div>
                </div>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #FFF1F2, #FFE4E6)', borderRadius: 12, padding: '16px 20px', border: '1px solid #FECACA', display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#EF4444,#DC2626)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}>
                  <TrendingDown size={20} style={{ color: '#FFF' }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.5px' }}>⚠️ Needs Attention</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#7F1D1D', marginTop: 2 }}>{topLoser?.brand_name}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#EF4444', marginTop: 2 }}>{topLoser?.growthPercent.toFixed(1)}% growth</div>
                  <div style={{ fontSize: 11, color: '#7F1D1D', opacity: 0.7 }}>{fmt(topLoser?.currentValue)} {metric === 'views' ? 'views' : 'appearances'}</div>
                </div>
              </div>
            </div>
          )}

          {/* ── Funnel Progress Bars ── */}
          <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '22px 24px', border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Brand Performance Funnel</div>
            <div style={{ fontSize: 11.5, color: '#94A3B8', marginBottom: 20 }}>Current vs previous {period} — normalized to top performer</div>
            {sorted.map((row, i) => (
              <FunnelBar
                key={row.brand_name}
                rank={i + 1}
                brand={row.brand_name}
                current={row.currentValue}
                previous={row.previousValue}
                max={maxValue}
                growth={row.growthPercent}
                color={COLORS[activeData.findIndex((d: any) => d.brand_name === row.brand_name) % COLORS.length]}
              />
            ))}
          </div>

          {/* ── Charts Row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 20 }}>

            {/* Velocity Bar */}
            <ChartCard title="Growth velocity comparison" subtitle="Growth rate (%) per brand over selected window" height={240}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="brand_name" tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis unit="%" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'Growth']} contentStyle={{ background: '#1E293B', border: 'none', borderRadius: 8 }} labelStyle={{ color: '#94A3B8' }} itemStyle={{ color: '#FFF' }} />
                  <ReferenceLine y={0} stroke="#94A3B8" strokeDasharray="4 4" />
                  <Bar dataKey="growthPercent" name="Growth" radius={[6, 6, 0, 0]}>
                    {activeData.map((entry, index) => (
                      <Cell key={index} fill={entry.growthPercent >= 0 ? '#10B981' : '#EF4444'}
                        style={{ filter: `drop-shadow(0 2px 6px ${entry.growthPercent >= 0 ? '#10B98140' : '#EF444440'})` }} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Period Comparison Grouped Bar */}
            <ChartCard title="Period comparison" subtitle={`Current vs previous ${period} side-by-side`} height={240}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={periodBar} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} barGap={3} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: '#94A3B8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="Current" name="Current" radius={[5, 5, 0, 0]}>
                    {periodBar.map((d, i) => <Cell key={i} fill={`${d.color}EE`} />)}
                  </Bar>
                  <Bar dataKey="Previous" name="Previous" radius={[5, 5, 0, 0]}>
                    {periodBar.map((d, i) => <Cell key={i} fill={`${d.color}40`} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* ── Scatter + Radar ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 20 }}>

            {/* Scatter: Views vs Growth (Bubble) */}
            <ChartCard title="Views vs growth scatterplot" subtitle="X = total views, Y = growth %, bubble size = video count" height={260}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis type="number" dataKey="views" name="Views" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                  <YAxis type="number" dataKey="growth" name="Growth %" unit="%" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <ZAxis type="number" dataKey="videos" range={[60, 400]} />
                  <ReferenceLine y={0} stroke="#94A3B8" strokeDasharray="4 4" />
                  <Tooltip content={<ScatterTooltip />} />
                  {scatterData.map((d) => (
                    <Scatter key={d.brand} name={d.brand} data={[d]} fill={d.color} fillOpacity={0.8} />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Radar */}
            {radarData.length > 0 && (
              <ChartCard title="Brand capability radar" subtitle="Normalized current performance, growth rate, and video coverage" height={260}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                    <PolarGrid stroke="#F1F5F9" />
                    <PolarAngleAxis dataKey="brand" tick={{ fontSize: 10.5, fill: '#64748B', fontWeight: 600 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8, fill: '#94A3B8' }} tickCount={3} />
                    <Radar name="Current" dataKey="Current" stroke="#1A73E8" fill="#1A73E8" fillOpacity={0.18} strokeWidth={2} />
                    <Radar name="Growth" dataKey="Growth" stroke="#10B981" fill="#10B981" fillOpacity={0.12} strokeWidth={2} />
                    <Radar name="Videos" dataKey="Videos" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.08} strokeWidth={2} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#1E293B', border: 'none', borderRadius: 8, fontSize: 11 }} labelStyle={{ color: '#94A3B8' }} itemStyle={{ color: '#FFF' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          {/* ── Detailed Performance Table ── */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Detailed Performance Table</div>
                <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>All brands ranked by {metric === 'views' ? 'view' : 'frequency'} growth</div>
              </div>
              {isDemo && (
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(99,102,241,0.08)', color: '#6366F1', border: '1px solid rgba(99,102,241,0.2)' }}>
                  DEMO DATA
                </span>
              )}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 64, textAlign: 'center' }}>Rank</th>
                    <th>Brand</th>
                    <th style={{ textAlign: 'right' }}>Current {metric === 'views' ? 'Views' : 'Freq'}</th>
                    <th style={{ textAlign: 'right' }}>Previous</th>
                    <th style={{ textAlign: 'right' }}>Growth %</th>
                    <th style={{ textAlign: 'center' }}>Rank Mov</th>
                    <th>Activity ({period})</th>
                    <th style={{ textAlign: 'center' }}>Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {activeData.map((row, i) => {
                    const color = COLORS[i % COLORS.length]
                    const pos = row.growthPercent >= 0
                    const isHighGrowth = row.growthPercent > 15
                    const isDecline = row.growthPercent < -5
                    return (
                      <tr key={row.brand_name}>
                        <td style={{ textAlign: 'center', fontWeight: 800 }}>#{i + 1}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                            <span style={{ fontWeight: 700, color: '#1E293B' }}>{row.brand_name}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(row.currentValue)}</td>
                        <td style={{ textAlign: 'right', color: '#64748B' }}>{fmt(row.previousValue)}</td>
                        <td style={{ textAlign: 'right', color: pos ? '#10B981' : '#EF4444', fontWeight: 700 }}>
                          {pos ? '+' : ''}{row.growthPercent.toFixed(1)}%
                        </td>
                        <td style={{ textAlign: 'center' }}><RankBadge val={row.rankMovement} /></td>
                        <td><MiniSparkBar data={row.sparklineData || []} color={color} /></td>
                        <td style={{ textAlign: 'center' }}>
                          {isHighGrowth ? (
                            <span className="badge badge-orange" style={{ gap: 4 }}>
                              <AlertTriangle size={10} /> Fast Velocity
                            </span>
                          ) : isDecline ? (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>Declining</span>
                          ) : (
                            <span style={{ color: '#CBD5E1', fontSize: 11 }}>Stable</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
