'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, ExternalLink, Eye, Play, Award, Hash, Star, LayoutGrid,
  TrendingUp, ThumbsUp, MessageSquare, Video, Loader2, AlertCircle, Tv,
  BarChart3, Search, Zap
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'
import { useCampaignStore } from '@/lib/store'

const C = ['#1A73E8', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4', '#EF4444', '#14B8A6']

function fmtNum(n: number | null | undefined) {
  if (!n) return '—'
  if (n >= 1_00_00_000) return (n / 1_00_00_000).toFixed(2) + ' Cr'
  if (n >= 1_00_000) return (n / 1_00_000).toFixed(1) + ' L'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('en-IN')
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ChannelDetailPage() {
  const { name } = useParams<{ name: string }>()
  const decodedName = decodeURIComponent(name)
  const router = useRouter()
  const { activeCampaignId } = useCampaignStore()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!decodedName) return
    setLoading(true)
    const url = `/api/channel/${encodeURIComponent(decodedName)}${activeCampaignId ? `?campaign_id=${activeCampaignId}` : ''}`
    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError('Failed to load channel details'))
      .finally(() => setLoading(false))
  }, [decodedName, activeCampaignId])

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(26,115,232,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={24} style={{ color: '#1A73E8', animation: 'spin 1s linear infinite' }} />
      </div>
      <div style={{ fontSize: 14, color: '#64748B', fontWeight: 600 }}>Loading channel profile…</div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  const isDemo = !!error || !data
  const d = isDemo ? {
    channelName: decodedName, channelId: 'UCdemo', videoCount: 14, totalViews: 2180000,
    avgViews: 155714, bestRank: 1, sovPercent: 8.2, totalLikes: 125000,
    videos: [
      { youtube_id: 'd1', title: 'Best Water Purifier 2026 — Ultimate Buying Guide', view_count: 850000, like_count: 42000, is_short: false, best_rank: 1, keyword_count: 4, published_at: '2026-01-15', keywords: [{ text: 'best water purifier 2026', rank: 1 }, { text: 'water purifier buying guide', rank: 2 }, { text: 'ro purifier comparison', rank: 3 }], brands: ['Aquaguard', 'KENT RO', 'Livpure'] },
      { youtube_id: 'd2', title: 'Aquaguard vs KENT RO Comparison', view_count: 620000, like_count: 31000, is_short: false, best_rank: 2, keyword_count: 3, published_at: '2026-02-03', keywords: [{ text: 'aquaguard vs kent', rank: 2 }, { text: 'best ro purifier', rank: 4 }], brands: ['Aquaguard', 'KENT RO'] },
      { youtube_id: 'd3', title: 'Top 5 RO Purifiers Under ₹15000', view_count: 320000, like_count: 18000, is_short: false, best_rank: 3, keyword_count: 2, published_at: '2026-02-18', keywords: [{ text: 'water purifier price list', rank: 3 }], brands: ['Livpure'] },
      { youtube_id: 'd4', title: 'How to clean your RO filter #shorts', view_count: 150000, like_count: 9500, is_short: true, best_rank: 5, keyword_count: 1, published_at: '2026-03-01', keywords: [{ text: 'ro water filter maintenance', rank: 5 }], brands: [] },
      { youtube_id: 'd5', title: 'Is Copper RO really worth it?', view_count: 120000, like_count: 7200, is_short: false, best_rank: 8, keyword_count: 2, published_at: '2026-03-10', keywords: [{ text: 'copper ro purifier', rank: 8 }], brands: ['Aquaguard'] },
    ],
    keywords: [
      { text: 'best water purifier 2026', rank: 1, video_count: 2 },
      { text: 'water purifier buying guide', rank: 2, video_count: 1 },
      { text: 'aquaguard vs kent', rank: 3, video_count: 1 },
      { text: 'ro water filter maintenance', rank: 4, video_count: 2 },
      { text: 'water purifier price list', rank: 7, video_count: 1 },
    ],
    brands: ['Aquaguard', 'KENT RO', 'Livpure']
  } : data

  const { channelName, channelId, videoCount, totalViews, avgViews, bestRank, sovPercent, totalLikes, videos, keywords, brands } = d
  const signal = avgViews > 150_000 ? { label: 'Premium creator', color: '#059669', bg: 'rgba(0,200,83,0.06)', border: 'rgba(0,200,83,0.15)', icon: <Star size={12} /> }
    : avgViews > 80_000 ? { label: 'Strong creator', color: '#1A73E8', bg: 'rgba(26,115,232,0.06)', border: 'rgba(26,115,232,0.15)', icon: <Zap size={12} /> }
    : avgViews > 40_000 ? { label: 'Growing creator', color: '#D97706', bg: 'rgba(255,109,0,0.06)', border: 'rgba(255,109,0,0.15)', icon: <TrendingUp size={12} /> }
    : { label: 'Emerging creator', color: '#94A3B8', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.15)', icon: <Play size={12} /> }

  const chartData = videos.slice(0, 8).map((v: any, i: number) => ({
    name: v.title.length > 24 ? v.title.slice(0, 24) + '…' : v.title,
    views: v.view_count,
    fill: C[i % C.length],
  }))

  return (
    <div className="page-wrapper anim-fade-up">
      {isDemo && (
        <div className="demo-banner" style={{ marginBottom: 20, display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ fontSize: 18 }}>🧪</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#312E81' }}>Demo mode — Sample creator profile</div>
            <div style={{ fontSize: 11, color: '#4338CA', marginTop: 1, lineHeight: 1.5 }}>
              This channel was not found in the database. Showing reference layout and metrics for a hypothetical top-tier creator.
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        <Link href="/" className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 12.5, fontWeight: 600, color: '#475569', textDecoration: 'none' }}>
          <ArrowLeft size={13} style={{ marginRight: 4 }} /> Back to dashboard
        </Link>
        <span style={{ color: '#CBD5E1', fontSize: 12 }}>›</span>
        <span style={{ fontSize: 12.5, color: '#64748B', fontWeight: 500 }}>Creator profile</span>
      </div>

      {/* Profile Header */}
      <div className="card" style={{ marginBottom: 20, display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{
          width: 88, height: 88, borderRadius: 22,
          background: 'linear-gradient(135deg, #1A73E8, #8B5CF6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, fontWeight: 800, color: '#FFF', flexShrink: 0,
          boxShadow: '0 8px 28px rgba(26,115,232,0.3)',
        }}>
          {channelName.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.5px' }}>
              {channelName}
            </h1>
            <span className="badge" style={{ background: signal.bg, color: signal.color, border: `1px solid ${signal.border}`, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, fontSize: 11.5, fontWeight: 700 }}>
              {signal.icon} {signal.label}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#64748B', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Video size={14} /> {videoCount} campaign videos</span>
            <span style={{ color: '#E2E8F0' }}>·</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Search size={14} /> {keywords?.length || 0} search queries</span>
            {sovPercent && <>
              <span style={{ color: '#E2E8F0' }}>·</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, color: '#1A73E8' }}><BarChart3 size={14} /> {sovPercent}% SOV</span>
            </>}
          </div>
        </div>
        {channelId && (
          <a href={`https://youtube.com/channel/${channelId}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ padding: '10px 18px', fontSize: 13, fontWeight: 700, color: '#DC2626', background: 'rgba(255,45,85,0.06)', border: '1px solid rgba(255,45,85,0.15)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
            <Tv size={16} /> View on YouTube <ExternalLink size={13} />
          </a>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid-kpi" style={{ marginBottom: 20 }}>
        {[
          { icon: <Eye size={18} />, label: 'Total views', value: fmtNum(totalViews), sub: 'Campaign videos', color: '#1A73E8' },
          { icon: <TrendingUp size={18} />, label: 'Avg views / video', value: fmtNum(avgViews), sub: 'Quality metric', color: '#00C853' },
          { icon: <Award size={18} />, label: 'Best rank', value: bestRank ? `#${bestRank}` : '—', sub: 'Across all keywords', color: '#FF6D00' },
          { icon: <ThumbsUp size={18} />, label: 'Total likes', value: fmtNum(totalLikes), sub: `${videoCount} videos`, color: '#EC4899' },
          { icon: <BarChart3 size={18} />, label: 'SOV share', value: sovPercent ? `${sovPercent}%` : '—', sub: 'Share of voice', color: '#7C3AED' },
        ].map((kpi, i) => (
          <div key={i} className="kpi-card">
            <div className="kpi-icon-wrap" style={{ background: `${kpi.color}10`, color: kpi.color }}>{kpi.icon}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{kpi.label}</div>
            <div className="kpi-value">{kpi.value}</div>
            {kpi.sub && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{kpi.sub}</div>}
          </div>
        ))}
      </div>

      {/* Main Content: 2-column */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, alignItems: 'start' }}>

        {/* Left: Top Videos */}
        <div className="card">
          <div style={{ marginBottom: 16 }}>
            <div className="chart-title">Top performing videos</div>
            <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>Highest view count videos from this creator in your campaign</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {videos.slice(0, 6).map((v: any, i: number) => (
              <Link key={i} href={`/video/${v.youtube_id}`} className="row-hover" style={{ display: 'flex', flexDirection: 'column', padding: '12px 14px', borderRadius: 10, textDecoration: 'none', border: '1px solid transparent', transition: 'all 0.15s' }}>
                {/* Thumbnail + Info */}
                <div style={{ display: 'flex', gap: 14 }}>
                  <div style={{ width: 120, flexShrink: 0, position: 'relative', paddingTop: '56.25%', borderRadius: 8, overflow: 'hidden', background: '#0F172A' }}>
                    <img src={`https://img.youtube.com/vi/${v.youtube_id}/mqdefault.jpg`} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    {v.is_short && <span style={{ position: 'absolute', bottom: 4, right: 4, background: '#FF0000', color: '#FFF', fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 3, letterSpacing: '0.5px' }}>SHORT</span>}
                    <span className="rank-num" style={{ position: 'absolute', top: 4, left: 4, width: 'auto', padding: '2px 6px', fontSize: 9, background: 'rgba(0,0,0,0.75)', color: '#FFF' }}>
                      #{v.best_rank || '—'}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 } as React.CSSProperties}>
                      {v.title}
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11.5, color: '#64748B', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Eye size={11} /> {fmtNum(v.view_count)}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><ThumbsUp size={11} /> {fmtNum(v.like_count)}</span>
                      {v.published_at && <span style={{ color: '#94A3B8' }}>· {fmtDate(v.published_at)}</span>}
                    </div>
                  </div>
                </div>
                {/* Keywords + Brands row */}
                {((v.keywords && v.keywords.length > 0) || (v.brands && v.brands.length > 0)) && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(26,115,232,0.05)', flexWrap: 'wrap', alignItems: 'center' }}>
                    {v.keywords && v.keywords.slice(0, 3).map((kw: any, ki: number) => (
                      <span key={ki} className="chip" style={{ fontSize: 10, padding: '2px 7px', background: kw.rank <= 3 ? 'rgba(0,200,83,0.06)' : 'rgba(26,115,232,0.04)', color: kw.rank <= 3 ? '#059669' : '#1A73E8', borderColor: kw.rank <= 3 ? 'rgba(0,200,83,0.12)' : 'rgba(26,115,232,0.10)' }}>
                        <Search size={8} style={{ marginRight: 3 }} />{kw.text.length > 18 ? kw.text.slice(0, 18) + '…' : kw.text}
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, marginLeft: 3, opacity: 0.7 }}>#{kw.rank}</span>
                      </span>
                    ))}
                    {v.brands && v.brands.map((b: string, bi: number) => (
                      <span key={`b-${bi}`} className="badge badge-purple" style={{ fontSize: 10, padding: '2px 7px' }}>{b}</span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>

        {/* Right: Keywords + Brands + Chart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Keywords */}
          <div className="card">
            <div style={{ marginBottom: 16 }}>
              <div className="chart-title">Top keywords</div>
              <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>Search queries this creator ranks for</div>
            </div>
            {keywords && keywords.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {keywords.slice(0, 6).map((kw: any, i: number) => (
                  <div key={i} className="row-hover" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(26,115,232,0.05)' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1E293B', maxWidth: '65%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <Search size={11} style={{ display: 'inline', marginRight: 6, color: '#94A3B8' }} />
                      {kw.text}
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#64748B' }}>{kw.video_count} videos</span>
                      <span className="rank-num" style={{ width: 'auto', padding: '2px 8px', fontSize: 11, color: kw.rank <= 3 ? '#059669' : kw.rank <= 5 ? '#1A73E8' : '#64748B', background: kw.rank <= 3 ? 'rgba(0,200,83,0.06)' : kw.rank <= 5 ? 'rgba(26,115,232,0.06)' : 'rgba(148,163,184,0.06)' }}>
                        #{kw.rank}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '28px 0', color: '#94A3B8', fontSize: 13 }}>
                <Search size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
                <div>No search queries tracked yet</div>
              </div>
            )}
          </div>

          {/* Brands */}
          <div className="card">
            <div style={{ marginBottom: 16 }}>
              <div className="chart-title">Brand footprint</div>
              <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>Brands featured in this creator's videos</div>
            </div>
            {brands && brands.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {brands.map((b: string) => (
                  <span key={b} className="badge badge-purple" style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12.5 }}>{b}</span>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '28px 0', color: '#94A3B8', fontSize: 13 }}>
                <LayoutGrid size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
                <div>No brand tags assigned yet</div>
              </div>
            )}
          </div>

          {/* Views Distribution Chart */}
          <div className="card">
            <div style={{ marginBottom: 16 }}>
              <div className="chart-title">Video views distribution</div>
              <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>Top videos by view count</div>
            </div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={(v: any) => fmtNum(v)} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: any) => [fmtNum(value), 'Views']}
                    contentStyle={{ background: '#0F172A', borderRadius: 10, border: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.35)', fontSize: 12, fontFamily: "'JetBrains Mono',monospace", padding: '10px 14px' }}
                    labelStyle={{ color: '#94A3B8', fontSize: 10, fontWeight: 600, marginBottom: 4 }}
                    itemStyle={{ color: '#FFF', fontWeight: 700 }}
                    cursor={{ fill: 'rgba(26,115,232,0.04)' }}
                  />
                  <Bar dataKey="views" radius={[4, 4, 0, 0]} maxBarSize={36}>
                    {chartData.map((entry: any, idx: number) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
