'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Video, Search, ExternalLink, ChevronLeft, ChevronRight, Tag, Eye } from 'lucide-react'
import { useCampaignStore } from '@/lib/store'
import { PageSkeleton } from '@/components/PageSkeleton'
import Link from 'next/link'

interface CampaignVideo {
  id: string
  youtube_id: string
  title: string
  channel_name: string
  view_count: number
  tags: string[]
  thumbnail_url: string
  published_at: string
  first_seen_at: string
  duration: string
}

function fmt(n: number): string {
  if (n == null || isNaN(n)) return '0'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

function fmtDate(d: string): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const PER_PAGE = 20

export default function VideosPage() {
  const { campaigns, activeCampaignId, fetchCampaigns } = useCampaignStore()
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<'views' | 'title' | 'date' | 'channel'>('views')
  const [search, setSearch] = useState('')

  const videosQuery = useQuery({
    queryKey: ['videos-campaign', activeCampaignId, page, sort, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        campaign_id: activeCampaignId!,
        page: String(page),
        limit: String(PER_PAGE),
        sort,
      })
      if (search) params.set('q', search)
      const res = await fetch(`/api/videos/campaign?${params}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      return { data: json.data || [] as CampaignVideo[], total: json.total || 0 }
    },
    enabled: !!activeCampaignId,
  })

  const data = videosQuery.data?.data ?? []
  const total = videosQuery.data?.total ?? 0
  const loading = videosQuery.isLoading
  const isPageLoading = videosQuery.isFetching && !videosQuery.isLoading

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])
  useEffect(() => { setPage(1) }, [sort, search])

  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <div className="anim-fade-up">
      <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <div className="page-header">
        <div>
          <h1 className="page-title"><span className="accent">All Campaign</span> Videos</h1>
          <p className="page-subtitle">{total} videos discovered across all keywords. Browse, search, and manage your video pool.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="toggle-group">
            <button className={`toggle-btn ${sort === 'views' ? 'active' : ''}`} onClick={() => setSort('views')}>Top by Views</button>
            <button className={`toggle-btn ${sort === 'date' ? 'active' : ''}`} onClick={() => setSort('date')}>Date Added</button>
            <button className={`toggle-btn ${sort === 'title' ? 'active' : ''}`} onClick={() => setSort('title')}>Title</button>
            <button className={`toggle-btn ${sort === 'channel' ? 'active' : ''}`} onClick={() => setSort('channel')}>Channel</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
          <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: 34 }}
            placeholder="Search videos or channels..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <PageSkeleton cols={4} rows={8} />
      ) : videosQuery.error ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#EF4444', fontSize: 13 }}>{(videosQuery.error as Error).message}</div>
      ) : data.length === 0 ? (
        <div style={{
          display: 'flex', gap: 12, padding: 28, borderRadius: 14, background: '#FFFFFF',
          border: '1px solid #F1F5F9', alignItems: 'center', justifyContent: 'center', flexDirection: 'column'
        }}>
          <Video size={32} style={{ color: '#94A3B8', marginBottom: 8 }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>No Videos Found</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>Run scrape jobs in Campaign Control to discover videos.</div>
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
            {isPageLoading && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 50,
                background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(2px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, background: '#0F172A', color: '#FFF', fontSize: 12, fontWeight: 600 }}>
                  <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#FFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Loading page…
                </div>
              </div>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Video</th>
                    <th>Channel</th>
                    <th style={{ textAlign: 'right' }}>Views</th>
                    <th>Brands</th>
                    <th>Added</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((v: CampaignVideo) => (
                    <tr key={v.id}>
                      <td style={{ maxWidth: 380 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Link
                            href={`/video/${v.youtube_id}`}
                            style={{ flexShrink: 0, display: 'block', width: 72, height: 40, borderRadius: 6, background: '#F1F5F9', overflow: 'hidden' }}
                          >
                            <img
                              src={`https://img.youtube.com/vi/${v.youtube_id}/mqdefault.jpg`}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </Link>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <Link
                              href={`/video/${v.youtube_id}`}
                              style={{
                                fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                                textDecoration: 'none', lineHeight: 1.4,
                                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                              } as React.CSSProperties}
                            >
                              {v.title || 'Untitled'}
                            </Link>
                            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{v.duration || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.channel_name || '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                        <span className="mono">{fmt(v.view_count)}</span>
                      </td>
                      <td>
                        {v.tags && v.tags.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {v.tags.slice(0, 3).map((t: string) => (
                              <span key={t} className="badge badge-purple">{t}</span>
                            ))}
                            {v.tags.length > 3 && <span style={{ fontSize: 10, color: '#94A3B8' }}>+{v.tags.length - 3}</span>}
                          </div>
                        ) : (
                          <span className="badge badge-orange">Untagged</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {fmtDate(v.first_seen_at)}
                      </td>
                      <td>
                        <a href={`https://youtube.com/watch?v=${v.youtube_id}`} target="_blank" rel="noopener noreferrer"
                          style={{ color: 'var(--text-muted)', display: 'inline-flex' }}>
                          <ExternalLink size={13} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 20 }}>
              <button
                className="page-btn"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
                Page {page} of {totalPages}
              </span>
              <button
                className="page-btn"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
