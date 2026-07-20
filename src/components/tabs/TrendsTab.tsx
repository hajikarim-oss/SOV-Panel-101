'use client'

import { useState, useEffect, useMemo } from 'react'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Loader2, Download } from 'lucide-react'
import { useCampaignStore } from '@/lib/store'
import { useQuery } from '@tanstack/react-query'
import { brandColor } from '@/lib/brand-colors'

const RANGES = [
  { key: '1', label: 'Daily' }, { key: '7', label: '7 Days' }, { key: '30', label: '30 Days' },
  { key: '90', label: '3 Months' }, { key: '180', label: '6 Months' }, { key: '365', label: '1 Year' },
]

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const sorted = [...payload].filter(p => p.value > 0).sort((a: any, b: any) => b.value - a.value)
  return (
    <div style={{ background: '#1E293B', border: 'none', borderRadius: 10, padding: '10px 14px', minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
      <div style={{ fontSize: 10.5, color: '#94A3B8', marginBottom: 8, fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 6 }}>{label}</div>
      {sorted.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.fill }} /><span style={{ fontSize: 11, color: '#CBD5E1', fontWeight: 600 }}>{p.name}</span></div>
          <span style={{ fontSize: 12, fontWeight: 800, color: p.color || p.fill }}>{(p.value as number).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  )
}

function computeBrandStats(data: any[], brands: string[]) {
  if (!data.length) return []
  const last = data[data.length - 1]; const prev = data.length > 1 ? data[data.length - 2] : null
  return brands.map(b => ({
    brand: b, current: last[b] ?? 0, prev: prev?.[b] ?? 0,
    delta: prev ? ((last[b] ?? 0) - (prev[b] ?? 0)) : 0,
    peak: Math.max(...data.map(d => d[b] ?? 0)), avg: data.reduce((s, d) => s + (d[b] ?? 0), 0) / data.length,
    color: brandColor(b),
  })).sort((a, b) => b.current - a.current)
}

export default function TrendsTab() {
  const { activeCampaignId } = useCampaignStore()
  const [days, setDays] = useState('30')
  const [chartType, setChartType] = useState<'area' | 'line'>('area')
  const [activeBrands, setActiveBrands] = useState<string[]>([])
  const [showAvg, setShowAvg] = useState(false)
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'ours' | 'theirs'>('all')
  const [metric, setMetric] = useState<'views' | 'frequency'>('views')

  const trendTabQuery = useQuery({
    queryKey: ['trends-tab', activeCampaignId, days, ownershipFilter, metric],
    queryFn: async () => {
      const params = new URLSearchParams({ campaign_id: activeCampaignId!, days })
      if (ownershipFilter !== 'all') params.set('is_ours', ownershipFilter === 'ours' ? 'true' : 'false')
      if (metric === 'frequency') params.set('metric', 'frequency')
      const res = await fetch(`/api/sov-trend?${params}`)
      if (!res.ok) throw new Error('Failed to fetch trend data')
      return res.json()
    },
    enabled: !!activeCampaignId,
  })

  const data = trendTabQuery.data?.data ?? []
  const brands = trendTabQuery.data?.brands ?? []

  useEffect(() => {
    if (trendTabQuery.data?.brands) setActiveBrands(trendTabQuery.data.brands)
  }, [trendTabQuery.data?.brands])

  const toggleBrand = (b: string) => setActiveBrands(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])

  const enrichedData = useMemo(() => {
    if (!showAvg) return data
    return data.map((d: any, i: number) => {
      const row = { ...d }
      for (const b of activeBrands) { const w = data.slice(Math.max(0, i - 2), i + 1); row[`${b}_avg`] = Math.round((w.reduce((s: number, x: any) => s + (x[b] ?? 0), 0) / w.length) * 10) / 10 }
      return row
    })
  }, [data, showAvg, activeBrands])

  const brandStats = useMemo(() => computeBrandStats(data, brands), [data, brands])

  const handleExport = () => {
    const headers = ['Date', ...brands]; const rows = data.map((d: any) => [d.date, ...brands.map((b: string) => String(d[b] ?? 0))])
    const blob = new Blob([headers.join(',') + '\n' + rows.map((r: any[]) => r.join(',')).join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'sov_trend.csv'; a.click()
  }

  if (trendTabQuery.isLoading) return <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: 'var(--text-muted)' }}><Loader2 size={18} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} /> Loading…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {RANGES.map(r => <button key={r.key} onClick={() => setDays(r.key)} className={`toggle-btn ${days === r.key ? 'on' : ''}`}>{r.label}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="input" value={ownershipFilter} onChange={e => setOwnershipFilter(e.target.value as any)} style={{ fontSize: 11, padding: '5px 8px', minWidth: 110 }}>
            <option value="all">All Videos</option><option value="ours">Our Videos</option><option value="theirs">Not Ours</option>
          </select>
          <div style={{ display: 'flex', border: '1px solid var(--border-2)', borderRadius: 'var(--border-radius-xs)', overflow: 'hidden' }}>
            <button onClick={() => setMetric('views')} className={`toggle-btn ${metric === 'views' ? 'on' : ''}`}>Views</button>
            <button onClick={() => setMetric('frequency')} className={`toggle-btn ${metric === 'frequency' ? 'on' : ''}`}>Frequency</button>
          </div>
          <div style={{ display: 'flex', border: '1px solid var(--border-2)', borderRadius: 'var(--border-radius-xs)', overflow: 'hidden' }}>
            <button onClick={() => setChartType('area')} className={`toggle-btn ${chartType === 'area' ? 'on' : ''}`}>Area</button>
            <button onClick={() => setChartType('line')} className={`toggle-btn ${chartType === 'line' ? 'on' : ''}`}>Line</button>
          </div>
          <button onClick={() => setShowAvg(v => !v)} className={`toggle-btn ${showAvg ? 'on' : ''}`}>3d avg</button>
          <button onClick={handleExport} className="btn btn-ghost btn-sm"><Download size={11} /> CSV</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {brands.map((b: string) => { const on = activeBrands.includes(b); const c = brandColor(b)
          return <button key={b} onClick={() => toggleBrand(b)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, border: `1.5px solid ${on ? c : 'var(--border-2)'}`, background: on ? `${c}10` : '#fff', color: on ? c : 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: on ? c : 'var(--border-2)' }} />{b}</button> })}
      </div>

      <div className="chart-container" style={{ minHeight: 340 }}>
        {enrichedData.length === 0 ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No data.</div> : (
          <ResponsiveContainer width="100%" height={320}>
            {chartType === 'area' ? (
              <AreaChart data={enrichedData}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-1)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={d => d?.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={v => `${v}%`} />
                <Tooltip content={<ChartTooltip />} />
                {activeBrands.map(b => <Area key={b} type="monotone" dataKey={b} stroke={brandColor(b)} fill={`${brandColor(b)}20`} strokeWidth={2} dot={false} />)}
                {showAvg && activeBrands.map(b => <Line key={`${b}_avg`} type="monotone" dataKey={`${b}_avg`} stroke={brandColor(b)} strokeWidth={1} strokeDasharray="4 4" dot={false} />)}
              </AreaChart>
            ) : (
              <LineChart data={enrichedData}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-1)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={d => d?.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={v => `${v}%`} />
                <Tooltip content={<ChartTooltip />} />
                {activeBrands.map(b => <Line key={b} type="monotone" dataKey={b} stroke={brandColor(b)} strokeWidth={2} dot={false} />)}
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {brandStats.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 80px 80px', padding: '10px 14px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-1)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            <div>Brand</div><div style={{ textAlign: 'right' }}>Current</div><div style={{ textAlign: 'right' }}>Previous</div><div style={{ textAlign: 'right' }}>Change</div><div style={{ textAlign: 'right' }}>Peak</div><div style={{ textAlign: 'right' }}>Average</div>
          </div>
          {brandStats.map(s => (
            <div key={s.brand} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 80px 80px', padding: '10px 14px', borderBottom: '1px solid var(--border-1)', fontSize: 12, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} /><span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.brand}</span></div>
              <div style={{ textAlign: 'right', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{s.current.toFixed(1)}%</div>
              <div style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{s.prev.toFixed(1)}%</div>
              <div style={{ textAlign: 'right', fontWeight: 700, color: s.delta > 0 ? '#059669' : s.delta < 0 ? '#DC2626' : 'var(--text-muted)' }}>{s.delta > 0 ? '+' : ''}{s.delta.toFixed(1)}%</div>
              <div style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{s.peak.toFixed(1)}%</div>
              <div style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{s.avg.toFixed(1)}%</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
