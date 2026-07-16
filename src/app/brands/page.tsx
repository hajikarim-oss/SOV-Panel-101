'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Legend, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, ScatterChart, Scatter, ZAxis,
  ComposedChart, Line, Area, LineChart, ReferenceLine
} from 'recharts'
import { useCampaignStore } from '@/lib/store'
import { ChevronRight, Loader2, AlertCircle, Tag, RefreshCw, TrendingUp, TrendingDown, Eye, BarChart2, Award, Zap } from 'lucide-react'
import Link from 'next/link'

const COLORS = ['#1A73E8', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899', '#94A3B8']

// Demo Data for Water Purifier Market
const DEMO_BRANDS_DATA = [
  { name: 'Aquaguard', total_views: 4_820_000, sov_percent: 36.2, video_count: 42, total_frequency: 312, freq_sov_percent: 34.5 },
  { name: 'KENT RO', total_views: 3_210_000, sov_percent: 24.1, video_count: 31, total_frequency: 228, freq_sov_percent: 25.2 },
  { name: 'Livpure', total_views: 2_140_000, sov_percent: 16.1, video_count: 24, total_frequency: 160, freq_sov_percent: 17.7 },
  { name: 'Pureit', total_views: 1_680_000, sov_percent: 12.6, video_count: 18, total_frequency: 98, freq_sov_percent: 10.8 },
  { name: 'AO Smith', total_views: 870_000, sov_percent: 6.5, video_count: 11, total_frequency: 74, freq_sov_percent: 8.2 },
]

function fmt(n: number | null | undefined) {
  if (n === null || n === undefined || isNaN(n)) return '—'
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
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
          <span style={{ fontSize: 12, fontWeight: 700, color: '#FFF' }}>{typeof p.value === 'number' && p.value > 1000 ? fmt(p.value) : typeof p.value === 'number' ? p.value.toFixed(1) + (p.unit || '') : p.value}</span>
        </div>
      ))}
    </div>
  )
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: '#1E293B', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#FFF', marginBottom: 4 }}>{d.name}</div>
      <div style={{ fontSize: 11.5, color: '#94A3B8' }}>SOV: <strong style={{ color: '#FFF' }}>{d.sov_percent?.toFixed(1)}%</strong></div>
      <div style={{ fontSize: 11.5, color: '#94A3B8' }}>Views: <strong style={{ color: '#FFF' }}>{fmt(d.value)}</strong></div>
      {d.video_count !== undefined && <div style={{ fontSize: 11.5, color: '#94A3B8' }}>Videos: <strong style={{ color: '#FFF' }}>{d.video_count}</strong></div>}
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

