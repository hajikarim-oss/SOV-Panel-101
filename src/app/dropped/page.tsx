'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, AlertCircle, Loader2, TrendingDown, Clock, Info } from 'lucide-react'
import { useCampaignStore } from '@/lib/store'

interface DroppedVideo {
  youtube_id: string
  title: string
  channel_name: string
  view_count: number
  thumbnail_url: string
  last_seen_at: string
  last_rank: number
  keywords_appeared: string[]
  brands?: string[]
  is_short: boolean
  drop_reason: string
}

function fmt(n: number): string {
  if (n == null || isNaN(n)) return '0'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

const COLORS = ['#1A73E8', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4']

export default function DroppedPage() {
  const { activeCampaignId, fetchCampaigns } = useCampaignStore()
  const [search, setSearch] = useState('')
  const [data, setData] = useState<DroppedVideo[]>([])
  const [source, setSource] = useState<'history' | 'fallback' | ''>('')
  const [loading, setLoading] = useState(true)

  const fetchDropped = useCallback(async (campId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/videos/dropped?campaign_id=${campId}`)
      const d = await res.json()
      if (d.data) {
        setData(d.data)
        setSource(d.source ?? '')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])
  useEffect(() => {
    if (activeCampaignId) {
      fetchDropped(activeCampaignId)
    } else {
      setLoading(false)
    }
  }, [activeCampaignId, fetchDropped])

  const filtered = data.filter(v =>
    !search.trim() ||
    v.title.toLowerCase().includes(search.toLowerCase()) ||
    v.channel_name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 12 }}>
      <Loader2 size={32} style={{ color: '#1A73E8', animation: 'spin 1s linear infinite' }} />
      <div style={{ fontSize: 13.5, color: '#64748B', fontWeight: 600 }}>Loading dropped video list…</div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  const hasData = filtered.length > 0

  return (
    <div className="anim-fade-up">
      <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dropped <span className="accent">Rankings</span></h1>
          <p className="page-subtitle">Track videos that were previously ranking in the top 10 but have been pushed out or replaced</p>
        </div>
        {hasData && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
            background: source === 'history' ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
            border: `1px solid ${source === 'history' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
            fontSize: 11.5, fontWeight: 600,
            color: source === 'history' ? '#10B981' : '#D97706',
          }}>
            {source === 'history' ? (
              <><TrendingDown size={13} /> Week-over-week drops detected</>
            ) : (
              <><Clock size={13} /> Showing replaced/older rankings</>
            )}
          </div>
        )}
      </div>

      {/* Info banner for fallback mode */}
      {hasData && source === 'fallback' && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderRadius: 10, marginBottom: 16,
          background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
          fontSize: 12, color: '#92400E', lineHeight: 1.5,
        }}>
          <Info size={15} style={{ flexShrink: 0, marginTop: 1, color: '#D97706' }} />
          <div>
            <strong>Note:</strong> Showing videos that were replaced in subsequent scrapes for the same keywords.
            True week-over-week drop comparison requires at least <strong>2 scrape runs</strong> with the Monday full refresh enabled.
            Run more scrapes to enable precise dropped ranking detection.
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
          <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: 34 }}
            placeholder="Search dropped videos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {!hasData ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 280, gap: 16, background: '#FFFFFF', borderRadius: 14, border: '1px solid #F1F5F9' }}>
          <TrendingDown size={40} style={{ color: '#CBD5E1' }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1E293B' }}>No Dropped Videos Detected</div>
          <div style={{ fontSize: 12.5, color: '#64748B', textAlign: 'center', maxWidth: 440, lineHeight: 1.6 }}>
            Videos appear here after they were ranking in the top 10 for a keyword in a previous scrape
            but dropped out in a subsequent scrape. Run at least <strong>2 scrape jobs</strong> for the same keywords
            to start seeing dropout detection.
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 280 }}>Video Details</th>
                  <th>Channel</th>
                  <th>Brand</th>
                  <th style={{ textAlign: 'center' }}>Last Rank</th>
                  <th style={{ textAlign: 'right' }}>Views</th>
                  <th style={{ minWidth: 180 }}>Associated Keywords</th>
                  <th>Type</th>
                  <th>Reason</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(video => (
                  <tr key={`${video.youtube_id}-${video.last_rank}`}>
                    <td style={{ maxWidth: 320 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <a
                          href={`https://youtube.com/watch?v=${video.youtube_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ flexShrink: 0, display: 'block', width: 80, height: 46, borderRadius: 6, background: '#F1F5F9', overflow: 'hidden' }}
                        >
                          <img
                            src={video.thumbnail_url || `https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => { (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg` }}
                          />
                        </a>
                        <div style={{ minWidth: 0 }}>
                          <a
                            href={`https://youtube.com/watch?v=${video.youtube_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                              textDecoration: 'none', lineHeight: 1.4,
                              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                            } as React.CSSProperties}
                          >
                            {video.title}
                          </a>
                        </div>
                      </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12, fontWeight: 500, color: '#334155' }}>
                      {video.channel_name}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {(video.brands ?? []).length > 0 ? (
                          (video.brands ?? []).map((b, bi) => (
                            <span key={b} style={{
                              fontSize: 10, padding: '2px 7px', borderRadius: 5, fontWeight: 700,
                              background: `${COLORS[bi % COLORS.length]}15`,
                              border: `1px solid ${COLORS[bi % COLORS.length]}40`,
                              color: COLORS[bi % COLORS.length],
                            }}>{b}</span>
                          ))
                        ) : (
                          <span style={{ color: '#CBD5E1', fontSize: 11 }}>—</span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 32, height: 26, borderRadius: 7, fontWeight: 800, fontSize: 13,
                        background: 'rgba(239,68,68,0.08)', color: '#EF4444',
                      }}>
                        #{video.last_rank}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' } as React.CSSProperties}>
                      {fmt(video.view_count)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, maxWidth: 200 }}>
                        {video.keywords_appeared.slice(0, 4).map(k => (
                          <span key={k} style={{
                            fontSize: 9.5, padding: '2px 6px', borderRadius: 4,
                            background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#475569', fontWeight: 500,
                          }}>{k}</span>
                        ))}
                        {video.keywords_appeared.length > 4 && (
                          <span style={{ fontSize: 9, color: '#94A3B8', alignSelf: 'center', fontWeight: 600 }}>
                            +{video.keywords_appeared.length - 4} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${video.is_short ? 'badge-purple' : 'badge-blue'}`}>
                        {video.is_short ? 'Shorts' : 'Long-Form'}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-red" style={{ textTransform: 'capitalize' }}>
                        {video.drop_reason === 'pushed_out' ? 'Pushed Out' : 'Removed'}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap' }}>
                      {new Date(video.last_seen_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
