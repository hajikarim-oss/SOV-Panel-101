'use client'

import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { useCampaignStore } from '@/lib/store'
import { PageSkeleton } from '@/components/PageSkeleton'
import { Loader2, Eye, Hash, TrendingUp, Award, ChevronRight } from 'lucide-react'
import Link from 'next/link'

const COLORS = ['#1A73E8', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899', '#14B8A6', '#F97316', '#6366F1']

function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '0'
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toLocaleString()
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="tooltip-box">
      <div style={{ fontWeight: 700, color: 'var(--text-bright)', marginBottom: 4 }}>{d.name}</div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>SOV: <strong style={{ color: 'var(--text-primary)' }}>{d.sov_percent?.toFixed(1)}%</strong></div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Views: <strong style={{ color: 'var(--text-primary)' }}>{fmt(d.total_views)}</strong></div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Videos: <strong style={{ color: 'var(--text-primary)' }}>{d.video_count}</strong></div>
    </div>
  )
}

export default function BrandIntelligencePage() {
  const { campaigns, activeCampaignId, fetchCampaigns } = useCampaignStore()
  const [brands, setBrands] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'views' | 'freq'>('views')
  const [hasData, setHasData] = useState(false)

  const fetchData = useCallback(async () => {
    if (!activeCampaignId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/brands?campaign_id=${activeCampaignId}`)
      const d = await res.json()
      setBrands(d.data || [])
      setHasData(d.has_scrape_data || false)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [activeCampaignId])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])
  useEffect(() => { fetchData() }, [fetchData])

  const sorted = [...brands].sort((a, b) =>
    sortBy === 'views'
      ? (b.total_views || 0) - (b.total_views || 0) - ((a.total_views || 0) - (a.total_views || 0))
      : (b.total_frequency || 0) - (a.total_frequency || 0)
  )
  // Fix: proper sort
  const sortedBrands = [...brands].sort((a, b) =>
    sortBy === 'views' ? (b.total_views || 0) - (a.total_views || 0) : (b.total_frequency || 0) - (a.total_frequency || 0)
  )

  const topBrand = sortedBrands[0]
  const marketLeader = sortedBrands.find(b => b.sov_percent > 50) || sortedBrands[0]
  const growthOpp = sortedBrands.find(b => b.sov_percent > 0 && b.sov_percent < 10 && b.video_count > 3) || sortedBrands[sortedBrands.length - 1]

  const chartData = sortedBrands.slice(0, 8).map(b => ({ name: b.name, total_views: b.total_views || 0, sov_percent: b.sov_percent || 0 }))
  const pieData = sortedBrands.filter(b => b.sov_percent > 0.5).slice(0, 8).map(b => ({ name: b.name, value: b.total_views || 0, sov_percent: b.sov_percent }))

  return (
    <div className="anim-fade-up">
      <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      <div className="page-header">
        <div>
          <h1 className="page-title">Brand <span className="accent">Intelligence</span></h1>
          <p className="page-subtitle">Deep analytics: Share-of-Voice, frequency rankings, and competitive positioning</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="toggle-group">
            <button className={`toggle-btn ${sortBy === 'views' ? 'active' : ''}`} onClick={() => setSortBy('views')}>By Views</button>
            <button className={`toggle-btn ${sortBy === 'freq' ? 'active' : ''}`} onClick={() => setSortBy('freq')}>By Frequency</button>
          </div>
          <Link href="/control" className="btn btn-blue btn-sm">
            <Award size={13} /> Manage Brands
          </Link>
        </div>
      </div>

      {loading ? (
        <PageSkeleton cols={4} rows={5} />
      ) : sortedBrands.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <Award size={36} style={{ color: '#CBD5E1', marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 4 }}>No Brands Found</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Tag videos with brands in the leaderboard to see intelligence data.</div>
        </div>
      ) : (
        <>
          {/* Market Leader + Growth Opportunity */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            {marketLeader && (
              <div style={{ background: 'linear-gradient(135deg, #ECFDF5, #F0FDF4)', borderRadius: 14, padding: '20px 24px', border: '1px solid #A7F3D0' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Market Leader</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Award size={20} color="#FFF" />
                  </div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#065F46' }}>{marketLeader.name}</div>
                    <div style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>{marketLeader.sov_percent?.toFixed(1)}% view SOV · {fmt(marketLeader.total_views)} views</div>
                  </div>
                </div>
              </div>
            )}
            {growthOpp && growthOpp !== marketLeader && (
              <div style={{ background: 'linear-gradient(135deg, #FFF7ED, #FFFBEB)', borderRadius: 14, padding: '20px 24px', border: '1px solid #FDE68A' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Growth Opportunity</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingUp size={20} color="#FFF" />
                  </div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#92400E' }}>{growthOpp.name}</div>
                    <div style={{ fontSize: 13, color: '#D97706', fontWeight: 600 }}>{growthOpp.sov_percent?.toFixed(1)}% view SOV · {growthOpp.video_count} videos</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 }}>
            {/* Horizontal Bar Chart */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '18px 22px 0' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-bright)' }}>SOV by Brand</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>Share of Voice — top {Math.min(sortedBrands.length, 8)} brands</div>
              </div>
              <div style={{ padding: '8px 12px 12px', height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 40, left: 80, bottom: 0 }}>
                    <XAxis type="number" tickFormatter={v => v + '%'} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }} axisLine={false} tickLine={false} width={75} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(26,115,232,0.04)' }} />
                    <Bar dataKey="sov_percent" radius={[0, 6, 6, 0]} barSize={24}>
                      {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pie Chart */}
            {pieData.length > 0 && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '18px 22px 0' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-bright)' }}>SOV Distribution</div>
                </div>
                <div style={{ padding: '8px 12px 12px', height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={2}>
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Brand Rankings Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid rgba(26,115,232,0.08)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-bright)' }}>Brand Rankings</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>All brands sorted by {sortBy === 'views' ? 'view share' : 'keyword frequency'}</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 50, textAlign: 'center' }}>#</th>
                    <th>Brand</th>
                    <th style={{ textAlign: 'right' }}>View SOV</th>
                    <th style={{ textAlign: 'right' }}>Views</th>
                    <th style={{ textAlign: 'right' }}>Videos</th>
                    <th style={{ textAlign: 'right' }}>Freq SOV</th>
                    <th style={{ width: 60 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBrands.map((b, i) => (
                    <tr key={b.name}>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: i < 3 ? 'rgba(26,115,232,0.12)' : 'transparent',
                          color: i < 3 ? '#1A73E8' : 'var(--text-muted)',
                          fontWeight: 800, fontSize: 12, margin: '0 auto',
                        }}>
                          {i + 1}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{b.name}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="mono" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{b.sov_percent?.toFixed(1)}%</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="mono">{fmt(b.total_views)}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="mono">{b.video_count || 0}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="mono">{b.freq_sov_percent?.toFixed(1)}%</span>
                      </td>
                      <td>
                        <Link href={`/brands/${encodeURIComponent(b.name)}`} style={{ color: 'var(--text-muted)', display: 'inline-flex' }}>
                          <ChevronRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
