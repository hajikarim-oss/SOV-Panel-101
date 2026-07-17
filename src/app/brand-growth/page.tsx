'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, Minus, Download, AlertCircle, RefreshCw, Zap } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, Legend } from 'recharts'
import { useCampaignStore } from '@/lib/store'
import { getClientCache, setClientCache } from '@/lib/cache'
import { PageSkeleton } from '@/components/PageSkeleton'
import Link from 'next/link'

const COLORS = ['#1A73E8', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899', '#94A3B8']

function fmt(n: number | null | undefined) {
  if (n === null || n === undefined || isNaN(n)) return '—'
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toLocaleString()
}

function GrowthBadge({ val }: { val: number }) {
  if (val > 0) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#059669', fontWeight: 700, fontSize: 12, padding: '2px 8px', borderRadius: 20, background: '#ECFDF5', border: '1px solid #A7F3D0' }}><TrendingUp size={12} /> +{val.toFixed(1)}%</span>
  if (val < 0) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#DC2626', fontWeight: 700, fontSize: 12, padding: '2px 8px', borderRadius: 20, background: '#FEF2F2', border: '1px solid #FECACA' }}><TrendingDown size={12} /> {val.toFixed(1)}%</span>
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#94A3B8', fontWeight: 600, fontSize: 12 }}><Minus size={11} /> 0%</span>
}

function RankBadge({ val }: { val: number }) {
  if (val > 0) return <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#10B981', fontWeight: 700, fontSize: 12 }}><TrendingUp size={12} /> +{val}</span>
  if (val < 0) return <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#EF4444', fontWeight: 700, fontSize: 12 }}><TrendingDown size={12} /> {val}</span>
  return <span style={{ color: '#94A3B8', fontSize: 11 }}>—</span>
}

function MiniSparkBar({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length === 0 || data.every(v => v === 0)) return <span style={{ fontSize: 10, color: '#CBD5E1' }}>—</span>
  const max = Math.max(...data) || 1
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 24, width: 48 }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, height: `${Math.max(15, (v / max) * 100)}%`, borderRadius: 2, background: i === data.length - 1 ? color : `${color}30` }} />
      ))}
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
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'ours' | 'theirs'>('all')

  const fetchGrowth = useCallback(async (campId: string, m: 'views' | 'frequency', p: string, o?: string) => {
    if (!campId) return
    const ownershipParam = o && o !== 'all' ? `&is_ours=${o === 'ours'}` : ''
    const cacheKey = `growth:${campId}:${m}:${p}:${o ?? 'all'}`
    const cached = getClientCache<any>(cacheKey)
    if (cached) {
      if (cached.data) setData(cached.data)
      setHasScrapeData(cached.has_scrape_data ?? false)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/brands/growth?campaign_id=${campId}&metric=${m}&period=${p}${ownershipParam}`)
      const d = await res.json()
      if (d.data) setData(d.data)
      setHasScrapeData(d.has_scrape_data ?? false)
      setClientCache(cacheKey, d)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])
  useEffect(() => {
    if (activeCampaignId) fetchGrowth(activeCampaignId, metric, period, ownershipFilter)
    else setLoading(false)
  }, [activeCampaignId, metric, period, ownershipFilter, fetchGrowth])

  const handleExport = () => {
    const headers = 'Brand,Current Value,Previous Value,Growth %,Videos Tracked'
    const rows = data.map(b => `"${b.brand_name}",${b.currentValue},${b.previousValue},${b.growthPercent}%,${b.video_count}`)
    const blob = new Blob([headers + '\n' + rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `brand_growth_${metric}.csv`; a.click()
  }

  if (loading) return (
    <div className="anim-fade-up">
      <PageSkeleton cols={2} rows={4} />
    </div>
  )

  if (!activeCampaignId) return (
    <div className="anim-fade-up">
      <div className="page-header">
        <div>
          <h1 className="page-title">Brand <span className="accent">Growth</span></h1>
          <p className="page-subtitle">Velocity tracking and period comparison</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, background: '#fff', borderRadius: 14, border: '1px solid #F1F5F9' }}>
        <AlertCircle size={36} style={{ color: '#CBD5E1' }} />
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1E293B' }}>Select a Campaign</div>
        <div style={{ fontSize: 13, color: '#64748B' }}>Choose a campaign to view brand growth data</div>
      </div>
    </div>
  )

  const sorted = [...data].sort((a, b) => b.growthPercent - a.growthPercent)
  const topGainer = sorted[0]
  const topLoser = sorted[sorted.length - 1]

  return (
    <div className="anim-fade-up">
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div className="page-header">
        <div>
          <h1 className="page-title">Brand <span className="accent">Growth</span></h1>
          <p className="page-subtitle">Velocity tracking and period comparison</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 130 }}>
            <select
              className="input"
              value={ownershipFilter}
              onChange={e => setOwnershipFilter(e.target.value as 'all' | 'ours' | 'theirs')}
              style={{ cursor: 'pointer', padding: '6px 12px', minWidth: 130 }}
            >
              <option value="all">All Videos</option>
              <option value="ours">Our Videos</option>
              <option value="theirs">Not Our Videos</option>
            </select>
          </div>
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
          <button className="btn btn-ghost btn-sm" onClick={handleExport} disabled={data.length === 0}>
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {data.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, background: '#fff', borderRadius: 14, border: '1px solid #F1F5F9' }}>
          <AlertCircle size={36} style={{ color: '#CBD5E1' }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1E293B' }}>No Brand Growth Data</div>
          <div style={{ fontSize: 13, color: '#64748B', textAlign: 'center', maxWidth: 360 }}>
            Tag brands and trigger a scrape from <Link href="/control" style={{ color: '#1A73E8', fontWeight: 600 }}>Campaign Control</Link> to generate growth metrics.
          </div>
        </div>
      ) : (
        <>
          {!hasScrapeData && (
            <div className="card" style={{ padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, borderLeft: '3px solid #1A73E8' }}>
              <RefreshCw size={18} style={{ color: '#1A73E8', flexShrink: 0, animation: 'spin 8s linear infinite' }} />
              <div style={{ fontSize: 13, color: '#1E3A8A' }}>
                <strong>Partial data.</strong> Run a scrape to generate view snapshots for accurate growth tracking.
              </div>
            </div>
          )}

          {/* KPI Strip */}
          {sorted.length >= 2 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #D1FAE5', display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <TrendingUp size={20} style={{ color: '#10B981' }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top Gainer</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#064E3B', marginTop: 1 }}>{topGainer?.brand_name}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#10B981', marginTop: 1 }}>+{topGainer?.growthPercent.toFixed(1)}%</div>
                </div>
              </div>
              <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #FECACA', display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <TrendingDown size={20} style={{ color: '#EF4444' }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Needs Attention</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#7F1D1D', marginTop: 1 }}>{topLoser?.brand_name}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#EF4444', marginTop: 1 }}>{topLoser?.growthPercent.toFixed(1)}%</div>
                </div>
              </div>
            </div>
          )}

          {/* Growth Velocity Bar Chart */}
          <div className="card" style={{ padding: '20px 22px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Growth Velocity</div>
                <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>Growth rate (%) per brand over {period}</div>
              </div>
              <Zap size={16} style={{ color: '#F59E0B' }} />
            </div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sorted} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="brand_name" tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis unit="%" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'Growth']} contentStyle={{ background: '#1E293B', border: 'none', borderRadius: 8 }} labelStyle={{ color: '#94A3B8' }} itemStyle={{ color: '#FFF' }} />
                  <ReferenceLine y={0} stroke="#CBD5E1" strokeDasharray="4 4" />
                  <Bar dataKey="growthPercent" name="Growth" radius={[6, 6, 0, 0]}>
                    {sorted.map((entry, index) => (
                      <Cell key={index} fill={entry.growthPercent >= 0 ? '#10B981' : '#EF4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Performance Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Brand Performance</div>
              <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>All brands ranked by {metric === 'views' ? 'view' : 'frequency'} growth</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 50, textAlign: 'center' }}>#</th>
                    <th>Brand</th>
                    <th style={{ textAlign: 'right' }}>Current</th>
                    <th style={{ textAlign: 'right' }}>Previous</th>
                    <th style={{ textAlign: 'right' }}>Growth</th>
                    <th style={{ textAlign: 'center' }}>Rank</th>
                    <th>Sparkline</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row, i) => {
                    const color = COLORS[data.findIndex(d => d.brand_name === row.brand_name) % COLORS.length]
                    return (
                      <tr key={row.brand_name}>
                        <td style={{ textAlign: 'center', fontWeight: 800, color: '#94A3B8' }}>{i + 1}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                            <span style={{ fontWeight: 700, color: '#1E293B' }}>{row.brand_name}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(row.currentValue)}</td>
                        <td style={{ textAlign: 'right', color: '#64748B' }}>{fmt(row.previousValue)}</td>
                        <td style={{ textAlign: 'right' }}><GrowthBadge val={row.growthPercent} /></td>
                        <td style={{ textAlign: 'center' }}><RankBadge val={row.rankMovement} /></td>
                        <td><MiniSparkBar data={row.sparklineData || []} color={color} /></td>
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