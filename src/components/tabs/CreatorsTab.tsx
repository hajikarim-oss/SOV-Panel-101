'use client'

import { useState, useMemo } from 'react'
import {
  BarChart, Bar, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, XAxis, YAxis, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend
} from 'recharts'
import { motion } from 'framer-motion'
import {
  Users, Star, TrendingUp, Layers, Zap, Info
} from 'lucide-react'
import { useDashboard } from '@/lib/dashboard-context'

const C = [
  '#4C78A8', '#54A24B', '#E45756', '#72B7B2', '#EECA3B',
  '#B279A2', '#FF9DA6', '#9D755D', '#BAB0AC', '#D67195',
  '#F58518', '#4C78A8', '#54A24B', '#E45756', '#72B7B2',
  '#79B8FF', '#A8D8B9', '#F4A582', '#CAB2D6', '#FFFFB3',
]

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

function Rank({ n }: { n: number }) {
  const c = n <= 3 ? '#059669' : n <= 5 ? '#1A73E8' : n <= 10 ? '#7C3AED' : '#D97706'
  const bg = n <= 3 ? 'rgba(5,150,105,0.08)' : n <= 5 ? 'rgba(26,115,232,0.08)' : n <= 10 ? 'rgba(124,58,237,0.08)' : 'rgba(217,119,6,0.08)'
  return <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 6px', borderRadius: 5, background: bg, color: c }}>#{n}</span>
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

export default function CreatorsTab() {
  const { videos, setDrawerType, downloadCSV } = useDashboard()
  const [creatorFormat, setCreatorFormat] = useState<'all' | 'long' | 'short'>('all')
  const [creatorMinVideos, setCreatorMinVideos] = useState<number>(1)
  const [channelSearch, setChannelSearch] = useState('')

  const analytics = useMemo(() => {
    const creatorChanMap = new Map<string, { name: string; views: number; count: number; shorts: number; bestRank: number; kws: Set<string>; brands: Set<string> }>()
    videos.forEach((v: any) => {
      if (creatorFormat !== 'all') {
        if (creatorFormat === 'long' && v.is_short) return
        if (creatorFormat === 'short' && !v.is_short) return
      }
      const n = v.channel_name
      if (!n) return
      if (!creatorChanMap.has(n)) creatorChanMap.set(n, { name: n, views: 0, count: 0, shorts: 0, bestRank: 99, kws: new Set(), brands: new Set() })
      const s = creatorChanMap.get(n)!
      s.views += v.view_count || 0
      s.count++
      if (v.is_short) s.shorts++
      s.bestRank = Math.min(s.bestRank, v.best_rank || 99)
      ;(v.keywords_appeared || []).forEach((k: string) => s.kws.add(k))
      ;(v.tags || v.brands || []).forEach((b: string) => s.brands.add(b))
    })

    const channels = Array.from(creatorChanMap.values())
      .filter(c => c.count >= creatorMinVideos)
      .map(c => ({
        ...c,
        kwCount: c.kws.size,
        brandCount: c.brands.size,
        avgViews: c.count > 0 ? Math.round(c.views / c.count) : 0,
        shortsRatio: c.count > 0 ? Math.round((c.shorts / c.count) * 100) : 0,
        efficiency: c.kws.size > 0 ? Math.round(c.views / c.kws.size) : 0
      }))
      .sort((a, b) => b.views - a.views)

    const topCreatorChart = channels.slice(0, 8).map((c, i) => ({
      name: c.name.length > 11 ? c.name.slice(0, 11) + '...' : c.name,
      Views: c.views, Videos: c.count, AvgViews: c.avgViews, fill: C[i % C.length]
    }))

    const topCreators5 = channels.slice(0, 5)
    const maxViews = Math.max(...topCreators5.map(c => c.views)) || 1
    const maxKws = Math.max(...topCreators5.map(c => c.kwCount)) || 1
    const maxAvg = Math.max(...topCreators5.map(c => c.avgViews)) || 1
    const creatorRadar = topCreators5.map((c, i) => ({
      creator: c.name.slice(0, 10),
      'Views Reach': Math.round((c.views / maxViews) * 100),
      'Keyword Cover': Math.round((c.kwCount / maxKws) * 100),
      'Avg Efficiency': Math.round((c.avgViews / maxAvg) * 100),
      'Brand Span': Math.min(100, c.brandCount * 20),
      'Shorts Mix': c.shortsRatio,
      color: C[i % C.length]
    }))

    return { channels, topCreatorChart, creatorRadar }
  }, [videos, creatorFormat, creatorMinVideos])

  const { channels, topCreatorChart, creatorRadar } = analytics
  const filteredChannels = channels.filter(c => c.name.toLowerCase().includes(channelSearch.toLowerCase()))

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {[
          { label: 'Total Creators', value: channels.length, icon: Users, color: '#1A73E8', sub: 'Active in campaign' },
          { label: 'Premium Creators', value: channels.filter(c => c.avgViews > 150_000).length, icon: Star, color: '#059669', sub: 'Avg views > 1.5L' },
          { label: 'Avg Partnership ROI', value: channels.length > 0 ? fmt(Math.round(channels.reduce((s, c) => s + c.avgViews, 0) / channels.length)) : '—', icon: TrendingUp, color: '#8B5CF6', sub: 'Views per video' },
          { label: 'Multi-Brand Creators', value: channels.filter(c => c.brandCount > 1).length, icon: Layers, color: '#F59E0B', sub: 'Work with 2+ brands' },
          { label: 'Shorts Specialists', value: channels.filter(c => c.shortsRatio > 60).length, icon: Zap, color: '#EC4899', sub: '>60% shorts content' },
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

      {/* Partnership Score Matrix + Creator-Brand Fit */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card
          title="Partnership score matrix"
          sub="Composite score: views reach x efficiency x keyword coverage x brand diversity"
          height={280}
          info="Higher partnership score = better ROI potential."
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select className="select-filter" value={creatorFormat} onChange={(e) => setCreatorFormat(e.target.value as any)}>
                <option value="all">All formats</option>
                <option value="long">Long-form</option>
                <option value="short">Shorts</option>
              </select>
              <select className="select-filter" value={creatorMinVideos} onChange={(e) => setCreatorMinVideos(Number(e.target.value))}>
                <option value={1}>1+ videos</option>
                <option value={3}>3+ videos</option>
                <option value={5}>5+ videos</option>
              </select>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={channels.slice(0, 8).map((c, i) => {
              const viewScore = Math.round((c.views / (channels[0]?.views || 1)) * 100)
              const effScore = Math.round((c.avgViews / (channels[0]?.avgViews || 1)) * 100)
              const kwScore = Math.round((c.kwCount / (channels.reduce((m, ch) => Math.max(m, ch.kwCount), 1))) * 100)
              const brandScore = Math.min(100, c.brandCount * 25)
              const partnershipScore = Math.round(viewScore * 0.3 + effScore * 0.25 + kwScore * 0.25 + brandScore * 0.2)
              return {
                name: c.name.length > 12 ? c.name.slice(0, 12) + '...' : c.name,
                'Partnership Score': partnershipScore,
                'View Reach': viewScore,
                'Efficiency': effScore,
                fill: C[i % C.length]
              }
            })} layout="vertical" margin={{ top: 4, right: 50, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9.5, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={(v: any) => `${v}`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} width={85} />
              <RechartsTooltip
                content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload
                  return (
                    <div style={{ background: '#0F172A', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', minWidth: 160 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#FFF', marginBottom: 6 }}>{label}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 3 }}>Partnership Score: <strong style={{ color: '#38BDF8' }}>{d?.['Partnership Score']}</strong></div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 3 }}>View Reach: <strong style={{ color: '#34D399' }}>{d?.['View Reach']}%</strong></div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>Efficiency: <strong style={{ color: '#FBBF24' }}>{d?.['Efficiency']}%</strong></div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="Partnership Score" radius={[0, 6, 6, 0]} barSize={18}>
                {channels.slice(0, 8).map((_, i) => <Cell key={i} fill={C[i % C.length]} fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Creator-Brand Alignment */}
        <Card
          title="Creator-brand alignment"
          sub="Which creators work best for each brand - view share percentage"
          height={280}
          info="Shows the percentage of each creator's total views from content featuring each brand."
        >
          <div style={{ overflowX: 'auto', height: '100%' }}>
            <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: 20 }}>Align your campaign with the right creators.</p>
          </div>
        </Card>
      </div>

      {/* Creator Radar */}
      {creatorRadar.length > 1 && (
        <Card
          title="Creator capability radar"
          sub="Multi-dimensional profiling - identifies partnership fit for different campaign goals"
          height={280}
          info="Each axis represents a partnership criterion. Wider coverage = more versatile creator."
        >
          <div style={{ display: 'flex', gap: 16, height: '100%' }}>
            <div style={{ flex: 1.5 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={[
                  { subject: 'Views Reach', ...Object.fromEntries(creatorRadar.map((c: any) => [c.creator, c['Views Reach']])) },
                  { subject: 'KW Cover', ...Object.fromEntries(creatorRadar.map((c: any) => [c.creator, c['Keyword Cover']])) },
                  { subject: 'Avg Eff.', ...Object.fromEntries(creatorRadar.map((c: any) => [c.creator, c['Avg Efficiency']])) },
                  { subject: 'Brand Span', ...Object.fromEntries(creatorRadar.map((c: any) => [c.creator, c['Brand Span']])) },
                  { subject: 'Shorts Mix', ...Object.fromEntries(creatorRadar.map((c: any) => [c.creator, c['Shorts Mix']])) },
                ]}>
                  <PolarGrid stroke="#F1F5F9" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8, fill: '#CBD5E1' }} tickCount={3} />
                  {creatorRadar.map((c: any, i: number) => (
                    <Radar key={c.creator} name={c.creator} dataKey={c.creator} stroke={c.color} fill={c.color} fillOpacity={0.08} strokeWidth={2} />
                  ))}
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 10.5 }} />
                  <RechartsTooltip contentStyle={{ background: '#0F172A', border: 'none', borderRadius: 8, fontSize: 11 }} itemStyle={{ color: '#FFF' }} labelStyle={{ color: '#94A3B8' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ width: 200, display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Partnership Goals</div>
              {[
                { goal: 'Max Reach', desc: 'Choose creators with high Views Reach', color: '#1A73E8' },
                { goal: 'Brand Awareness', desc: 'High KW Cover + Brand Span', color: '#10B981' },
                { goal: 'Quality Views', desc: 'High Avg Efficiency scores', color: '#8B5CF6' },
                { goal: 'Multi-Brand', desc: 'High Brand Span = experienced', color: '#F59E0B' },
                { goal: 'Shorts Campaign', desc: 'High Shorts Mix ratio', color: '#EC4899' },
              ].map((g, i) => (
                <div key={i} style={{ padding: '6px 8px', borderRadius: 6, background: '#F8FAFC', borderLeft: `3px solid ${g.color}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1E293B' }}>{g.goal}</div>
                  <div style={{ fontSize: 9.5, color: '#64748B', lineHeight: 1.3 }}>{g.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Creator Leaderboard */}
      <div style={{ background: '#FFF', borderRadius: 12, border: '1px solid #F1F5F9', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Creator partnership leaderboard</div>
            <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>Ranked by partnership score</div>
          </div>
          <input
            type="text" placeholder="Search creators..." value={channelSearch}
            onChange={(e) => setChannelSearch(e.target.value)}
            style={{
              background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 6, padding: '4px 10px',
              fontSize: 11.5, fontWeight: 600, color: '#475569', outline: 'none', width: 160,
            }}
          />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                {['#', 'Creator', 'Partnership Score', 'Videos', 'Total Views', 'Avg/Video', 'Keywords', 'Brand Span', 'Best Rank', 'Fit Tier'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: h === '#' || h === 'Best Rank' ? 'center' : 'left', fontSize: 10.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap', background: '#FAFBFC' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredChannels.slice(0, 10).map((c: any, i: number) => {
                const viewScore = Math.round((c.views / (channels[0]?.views || 1)) * 100)
                const effScore = Math.round((c.avgViews / (channels[0]?.avgViews || 1)) * 100)
                const kwScore = Math.round((c.kwCount / (channels.reduce((m, ch) => Math.max(m, ch.kwCount), 1))) * 100)
                const brandScore = Math.min(100, c.brandCount * 25)
                const partnershipScore = Math.round(viewScore * 0.3 + effScore * 0.25 + kwScore * 0.25 + brandScore * 0.2)
                const fitTier = partnershipScore > 75 ? { label: 'Tier 1 - Premium', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' }
                  : partnershipScore > 55 ? { label: 'Tier 2 - Strong', color: '#1A73E8', bg: 'rgba(26,115,232,0.06)', border: 'rgba(26,115,232,0.2)' }
                  : partnershipScore > 35 ? { label: 'Tier 3 - Growing', color: '#D97706', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)' }
                  : { label: 'Tier 4 - Emerging', color: '#94A3B8', bg: '#F8FAFC', border: '#E2E8F0' }
                return (
                  <tr key={c.name} className="row-hover" style={{ borderBottom: '1px solid #F8FAFC', cursor: 'pointer' }}
                    onClick={() => { window.location.href = `/channel/${encodeURIComponent(c.name)}` }}
                  >
                    <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 800, fontSize: 11.5, color: C[i % C.length] }}>#{i + 1}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${C[i % C.length]}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: C[i % C.length], flexShrink: 0 }}>{c.name.charAt(0)}</div>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1E293B' }}>{c.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 50, height: 6, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ width: `${partnershipScore}%`, height: '100%', background: partnershipScore > 75 ? '#059669' : partnershipScore > 55 ? '#1A73E8' : partnershipScore > 35 ? '#F59E0B' : '#94A3B8', borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', fontFamily: "'JetBrains Mono',monospace" }}>{partnershipScore}</span>
                      </div>
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 600, color: '#334155' }}>{c.count}</td>
                    <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{fmt(c.views)}</td>
                    <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 600, color: '#1A73E8' }}>{fmt(c.avgViews)}</td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: '#64748B' }}>{c.kwCount}</td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: '#64748B' }}>{c.brandCount}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'center' }}><Rank n={c.bestRank || 99} /></td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: fitTier.bg, color: fitTier.color, border: `1px solid ${fitTier.border}`, whiteSpace: 'nowrap' }}>{fitTier.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  )
}
