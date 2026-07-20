'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, Download, Loader2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { useCampaignStore } from '@/lib/store'
import { getClientCache, setClientCache } from '@/lib/cache'
import { brandColor } from '@/lib/brand-colors'

function fmt(n: number | null | undefined) {
  if (n === null || n === undefined || isNaN(n)) return '—'
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toLocaleString()
}

function GrowthBadge({ val }: { val: number }) {
  if (val > 0) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#059669', fontWeight: 700, fontSize: 12, padding: '2px 8px', borderRadius: 20, background: 'var(--green-dim)', border: '1px solid rgba(0,200,83,0.15)' }}><TrendingUp size={12} /> +{val.toFixed(1)}%</span>
  if (val < 0) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#DC2626', fontWeight: 700, fontSize: 12, padding: '2px 8px', borderRadius: 20, background: 'var(--red-dim)', border: '1px solid rgba(255,45,85,0.15)' }}><TrendingDown size={12} /> {val.toFixed(1)}%</span>
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--text-muted)', fontWeight: 600, fontSize: 12 }}><Minus size={11} /> 0%</span>
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1E293B', border: 'none', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
      <div style={{ fontSize: 10.5, color: '#94A3B8', marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {payload.map((p: any, i: number) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3 }}><span style={{ fontSize: 11, color: '#CBD5E1' }}>{p.name}</span><span style={{ fontSize: 12, fontWeight: 800, color: p.fill || p.color }}>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span></div>)}
    </div>
  )
}

type SortKey = 'growth' | 'name' | 'current'

export default function GrowthTab() {
  const { activeCampaignId } = useCampaignStore()
  const [metric, setMetric] = useState<'views' | 'frequency'>('views')
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('7d')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any[]>([])
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'ours' | 'theirs'>('all')
  const [sortBy, setSortBy] = useState<SortKey>('growth')

  const fetchGrowth = useCallback(async (campId: string, m: string, p: string, o: string) => {
    if (!campId) return
    const ck = `growth-v3:${campId}:${m}:${p}:${o}`
    const cached = getClientCache<any>(ck)
    if (cached) { setData(cached.data ?? []); setLoading(false); return }
    setLoading(true)
    try {
      const params = new URLSearchParams({ campaign_id: campId, metric: m, period: p })
      if (o !== 'all') params.set('is_ours', o === 'ours' ? 'true' : 'false')
      const res = await fetch(`/api/brands/growth?${params}`); const d = await res.json(); setData(d.data ?? []); setClientCache(ck, d)
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (activeCampaignId) fetchGrowth(activeCampaignId, metric, period, ownershipFilter) }, [activeCampaignId, metric, period, ownershipFilter, fetchGrowth])

  const sorted = useMemo(() => {
    const arr = [...data]; arr.sort((a, b) => { switch (sortBy) { case 'growth': return b.growthPercent - a.growthPercent; case 'name': return a.brand_name.localeCompare(b.brand_name); case 'current': return b.currentValue - a.currentValue; default: return 0 } }); return arr
  }, [data, sortBy])

  const chartData = useMemo(() => sorted.map(d => ({ name: d.brand_name, growth: d.growthPercent })), [sorted])

  const handleExport = () => {
    const headers = 'Brand,Current,Previous,Growth %,Videos'; const rows = data.map(b => `"${b.brand_name}",${b.currentValue},${b.previousValue},${b.growthPercent}%,${b.video_count}`)
    const blob = new Blob([headers + '\n' + rows.join('\n')], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `brand_growth_${metric}.csv`; a.click()
  }

  if (loading) return <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: 'var(--text-muted)' }}><Loader2 size={18} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} /> Loading…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['24h', '7d', '30d'] as const).map(p => <button key={p} onClick={() => setPeriod(p)} className={`toggle-btn ${period === p ? 'on' : ''}`}>{p === '24h' ? '24 Hours' : p === '7d' ? '7 Days' : '30 Days'}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select className="input" value={ownershipFilter} onChange={e => setOwnershipFilter(e.target.value as any)} style={{ fontSize: 11, padding: '5px 8px', minWidth: 110 }}>
            <option value="all">All Videos</option><option value="ours">Our Videos</option><option value="theirs">Not Ours</option>
          </select>
          <div style={{ display: 'flex', border: '1px solid var(--border-2)', borderRadius: 'var(--border-radius-xs)', overflow: 'hidden' }}>
            <button onClick={() => setMetric('views')} className={`toggle-btn ${metric === 'views' ? 'on' : ''}`}>Views</button>
            <button onClick={() => setMetric('frequency')} className={`toggle-btn ${metric === 'frequency' ? 'on' : ''}`}>Frequency</button>
          </div>
          <select className="input" value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} style={{ fontSize: 11, padding: '5px 8px', minWidth: 100 }}>
            <option value="growth">Sort: Growth</option><option value="name">Sort: Name</option><option value="current">Sort: Value</option>
          </select>
          <button onClick={handleExport} className="btn btn-ghost btn-sm"><Download size={11} /> CSV</button>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 32)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-1)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={v => `${v}%`} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={120} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine x={0} stroke="var(--border-2)" />
              <Bar dataKey="growth" radius={[0, 4, 4, 0]} maxBarSize={24}>
                {chartData.map((entry, i) => <Cell key={i} fill={brandColor(entry.name)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {sorted.length > 0 ? (
        <div className="grid-3">
          {sorted.map(b => {
            const c = brandColor(b.brand_name)
            return (
              <div key={b.brand_name} className="card-interactive">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 10, height: 10, borderRadius: 3, background: c }} /><span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-bright)' }}>{b.brand_name}</span></div>
                  <GrowthBadge val={b.growthPercent} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 11 }}>
                  <div><div style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>Current</div><div style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(b.currentValue)}</div></div>
                  <div><div style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>Previous</div><div style={{ fontWeight: 700, color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>{fmt(b.previousValue)}</div></div>
                  <div><div style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>Videos</div><div style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{b.video_count || 0}</div></div>
                </div>
              </div>
            )
          })}
        </div>
      ) : <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No growth data.</div>}
    </div>
  )
}