// Brand KPI Card with progress bar
function BrandKPICard({ brand, views, freq, sovV, sovF, color, rank, videoCount }: any) {
  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 12, padding: '16px 18px', border: '1px solid #F1F5F9',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'all 0.2s',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 20px ${color}20, 0 1px 4px rgba(0,0,0,0.04)`; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color, flexShrink: 0 }}>#{rank}</div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{brand}</div>
        <span style={{ fontSize: 11, fontWeight: 700, color, background: `${color}10`, padding: '2px 8px', borderRadius: 20 }}>{sovV.toFixed(1)}%</span>
      </div>

      {/* View SOV bar */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>VIEW SOV</span>
          <span style={{ fontSize: 10, fontWeight: 700, color }}>{fmt(views)}</span>
        </div>
        <div style={{ height: 6, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${sovV}%`, background: `linear-gradient(90deg, ${color}, ${color}BB)`, borderRadius: 99, transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
        </div>
      </div>

      {/* Freq SOV bar */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>FREQ SOV</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B' }}>{freq} kw</span>
        </div>
        <div style={{ height: 6, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${sovF}%`, background: `${color}50`, borderRadius: 99, transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, paddingTop: 8, borderTop: '1px solid #F8FAFC' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', fontFamily: "'JetBrains Mono',monospace" }}>{videoCount}</div>
          <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600 }}>VIDEOS</div>
        </div>
        <div style={{ width: 1, background: '#F1F5F9' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', fontFamily: "'JetBrains Mono',monospace" }}>{sovF.toFixed(1)}%</div>
          <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600 }}>FREQ%</div>
        </div>
      </div>
    </div>
  )
}

export default function BrandsPage() {
  const { activeCampaignId, fetchCampaigns } = useCampaignStore()
  const [brands, setBrands] = useState<any[]>([])
  const [hasScrapeData, setHasScrapeData] = useState(false)
  const [loading, setLoading] = useState(true)
  const [chartMode, setChartMode] = useState<'views' | 'freq'>('views')
  const [showDemo, setShowDemo] = useState(true)

  const fetchBrands = useCallback(async (campId: string) => {
    if (!campId) {
      // Use demo data when no campaign is selected
      if (showDemo) {
        setBrands(DEMO_BRANDS_DATA)
        setHasScrapeData(true)
      }
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/brands?campaign_id=${campId}`)
      const d = await res.json()
      if (d.data && d.data.length > 0) {
        setBrands(d.data)
        setHasScrapeData(d.has_scrape_data ?? false)
        setShowDemo(false)
      } else if (showDemo) {
        // Fallback to demo data
        setBrands(DEMO_BRANDS_DATA)
        setHasScrapeData(true)
      }
    } catch (e) {
      console.error(e)
      if (showDemo) {
        setBrands(DEMO_BRANDS_DATA)
        setHasScrapeData(true)
      }
    }
    finally { setLoading(false) }
  }, [showDemo])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])
  useEffect(() => {
    if (activeCampaignId) fetchBrands(activeCampaignId)
    else fetchBrands('') // Load demo data
  }, [activeCampaignId, fetchBrands])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 12 }}>
      <Loader2 size={32} style={{ color: '#1A73E8', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  // ── Derived data ──────────────────────────────────────────────────────
  const totalViews = brands.reduce((s, b) => s + (b.total_views ?? b.brand_total_views ?? 0), 0) || 1
  const totalFreq = brands.reduce((s, b) => s + (b.total_frequency ?? b.brand_total_freq ?? 0), 0) || 1

  const pieData = brands.map((b, i) => ({
    name: b.name ?? b.brand_name,
    value: b.total_views ?? b.brand_total_views ?? 0,
    sov_percent: b.sov_percent ?? 0,
    video_count: b.video_count ?? 0,
    color: COLORS[i % COLORS.length],
  }))

  const freqPieData = brands.map((b, i) => ({
    name: b.name ?? b.brand_name,
    value: b.total_frequency ?? b.brand_total_freq ?? 0,
    sov_percent: b.freq_sov_percent ?? 0,
    color: COLORS[i % COLORS.length],
  }))

  // Grouped bar: views + freq per brand
  const groupedBar = brands.slice(0, 8).map((b, i) => ({
    name: (b.name ?? b.brand_name ?? '').slice(0, 12),
    Views: b.total_views ?? b.brand_total_views ?? 0,
    Frequency: b.total_frequency ?? b.brand_total_freq ?? 0,
    color: COLORS[i % COLORS.length],
  }))

  // Radar data
  const radarData = brands.slice(0, 5).map((b, i) => ({
    brand: (b.name ?? b.brand_name ?? '').slice(0, 10),
    ViewSOV: b.sov_percent ?? 0,
    FreqSOV: b.freq_sov_percent ?? 0,
    Videos: Math.min(100, ((b.video_count ?? 0) / Math.max(...brands.map(x => x.video_count ?? 0), 1)) * 100),
  }))

  // Scatter: x=views, y=freq_sov, size=video_count
  const scatterData = brands.map((b, i) => ({
    x: b.total_views ?? b.brand_total_views ?? 0,
    y: b.freq_sov_percent ?? 0,
    z: Math.max(100, (b.video_count ?? 1) * 40),
    name: b.name ?? b.brand_name,
    color: COLORS[i % COLORS.length],
  }))

  // Top and bottom performer
  const sorted = [...brands].sort((a, b) => (b.sov_percent ?? 0) - (a.sov_percent ?? 0))
  const topBrand = sorted[0]
  const bottomBrand = sorted[sorted.length - 1]

  return (
    <div className="anim-fade-up">
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Brand <span className="accent">Intelligence</span></h1>
          <p className="page-subtitle">Deep analytics: Share-of-Voice, frequency rankings, and competitive positioning</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, padding: 2, gap: 1 }}>
            <button onClick={() => setChartMode('views')} style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, background: chartMode === 'views' ? '#1A73E8' : 'transparent', color: chartMode === 'views' ? '#FFF' : '#64748B', border: 'none', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}>By Views</button>
            <button onClick={() => setChartMode('freq')} style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, background: chartMode === 'freq' ? '#1A73E8' : 'transparent', color: chartMode === 'freq' ? '#FFF' : '#64748B', border: 'none', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}>By Frequency</button>
          </div>
          <Link href="/control" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, background: '#1A73E8', color: '#FFF', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            <Tag size={14} /> Manage Brands
          </Link>
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
              Showing brand intelligence for 5 brands. Real data will replace this once a campaign is selected with scrape data.
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

      {brands.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 16, background: '#FFFFFF', borderRadius: 14, border: '1px solid #F1F5F9' }}>
          <AlertCircle size={40} style={{ color: '#CBD5E1' }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1E293B' }}>No brands registered</div>
          <div style={{ fontSize: 13, color: '#64748B', textAlign: 'center', maxWidth: 380 }}>
            Add brand names in Campaign Control → Brands tab to calculate SOV and frequency.
          </div>
          <Link href="/control" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, background: '#1A73E8', color: '#FFF', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            Go to Campaign Control <ChevronRight size={14} />
          </Link>
        </div>
      ) : (
        <>
          {!hasScrapeData && !showDemo && (
            <div style={{ display: 'flex', gap: 12, padding: '16px 20px', borderRadius: 12, background: 'rgba(26,115,232,0.06)', border: '1px solid rgba(26,115,232,0.18)', marginBottom: 20, alignItems: 'center' }}>
              <RefreshCw size={20} style={{ color: '#1A73E8', flexShrink: 0, animation: 'spin 8s linear infinite' }} />
              <div style={{ fontSize: 13, color: '#1E3A8A', lineHeight: 1.5 }}>
                <strong>No Scrape Data Yet:</strong> Brands are registered. Go to{' '}
                <Link href="/control" style={{ fontWeight: 700, color: '#1A73E8', textDecoration: 'underline' }}>Campaign Control</Link>{' '}
                and click <strong>"Scrape Campaign"</strong> to calculate SOV.
              </div>
            </div>
          )}

          {/* ── Winner / Loser Strip ── */}
          {hasScrapeData && sorted.length >= 2 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div style={{ background: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)', borderRadius: 12, padding: '14px 18px', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Award size={18} style={{ color: '#FFF' }} />
                </div>
                <div>
                   <div style={{ fontSize: 10.5, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Market leader</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#064E3B' }}>{topBrand?.name ?? topBrand?.brand_name}</div>
                  <div style={{ fontSize: 11, color: '#10B981', fontWeight: 600 }}>{topBrand?.sov_percent?.toFixed(1)}% view SOV</div>
                </div>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)', borderRadius: 12, padding: '14px 18px', border: '1px solid #FDE68A', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Zap size={18} style={{ color: '#FFF' }} />
                </div>
                <div>
                   <div style={{ fontSize: 10.5, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Growth opportunity</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#78350F' }}>{bottomBrand?.name ?? bottomBrand?.brand_name}</div>
                  <div style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600 }}>{bottomBrand?.sov_percent?.toFixed(1)}% view SOV</div>
                </div>
              </div>
            </div>
          )}

          {/* ── Brand KPI Cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14, marginBottom: 24 }}>
            {brands.map((b, i) => (
              <Link key={b.name ?? b.brand_name} href={`/brands/${encodeURIComponent(b.name ?? b.brand_name)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <BrandKPICard
                  rank={i + 1}
                  brand={b.name ?? b.brand_name}
                  views={b.total_views ?? b.brand_total_views ?? 0}
                  freq={b.total_frequency ?? b.brand_total_freq ?? 0}
                  sovV={b.sov_percent ?? 0}
                  sovF={b.freq_sov_percent ?? 0}
                  videoCount={b.video_count ?? 0}
                  color={COLORS[i % COLORS.length]}
                />
              </Link>
            ))}
          </div>

          {/* ── Main Analytics Charts Row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 20 }}>

            {/* Donut: View or Freq SOV */}
            <ChartCard
              title={chartMode === 'views' ? 'View SOV Distribution' : 'Frequency SOV Distribution'}
              subtitle={chartMode === 'views' ? 'Share of total extracted views per brand' : 'Share of keyword appearances per brand'}
              height={220}
            >
              {hasScrapeData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartMode === 'views' ? pieData : freqPieData}
                      dataKey="value" nameKey="name"
                      cx="50%" cy="50%"
                      innerRadius={58} outerRadius={90}
                      paddingAngle={3}
                    >
                      {(chartMode === 'views' ? pieData : freqPieData).map((d, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent"
                          style={{ filter: `drop-shadow(0 0 4px ${COLORS[i % COLORS.length]}60)` }} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 12.5 }}>
                  Run a scrape to see SOV distribution
                </div>
              )}
            </ChartCard>

            {/* Grouped Bar Chart: Views + Freq */}
            <ChartCard
              title="Views vs frequency comparison"
              subtitle="Side-by-side brand performance on both metrics"
              height={220}
            >
              {hasScrapeData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groupedBar} margin={{ top: 4, right: 8, left: -10, bottom: 0 }} barGap={3} barCategoryGap="28%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: '#94A3B8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="Views" radius={[5, 5, 0, 0]}>
                      {groupedBar.map((d, i) => <Cell key={i} fill={`${d.color}EE`} />)}
                    </Bar>
                    <Bar dataKey="Frequency" radius={[5, 5, 0, 0]}>
                      {groupedBar.map((d, i) => <Cell key={i} fill={`${d.color}55`} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 12.5 }}>
                  No views to compare. Run a campaign scrape.
                </div>
              )}
            </ChartCard>
          </div>

          {/* ── Radar + Scatter ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 20 }}>

            {/* Radar: multi-dim brand comparison */}
            {radarData.length > 0 && (
              <ChartCard title="Brand radar — multi-dimension" subtitle="View SOV, freq SOV, and video coverage per brand" height={260}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                    <PolarGrid stroke="#F1F5F9" />
                    <PolarAngleAxis dataKey="brand" tick={{ fontSize: 10.5, fill: '#64748B', fontWeight: 600 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8, fill: '#94A3B8' }} tickCount={3} />
                    <Radar name="View SOV" dataKey="ViewSOV" stroke="#1A73E8" fill="#1A73E8" fillOpacity={0.18} strokeWidth={2} dot={{ r: 3, fill: '#1A73E8' }} />
                    <Radar name="Freq SOV" dataKey="FreqSOV" stroke="#10B981" fill="#10B981" fillOpacity={0.12} strokeWidth={2} dot={{ r: 3, fill: '#10B981' }} />
                    <Radar name="Video Coverage" dataKey="Videos" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.08} strokeWidth={2} dot={{ r: 3, fill: '#F59E0B' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                    <Tooltip content={<ChartTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* Market Share: 100% stacked bar */}
            {hasScrapeData && groupedBar.length > 0 && (
              <ChartCard title="Market share — SOV % per brand" subtitle="Normalized 100% share of voice distribution" height={260}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[{
                      name: 'Market',
                      ...Object.fromEntries(brands.map(b => [b.name ?? b.brand_name, b.sov_percent ?? 0]))
                    }]}
                    layout="vertical"
                    margin={{ top: 8, right: 30, left: 40, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                    <XAxis type="number" unit="%" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    {brands.map((b, i) => (
                      <Bar
                        key={b.name ?? b.brand_name}
                        dataKey={b.name ?? b.brand_name}
                        stackId="a"
                        fill={COLORS[i % COLORS.length]}
                        barSize={36}
                        radius={i === brands.length - 1 ? [0, 6, 6, 0] : i === 0 ? [6, 0, 0, 6] : [0, 0, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          {/* ── Views Bar (full width) ── */}
          <ChartCard title="Total views per brand" subtitle="Cumulative extracted views across all ranked videos" height={220}>
            {hasScrapeData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={groupedBar} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="Views" radius={[7, 7, 0, 0]}>
                    {groupedBar.map((d, i) => (
                      <Cell key={i} fill={d.color}
                        style={{ filter: `drop-shadow(0 2px 8px ${d.color}40)` }} />
                    ))}
                  </Bar>
                  <ReferenceLine
                    y={groupedBar.reduce((s, d) => s + d.Views, 0) / Math.max(groupedBar.length, 1)}
                    stroke="#94A3B8" strokeDasharray="4 4" strokeWidth={1.5}
                    label={{ value: 'Avg', position: 'right', fill: '#94A3B8', fontSize: 10 }}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 12.5 }}>
                No views to compare. Run a campaign scrape.
              </div>
            )}
          </ChartCard>
        </>
      )}
    </div>
  )
}
