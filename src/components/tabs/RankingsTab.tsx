'use client'

import { useState, useMemo } from 'react'
import {
  BarChart, Bar, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, XAxis, YAxis, CartesianGrid,
  ScatterChart, Scatter, ZAxis, Legend
} from 'recharts'
import { motion } from 'framer-motion'
import {
  Target, Award, Hash, BarChart2, TrendingUp, Info, Download
} from 'lucide-react'
import { useDashboard } from '@/lib/dashboard-context'

const C = [
  '#4C78A8', '#54A24B', '#E45756', '#72B7B2', '#EECA3B',
  '#B279A2', '#FF9DA6', '#9D755D', '#BAB0AC', '#D67195',
  '#F58518', '#4C78A8', '#54A24B', '#E45756', '#72B7B2',
  '#79B8FF', '#A8D8B9', '#F4A582', '#CAB2D6', '#FFFFB3',
]

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0F172A', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 24px rgba(0,0,0,0.3)', minWidth: 130 }}>
      {label && <p style={{ fontSize: 10, color: '#64748B', margin: '0 0 6px', fontWeight: 600 }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.color || p.fill, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: '#94A3B8', flex: 1 }}>{p.name}</span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#FFF' }}>
            {typeof p.value === 'number' ? (p.value > 9999 ? fmt(p.value) : p.value % 1 !== 0 ? p.value.toFixed(1) : p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function Rank({ n }: { n: number }) {
  const c = n <= 3 ? '#059669' : n <= 5 ? '#1A73E8' : n <= 10 ? '#7C3AED' : '#D97706'
  const bg = n <= 3 ? 'rgba(5,150,105,0.08)' : n <= 5 ? 'rgba(26,115,232,0.08)' : n <= 10 ? 'rgba(124,58,237,0.08)' : 'rgba(217,119,6,0.08)'
  return <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 6px', borderRadius: 5, background: bg, color: c }}>#{n}</span>
}

function Bar100({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 4, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden', minWidth: 60 }}>
      <div style={{ height: '100%', width: `${Math.min(100, value)}%`, background: color, borderRadius: 99 }} />
    </div>
  )
}

function Card({ title, sub, height = 240, children, right, info }: {
  title: string; sub?: string; height?: number; children: React.ReactNode; right?: React.ReactNode; info?: string
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', border: '1px solid #F1F5F9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
            {info && <span title={info} style={{ cursor: 'help', color: '#CBD5E1', flexShrink: 0 }}><Info size={11} /></span>}
          </div>
          {sub && <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>{sub}</div>}
        </div>
        {right && <div style={{ marginLeft: 8, flexShrink: 0 }}>{right}</div>}
      </div>
      <div style={{ height }}>{children}</div>
    </div>
  )
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toLocaleString()
}

function pct(a: number, b: number) {
  if (!b) return 0
  return Math.round((a / b) * 1000) / 10
}

// ── Main Component ────────────────────────────────────────────────
export default function RankingsTab() {
  const { videos, keywords, overview, isDemo, setDrawerType, downloadCSV, distinctBrands } = useDashboard()
  const [rankRangeFilter, setRankRangeFilter] = useState<'all' | 'top3' | 'top5' | 'top10'>('all')
  const [rankBrandFilter, setRankBrandFilter] = useState<string>('all')

  const analytics = useMemo(() => {
    let filteredRankVideos = videos
    if (rankBrandFilter !== 'all') {
      filteredRankVideos = filteredRankVideos.filter((v: any) => (v.tags || v.brands || []).includes(rankBrandFilter))
    }
    if (rankRangeFilter !== 'all') {
      filteredRankVideos = filteredRankVideos.filter((v: any) => {
        const r = v.best_rank || 20
        if (rankRangeFilter === 'top3') return r <= 3
        if (rankRangeFilter === 'top5') return r <= 5
        if (rankRangeFilter === 'top10') return r <= 10
        return true
      })
    }

    const rankBuckets = [
      { range: '#1', min: 1, max: 1, count: 0, fill: '#059669' },
      { range: '#2–3', min: 2, max: 3, count: 0, fill: '#10B981' },
      { range: '#4–5', min: 4, max: 5, count: 0, fill: '#1A73E8' },
      { range: '#6–10', min: 6, max: 10, count: 0, fill: '#8B5CF6' },
      { range: '#11–15', min: 11, max: 15, count: 0, fill: '#F59E0B' },
      { range: '#16–20', min: 16, max: 20, count: 0, fill: '#EF4444' },
    ]
    filteredRankVideos.forEach(v => {
      const r = v.best_rank ?? 20
      const b = rankBuckets.find(bk => r >= bk.min && r <= bk.max)
      if (b) b.count++
    })

    const scatterData = filteredRankVideos.slice(0, 50).map((v, i) => ({
      views: v.view_count || 0, rank: v.best_rank || 20,
      z: Math.max(30, (v.keyword_count || 1) * 70),
      title: v.title, fill: C[i % C.length]
    }))

    const longForm = videos.filter((v: any) => !v.is_short)
    const shorts = videos.filter((v: any) => v.is_short)

    const rankTypeCompare = [
      { range: 'Top 1', long: longForm.filter(v => v.best_rank === 1).length, shorts: shorts.filter(v => v.best_rank === 1).length },
      { range: 'Top 3', long: longForm.filter(v => v.best_rank <= 3).length, shorts: shorts.filter(v => v.best_rank <= 3).length },
      { range: 'Top 5', long: longForm.filter(v => v.best_rank <= 5).length, shorts: shorts.filter(v => v.best_rank <= 5).length },
      { range: 'Top 10', long: longForm.filter(v => v.best_rank <= 10).length, shorts: shorts.filter(v => v.best_rank <= 10).length },
    ]

    return { rankBuckets, filteredRankVideos, scatterData, rankTypeCompare, longForm, shorts }
  }, [videos, rankBrandFilter, rankRangeFilter])

  const { rankBuckets, filteredRankVideos, scatterData, rankTypeCompare } = analytics

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        {[
          { label: 'Total Ranked', value: rankBuckets.reduce((s, b) => s + b.count, 0), icon: Target, color: '#1A73E8', sub: 'Videos in rankings' },
          { label: 'Top-3 Videos', value: rankBuckets.slice(0, 2).reduce((s, b) => s + b.count, 0), icon: Award, color: '#059669', sub: 'High-impact positions' },
          { label: 'Ranking Keywords', value: keywords.length, icon: Hash, color: '#8B5CF6', sub: 'Tracked keywords' },
          {
            label: 'Avg Rank Position', value: filteredRankVideos.length > 0 ? (filteredRankVideos.reduce((s: number, v: any) => s + (v.best_rank || 20), 0) / filteredRankVideos.length).toFixed(1) : '—',
            icon: BarChart2, color: '#F59E0B', sub: 'Lower = better'
          },
          {
            label: 'Top 10 Coverage', value: `${keywords.length > 0 ? Math.round((rankBuckets.slice(0, 4).reduce((s, b) => s + b.count, 0) / Math.max(1, rankBuckets.reduce((s, b) => s + b.count, 0))) * 100) : 0}%`,
            icon: TrendingUp, color: '#EC4899', sub: 'Of total ranked'
          },
        ].map((kpi, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: '1px solid #F1F5F9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `${kpi.color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <kpi.icon size={14} style={{ color: kpi.color }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>{kpi.label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', fontFamily: "'JetBrains Mono',monospace" }}>{kpi.value}</div>
            <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 2 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Position Distribution + Competitive Brand Rankings */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card
          title="Position distribution"
          sub="Number of videos in search rank categories"
          height={220}
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select className="select-filter" value={rankBrandFilter} onChange={(e) => setRankBrandFilter(e.target.value)}>
                <option value="all">All brands</option>
                {distinctBrands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <select className="select-filter" value={rankRangeFilter} onChange={(e) => setRankRangeFilter(e.target.value as any)}>
                <option value="all">All ranks</option>
                <option value="top3">Top 3 only</option>
                <option value="top5">Top 5 only</option>
                <option value="top10">Top 10 only</option>
              </select>
              <button onClick={() => setDrawerType('rank_detail')} style={{ background: '#F1F5F9', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#1E293B' }}>
                View more
              </button>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rankBuckets} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9.5, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <RechartsTooltip formatter={(v: any) => [v + ' videos', 'Count']} contentStyle={{ background: '#0F172A', border: 'none', borderRadius: 8, fontSize: 11 }} itemStyle={{ color: '#FFF' }} labelStyle={{ color: '#94A3B8' }} />
              <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                {rankBuckets.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Competitive Brand Ranking Comparison */}
        <Card
          title="Brand ranking comparison"
          sub="How brands perform across ranking tiers — competitive positioning"
          height={220}
          info="Shows the distribution of each brand's videos across ranking positions. Brands with more videos in positions 1–3 have stronger search dominance. Brands concentrated in 6–10 have growth opportunity."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[
              { tier: 'Top 1-3', ...Object.fromEntries(distinctBrands.slice(0, 4).map((b) => {
                const count = filteredRankVideos.filter((v: any) => (v.tags || v.brands || []).includes(b) && (v.best_rank || 20) <= 3).length
                return [b, count]
              })) },
              { tier: 'Top 4-5', ...Object.fromEntries(distinctBrands.slice(0, 4).map((b) => {
                const count = filteredRankVideos.filter((v: any) => (v.tags || v.brands || []).includes(b) && (v.best_rank || 20) > 3 && (v.best_rank || 20) <= 5).length
                return [b, count]
              })) },
              { tier: 'Top 6-10', ...Object.fromEntries(distinctBrands.slice(0, 4).map((b) => {
                const count = filteredRankVideos.filter((v: any) => (v.tags || v.brands || []).includes(b) && (v.best_rank || 20) > 5 && (v.best_rank || 20) <= 10).length
                return [b, count]
              })) },
              { tier: '11-20', ...Object.fromEntries(distinctBrands.slice(0, 4).map((b) => {
                const count = filteredRankVideos.filter((v: any) => (v.tags || v.brands || []).includes(b) && (v.best_rank || 20) > 10).length
                return [b, count]
              })) },
            ]} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="tier" tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9.5, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <RechartsTooltip content={<Tip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 10.5 }} />
              {distinctBrands.slice(0, 4).map((b, i) => (
                <Bar key={b} dataKey={b} name={b} fill={C[i % C.length]} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Long-form vs Shorts + Ranking Opportunities */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card title="Long-form vs shorts by position" sub="Format dominance per ranking tier" height={220}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rankTypeCompare} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9.5, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <RechartsTooltip content={<Tip />} />
              <Bar dataKey="long" name="Long-form" fill="#10B981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="shorts" name="Shorts" fill="#8B5CF6" radius={[3, 3, 0, 0]} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 10.5 }} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Ranking Opportunities */}
        <Card
          title="Ranking opportunities"
          sub="Videos near top positions — easiest to push higher"
          height={220}
          info="These videos are ranked 4–10 and could potentially reach top 3 with optimization. Focus partnership and SEO efforts here for maximum ROI."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', maxHeight: 180 }}>
            {filteredRankVideos
              .filter((v: any) => (v.best_rank || 20) >= 4 && (v.best_rank || 20) <= 10)
              .sort((a: any, b: any) => (a.best_rank || 20) - (b.best_rank || 20))
              .slice(0, 5)
              .map((v: any, i: number) => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #F1F5F9' }}>
                  <Rank n={v.best_rank || 20} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</div>
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>{v.channel_name} · {fmt(v.view_count)} views</div>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#1A73E8', background: 'rgba(26,115,232,0.06)', padding: '2px 8px', borderRadius: 20 }}>
                    +{Math.round(v.view_count * 0.15)} potential
                  </div>
                </div>
              ))}
            {filteredRankVideos.filter((v: any) => (v.best_rank || 20) >= 4 && (v.best_rank || 20) <= 10).length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: '#94A3B8', fontSize: 12 }}>No videos in #4-10 range</div>
            )}
          </div>
        </Card>
      </div>

      {/* Scatter bubble map */}
      <Card
        title="Views vs search position bubble map"
        sub="Each bubble = one video. X = search rank (lower is better), Y = view count. Bubble size = keyword span (number of keywords it ranks for)"
        height={260}
        info="Ideal bubbles are large and positioned top-left (high views, high rank). Bubbles at the bottom-right (low views, low rank) are underperformers. Use this to identify which videos have high keyword coverage but haven't driven views yet."
      >
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 4, right: 10, left: -20, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis
              type="number" dataKey="rank" name="Search Rank" domain={[1, 20]} reversed
              tick={{ fontSize: 9.5, fill: '#94A3B8' }} axisLine={false} tickLine={false}
              label={{ value: '<- Better Rank | Worse Rank ->', position: 'insideBottom', offset: -14, fontSize: 9.5, fill: '#94A3B8' }}
            />
            <YAxis
              type="number" dataKey="views" name="Views"
              tick={{ fontSize: 9.5, fill: '#94A3B8' }} tickFormatter={(v: any) => fmt(v)} axisLine={false} tickLine={false}
            />
            <ZAxis type="number" dataKey="z" range={[30, 220]} />
            <RechartsTooltip
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null
                const d = payload[0]?.payload
                if (!d) return null
                return (
                  <div style={{ background: '#0F172A', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', maxWidth: 200 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#FFF', marginBottom: 4, lineHeight: 1.4 }}>{d.title}</div>
                    <div style={{ fontSize: 10.5, color: '#94A3B8' }}>Search Rank: <strong style={{ color: '#38BDF8' }}>#{d.rank}</strong></div>
                    <div style={{ fontSize: 10.5, color: '#94A3B8' }}>Views: <strong style={{ color: '#34D399' }}>{fmt(d.views)}</strong></div>
                    <div style={{ fontSize: 10.5, color: '#94A3B8' }}>Keywords: <strong style={{ color: '#FFF' }}>{Math.round(d.z / 70)}</strong></div>
                  </div>
                )
              }}
            />
            {scatterData.map((d: any, i: number) => <Scatter key={i} data={[d]} fill={d.fill} fillOpacity={0.75} />)}
          </ScatterChart>
        </ResponsiveContainer>
      </Card>

      {/* Ranking Insight Callouts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {[
          {
            icon: '🏆', title: 'Top-3 density',
            value: `${rankBuckets.slice(0, 2).reduce((s, b) => s + b.count, 0)} videos`,
            desc: 'Videos ranking 1-3 across all keywords - your strongest search presence',
            accent: '#059669', bg: '#ECFDF5', border: '#A7F3D0',
            action: 'Maintain and protect these positions'
          },
          {
            icon: '🚀', title: 'Quick wins (4-5)',
            value: `${rankBuckets[2]?.count ?? 0} videos`,
            desc: 'One step from top 3 - highest ROI optimization targets',
            accent: '#1A73E8', bg: 'rgba(26,115,232,0.06)', border: 'rgba(26,115,232,0.15)',
            action: 'Partner boost + SEO optimization'
          },
          {
            icon: '📊', title: 'Growth pool (6-10)',
            value: `${rankBuckets[3]?.count ?? 0} videos`,
            desc: 'Largest segment - push to top 5 for significant SOV gains',
            accent: '#8B5CF6', bg: 'rgba(139,92,246,0.06)', border: 'rgba(139,92,246,0.2)',
            action: 'Content refresh + creator collabs'
          },
          {
            icon: '⚠️', title: 'At risk (11-20)',
            value: `${rankBuckets[4]?.count ?? 0} videos`,
            desc: 'Dropping from visibility - urgent action needed to prevent further loss',
            accent: '#F59E0B', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)',
            action: 'Re-optimize titles, thumbnails, descriptions'
          },
        ].map(c => (
          <div key={c.title} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{c.icon}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{c.title}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: c.accent, fontFamily: "'JetBrains Mono',monospace", margin: '3px 0' }}>{c.value}</div>
            <div style={{ fontSize: 10.5, color: '#475569', lineHeight: 1.4 }}>{c.desc}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: c.accent, marginTop: 6, fontStyle: 'italic' }}>→ {c.action}</div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
