'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, ExternalLink, Eye, ThumbsUp, MessageSquare, Calendar,
  Clock, Award, Hash, TrendingUp, Tag, Loader2, AlertCircle,
  BarChart2, Tv, Brain, Search
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from 'recharts'
import { useCampaignStore } from '@/lib/store'

function fmtNum(n: number | null | undefined) {
  if (!n) return '—'
  if (n >= 1_00_00_000) return (n / 1_00_00_000).toFixed(2) + ' Cr'
  if (n >= 1_00_000) return (n / 1_00_000).toFixed(1) + ' L'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('en-IN')
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDuration(secs: number | null | undefined) {
  if (!secs) return null
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function ViewsTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0F172A', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
      <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#FFF', fontFamily: "'JetBrains Mono',monospace" }}>{fmtNum(payload[0]?.value)}</div>
      <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>views</div>
    </div>
  )
}

function genMockHistory(viewCount: number) {
  const points: { date: string; views: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000).toLocaleDateString('en-IN', { month: 'short', day: '2-digit' })
    const pct = 1 - (i / 30) * 0.45 + (Math.random() - 0.5) * 0.04
    points.push({ date, views: Math.round(viewCount * pct) })
  }
  return points
}

const mentionTypeConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  primary_review: { label: 'Primary review', color: '#059669', bg: 'rgba(0,200,83,0.06)', border: 'rgba(0,200,83,0.15)' },
  comparison: { label: 'Comparison', color: '#1A73E8', bg: 'rgba(26,115,232,0.06)', border: 'rgba(26,115,232,0.15)' },
  recommendation: { label: 'Recommended', color: '#D97706', bg: 'rgba(255,109,0,0.06)', border: 'rgba(255,109,0,0.15)' },
  mentioned: { label: 'Mentioned', color: '#64748B', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.15)' },
}

