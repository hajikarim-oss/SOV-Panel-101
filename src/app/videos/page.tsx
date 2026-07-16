'use client'

import { useState, useEffect, useCallback } from 'react'
import { Video, Search, Loader2, ExternalLink, ChevronLeft, ChevronRight, ArrowUpDown, Eye, Tag } from 'lucide-react'
import { useCampaignStore } from '@/lib/store'
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

function formatDate(d: string): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const PER_PAGE = 20

export default function VideosPage() {
  const { campaigns, activeCampaignId, fetchCampaigns } = useCampaignStore()
  const [data, setData] = useState<CampaignVideo[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<'views' | 'title' | 'date' | 'channel'>('views')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    if (!activeCampaignId) return
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        campaign_id: activeCampaignId,
        page: String(page),
        limit: String(PER_PAGE),
        sort,
      })
      if (search) params.set('q', search)
      const res = await fetch(`/api/videos/campaign?${params}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json.data || [])
      setTotal(json.total || 0)
    } catch (err: any) {
      setError(err.message || 'Failed to load videos')
    } finally {
      setLoading(false)
    }
  }, [activeCampaignId, page, sort, search])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])
  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { setPage(1) }, [sort, search])

  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: '24px 32px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Link href="/" style={{ color: '#64748B', fontSize: 13, textDecoration: 'none' }}>Dashboard</Link>
          <span style={{ color: '#CBD5E1' }}>/</span>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Video size={20} color="#8B5CF6" /> All Campaign Videos
          </h1>
          <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, marginLeft: 8 }}>{total} videos</span>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 400 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search videos or channels..."
              style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, background: '#fff', outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['views', 'date', 'title', 'channel'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSort(s)}
                style={{
                  padding: '6px 12px', borderRadius: 6, border: '1px solid #E2E8F0',
                  background: sort === s ? '#8B5CF6' : '#fff',
                  color: sort === s ? '#fff' : '#64748B',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                }}
              >
                {s === 'views' ? 'Views' : s === 'date' ? 'Date Added' : s === 'title' ? 'Title' : 'Channel'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Loader2 size={24} className="animate-spin" style={{ color: '#8B5CF6' }} />
            <p style={{ color: '#94A3B8', fontSize: 13, marginTop: 12 }}>Loading videos...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#EF4444', fontSize: 13 }}>{error}</div>
        ) : data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, background: '#fff', borderRadius: 12, border: '1px solid #F1F5F9' }}>
            <Video size={32} style={{ color: '#CBD5E1', marginBottom: 12 }} />
            <p style={{ color: '#94A3B8', fontSize: 13 }}>No videos found for this campaign</p>
          </div>
        ) : (
          <>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F1F5F9', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#64748B', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Video</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#64748B', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Channel</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#64748B', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Eye size={11} /> Views</span>
                    </th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#64748B', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Tag size={11} /> Brands</span>
                    </th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#64748B', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Added</th>
                    <th style={{ padding: '10px 14px', width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((v: CampaignVideo) => (
                    <tr key={v.id} style={{ borderBottom: '1px solid #F8FAFC', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFE')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ padding: '10px 14px', maxWidth: 400 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {v.thumbnail_url && (
                            <img src={v.thumbnail_url} alt="" style={{ width: 56, height: 32, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: '#0F172A', fontSize: 12, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {v.title || 'Untitled'}
                            </div>
                            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{v.duration || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#64748B', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.channel_name || '—'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#0F172A', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                        {fmt(v.view_count)}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {v.tags && v.tags.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {v.tags.slice(0, 3).map((t: string) => (
                              <span key={t} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(139,92,246,0.08)', color: '#8B5CF6', fontWeight: 600, border: '1px solid rgba(139,92,246,0.15)' }}>{t}</span>
                            ))}
                            {v.tags.length > 3 && <span style={{ fontSize: 10, color: '#94A3B8' }}>+{v.tags.length - 3}</span>}
                          </div>
                        ) : (
                          <span style={{ fontSize: 10, color: '#F59E0B', fontWeight: 600, background: 'rgba(245,158,11,0.08)', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(245,158,11,0.15)' }}>Untagged</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#94A3B8', fontSize: 11 }}>
                        {formatDate(v.first_seen_at)}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <a href={`https://youtube.com/watch?v=${v.youtube_id}`} target="_blank" rel="noopener noreferrer"
                          style={{ color: '#94A3B8', display: 'inline-flex' }}>
                          <ExternalLink size={13} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 20 }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748B' }}
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', cursor: page >= totalPages ? 'default' : 'pointer', opacity: page >= totalPages ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748B' }}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