export default function VideoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { activeCampaignId } = useCampaignStore()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  const runAnalysis = async () => {
    if (!id || !activeCampaignId) return
    setAnalyzing(true)
    try {
      const res = await fetch('/api/brands/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_ids: [id], campaign_id: activeCampaignId, force: true }),
      })
      const result = await res.json()
      if (result.results?.[0]?.status === 'analyzed') {
        const freshRes = await fetch(`/api/video/${encodeURIComponent(id)}${activeCampaignId ? `?campaign_id=${activeCampaignId}` : ''}`)
        const freshData = await freshRes.json()
        setData(freshData)
      }
    } catch { /* silently fail */ } finally { setAnalyzing(false) }
  }

  useEffect(() => {
    if (!id) return
    setLoading(true)
    const url = `/api/video/${encodeURIComponent(id)}${activeCampaignId ? `?campaign_id=${activeCampaignId}` : ''}`
    fetch(url)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d) })
      .catch(() => setError('Failed to load video details'))
      .finally(() => setLoading(false))
  }, [id, activeCampaignId])

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(26,115,232,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={24} style={{ color: '#1A73E8', animation: 'spin 1s linear infinite' }} />
      </div>
      <div style={{ fontSize: 14, color: '#64748B', fontWeight: 600 }}>Loading video details…</div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  const isDemo = !!error || !data
  const videoData = isDemo ? {
    video: {
      youtube_id: id, title: 'Best Water Purifier 2026 — Ultimate Buying Guide',
      channel_name: 'Review Mart', view_count: 2180000, like_count: 145000,
      comment_count: 8900, duration: 645,
      published_at: new Date(Date.now() - 45 * 86400000).toISOString(),
      is_short: false,
    },
    kwRanks: [
      { keyword_text: 'best water purifier 2026', rank: 1, language: 'en' },
      { keyword_text: 'water purifier buying guide', rank: 2, language: 'en' },
      { keyword_text: 'aquaguard vs kent', rank: 3, language: 'en' },
    ],
    bestRank: 1, viewHistory: [],
    relatedVideos: [
      { youtube_id: 'rd1', title: 'Top 5 RO Purifiers Under ₹15000', view_count: 850000 },
      { youtube_id: 'rd2', title: 'How to Clean Your RO Filter', view_count: 320000 },
    ],
    tags: ['Aquaguard', 'KENT RO'],
    brandAnalysis: [
      { brand_name: 'Aquaguard', confidence: 0.95, mention_type: 'primary_review', context_quotes: ['The Aquaguard Marvel is one of the best RO purifiers this year'] },
      { brand_name: 'KENT RO', confidence: 0.88, mention_type: 'comparison', context_quotes: ['Compared to KENT RO, the Aquaguard has better TDS removal'] },
      { brand_name: 'Livpure', confidence: 0.72, mention_type: 'mentioned', context_quotes: ['Livpure is another option worth considering'] },
    ],
    transcript: { language: 'en', fetched_at: new Date().toISOString() },
  } : data

  const { video, kwRanks, bestRank, viewHistory, relatedVideos, tags, brandAnalysis, transcript } = videoData
  const historyData = viewHistory && viewHistory.length > 0 ? viewHistory : genMockHistory(video.view_count)
  const isMockHistory = !viewHistory || viewHistory.length === 0
  const isShort = video.is_short || (video.duration && video.duration < 60)
  const engRate = video.view_count ? ((video.like_count / video.view_count) * 100).toFixed(2) : '—'

  return (
    <div className="page-wrapper anim-fade-up">

      {isDemo && (
        <div className="demo-banner" style={{ marginBottom: 20, display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ fontSize: 18 }}>🧪</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#312E81' }}>Demo mode — Sample video data</div>
            <div style={{ fontSize: 11, color: '#4338CA', marginTop: 1, lineHeight: 1.5 }}>
              This video was not found in the database. Showing reference layout and metrics for a hypothetical top-ranking video.
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={() => router.back()} className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 12.5, fontWeight: 600, color: '#475569' }}>
          <ArrowLeft size={13} style={{ marginRight: 4 }} /> Back
        </button>
        <span style={{ color: '#CBD5E1', fontSize: 12 }}>›</span>
        <span style={{ fontSize: 12.5, color: '#64748B', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>{video.title}</span>
      </div>

      {/* Hero: Player + Meta */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 20, alignItems: 'start' }}>

        {/* Player Card */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#0F172A' }}>
            <iframe
              src={`https://www.youtube.com/embed/${video.youtube_id}?rel=0`}
              title={video.title}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
            <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6, zIndex: 10 }}>
              {isShort && <span className="badge" style={{ background: '#FF0000', color: '#FFF', border: 'none', padding: '3px 8px', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.3px' }}>SHORT</span>}
              {!isShort && <span className="badge" style={{ background: 'rgba(0,0,0,0.6)', color: '#FFF', border: 'none', padding: '3px 8px', fontSize: 9.5, fontWeight: 800 }}>LONG FORM</span>}
              {fmtDuration(video.duration) && (
                <span className="badge" style={{ background: 'rgba(0,0,0,0.7)', color: '#FFF', border: 'none', padding: '3px 8px', fontSize: 9.5, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>
                  {fmtDuration(video.duration)}
                </span>
              )}
            </div>
          </div>
          <div style={{ padding: '18px 22px' }}>
            <h1 style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', lineHeight: 1.5, marginBottom: 10, letterSpacing: '-0.3px' }}>
              {video.title}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <Link href={`/channel/${encodeURIComponent(video.channel_name)}`} className="chip" style={{ color: '#1A73E8', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Tv size={13} color="#FF0000" /> {video.channel_name}
              </Link>
              <span style={{ fontSize: 11.5, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={11} /> {fmtDate(video.published_at)}
              </span>
              <a href={`https://youtube.com/watch?v=${video.youtube_id}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#64748B', textDecoration: 'none' }}>
                <ExternalLink size={11} /> Watch on YouTube
              </a>
              {activeCampaignId && (
                <button onClick={runAnalysis} disabled={analyzing} className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 11.5, fontWeight: 600, color: '#7C3AED', background: analyzing ? '#F1F5F9' : 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)', cursor: analyzing ? 'not-allowed' : 'pointer', opacity: analyzing ? 0.6 : 1 }}>
                  {analyzing ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite', marginRight: 4 }} /> : <Brain size={11} style={{ marginRight: 4 }} />}
                  {analyzing ? 'Analyzing…' : 'AI Analyze'}
                </button>
              )}
            </div>
            {tags && tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tags.map((tag: string) => (
                  <span key={tag} className="badge badge-purple" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px' }}>
                    <Tag size={9} /> {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { icon: <Eye size={16} />, label: 'Total views', value: fmtNum(video.view_count), sub: 'cumulative', color: '#1A73E8' },
            { icon: <Award size={16} />, label: 'Best rank', value: bestRank ? `#${bestRank}` : '—', sub: 'across all keywords', color: '#FF6D00' },
            { icon: <Hash size={16} />, label: 'Keywords', value: kwRanks.length, sub: 'search appearances', color: '#7C3AED' },
            { icon: <ThumbsUp size={16} />, label: 'Likes', value: fmtNum(video.like_count), sub: `${engRate}% engagement`, color: '#00C853' },
            { icon: <MessageSquare size={16} />, label: 'Comments', value: fmtNum(video.comment_count), color: '#EF4444' },
            { icon: <Clock size={16} />, label: 'Published', value: fmtDate(video.published_at), color: '#06B6D4' },
          ].map((kpi, i) => (
            <div key={i} className="kpi-card" style={{ padding: '14px 16px' }}>
              <div className="kpi-icon-wrap" style={{ background: `${kpi.color}10`, color: kpi.color, width: 30, height: 30, borderRadius: 8, marginBottom: 10 }}>{kpi.icon}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{kpi.label}</div>
              <div className="kpi-value" style={{ fontSize: 20 }}>{kpi.value}</div>
              {kpi.sub && <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 3 }}>{kpi.sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Views History */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div className="chart-title">Views history</div>
            <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>
              {isMockHistory ? 'Estimated trend (real snapshots will appear after daily scrape runs)' : '30-day view count trajectory from snapshot records'}
            </div>
          </div>
          {isMockHistory && <span className="badge" style={{ background: 'rgba(255,109,0,0.06)', color: '#D97706', border: '1px solid rgba(255,109,0,0.15)' }}>Estimated</span>}
        </div>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historyData} margin={{ top: 4, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="viewGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1A73E8" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1A73E8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 9.5, fill: '#94A3B8', fontWeight: 600 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9.5, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={v => fmtNum(v)} />
              <Tooltip content={<ViewsTooltip />} />
              <Area type="monotone" dataKey="views" stroke="#1A73E8" strokeWidth={2.5} fill="url(#viewGrad)" dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: '#1A73E8' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI Brand Analysis */}
      {brandAnalysis && brandAnalysis.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(124,58,237,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
              <div>
                <div className="chart-title">AI brand detection</div>
                <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>
                  Analyzed via transcript · {transcript?.language === 'hi' ? 'Hindi' : 'English'} transcript
                </div>
              </div>
            </div>
            <span className="badge badge-purple">AI powered</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {brandAnalysis.map((b: any, i: number) => {
              const cfg = mentionTypeConfig[b.mention_type] || mentionTypeConfig.mentioned
              return (
                <div key={i} className="row-hover" style={{ padding: '14px 16px', background: '#FAFBFC', borderRadius: 10, border: '1px solid rgba(26,115,232,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>{b.brand_name}</span>
                      <span className="badge" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
                        {cfg.label}
                      </span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: b.confidence >= 0.8 ? '#059669' : b.confidence >= 0.6 ? '#1A73E8' : '#D97706' }}>
                      {Math.round(b.confidence * 100)}%
                    </span>
                  </div>
                  {b.context_quotes && b.context_quotes.length > 0 && (
                    <div style={{ fontSize: 11.5, color: '#64748B', fontStyle: 'italic', lineHeight: 1.5, marginTop: 4 }}>
                      &ldquo;{b.context_quotes[0]}&rdquo;
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Keyword Appearances Table */}
      {kwRanks && kwRanks.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(26,115,232,0.05)' }}>
            <div className="chart-title">Keyword appearances</div>
            <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>All search queries this video ranks for, with position</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Keyword</th>
                  <th>Language</th>
                  <th style={{ textAlign: 'center' }}>Rank</th>
                  <th style={{ textAlign: 'center' }}>Signal</th>
                </tr>
              </thead>
              <tbody>
                {kwRanks.map((kw: any, i: number) => (
                  <tr key={i}>
                    <td style={{ color: '#94A3B8', fontWeight: 600, fontSize: 11 }}>{i + 1}</td>
                    <td style={{ fontWeight: 600, fontSize: 13, color: '#1E293B' }}>
                      <Search size={11} style={{ display: 'inline', marginRight: 6, color: '#94A3B8' }} />
                      {kw.keyword_text}
                    </td>
                    <td>
                      <span className="chip" style={{ fontSize: 10.5, padding: '2px 8px' }}>{kw.language}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="rank-num" style={{ width: 'auto', padding: '3px 10px', fontSize: 12, color: kw.rank <= 3 ? '#059669' : kw.rank <= 7 ? '#1A73E8' : '#64748B', background: kw.rank <= 3 ? 'rgba(0,200,83,0.06)' : kw.rank <= 7 ? 'rgba(26,115,232,0.06)' : 'rgba(148,163,184,0.06)' }}>
                        #{kw.rank}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {kw.rank === 1 && <span className="badge badge-green" style={{ padding: '2px 8px' }}>Top result</span>}
                      {kw.rank > 1 && kw.rank <= 3 && <span className="badge badge-green" style={{ padding: '2px 8px' }}>Top 3</span>}
                      {kw.rank > 3 && kw.rank <= 7 && <span className="badge badge-blue" style={{ padding: '2px 8px' }}>Top 7</span>}
                      {kw.rank > 7 && <span style={{ fontSize: 11, color: '#94A3B8' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Related Videos */}
      {relatedVideos && relatedVideos.length > 0 && (
        <div className="card">
          <div style={{ marginBottom: 16 }}>
            <div className="chart-title">More from <span style={{ color: '#1A73E8' }}>{video.channel_name}</span></div>
            <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>Other campaign videos from this creator</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {relatedVideos.map((rv: any) => (
              <Link key={rv.youtube_id} href={`/video/${rv.youtube_id}`} className="card-interactive" style={{ textDecoration: 'none', display: 'block', padding: 0, overflow: 'hidden' }}>
                <div style={{ position: 'relative', paddingTop: '56.25%', background: '#0F172A' }}>
                  <img src={`https://img.youtube.com/vi/${rv.youtube_id}/mqdefault.jpg`} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', lineHeight: 1.4, marginBottom: 5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
                    {rv.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>
                    <Eye size={10} style={{ display: 'inline', marginRight: 3 }} />
                    {fmtNum(rv.view_count)} views
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
