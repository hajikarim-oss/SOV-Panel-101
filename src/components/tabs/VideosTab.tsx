'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Video, Search, Eye, Clock, Tag, ExternalLink, Download, Loader2,
  ChevronLeft, ChevronRight, Plus, X, Link2, TrendingUp, TrendingDown,
  Hash, User, Star, Filter, Check,
} from 'lucide-react'
import Link from 'next/link'
import { useCampaignStore } from '@/lib/store'
import { useQuery } from '@tanstack/react-query'
import { brandColor } from '@/lib/brand-colors'

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toLocaleString()
}

function fmtIndian(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  if (n >= 1e7) return (n / 1e7).toFixed(1) + ' Cr'
  if (n >= 1e5) return (n / 1e5).toFixed(1) + ' Lakh'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + ' K'
  return n.toLocaleString('en-IN')
}

function fmtGain(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n) || n === 0) return ''
  const prefix = n > 0 ? '+' : ''
  if (Math.abs(n) >= 1e7) return `${prefix}${(n / 1e7).toFixed(1)} Cr`
  if (Math.abs(n) >= 1e5) return `${prefix}${(n / 1e5).toFixed(1)} L`
  if (Math.abs(n) >= 1e3) return `${prefix}${(n / 1e3).toFixed(1)}K`
  return `${prefix}${n.toLocaleString()}`
}

function fmtDuration(iso: string | null): string {
  if (!iso) return ''
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return ''
  const h = m[1] ? parseInt(m[1]) : 0
  const min = m[2] ? parseInt(m[2]) : 0
  const sec = m[3] ? parseInt(m[3]) : 0
  return h > 0 ? `${h}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${min}:${String(sec).padStart(2, '0')}`
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso.includes('T') ? iso : iso + 'Z')
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function VideosTab() {
  const { activeCampaignId, campaigns } = useCampaignStore()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'views' | 'rank' | 'date' | 'channel'>('views')
  const [tab, setTab] = useState<'long' | 'short'>('long')
  const [brandFilter, setBrandFilter] = useState('all')
  const [channelFilter, setChannelFilter] = useState('all')
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'ours' | 'theirs'>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [showAll, setShowAll] = useState(false)

  // Add video by URL state
  const [showAddUrl, setShowAddUrl] = useState(false)
  const [addUrl, setAddUrl] = useState('')
  const [addTags, setAddTags] = useState('')
  const [addingVideo, setAddingVideo] = useState(false)
  const [addResult, setAddResult] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Tag editing state
  const [editingTags, setEditingTags] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState('')

  // Ownership toggling
  const [togglingOwnership, setTogglingOwnership] = useState<string | null>(null)

  // Daily gain data
  const [gainMap, setGainMap] = useState<Record<string, { daily_gain: number | null; latest_views: number }>>({})

  const limit = 20
  const campaign = campaigns.find(c => c.id === activeCampaignId)

  const videosQuery = useQuery({
    queryKey: ['videos-tab', activeCampaignId, page, sort, search, tab, brandFilter, channelFilter, ownershipFilter, showAll],
    queryFn: async () => {
      if (showAll) {
        const params = new URLSearchParams({ campaign_id: activeCampaignId!, page: String(page), limit: String(limit), sort })
        if (search) params.set('q', search)
        const res = await fetch(`/api/videos/campaign?${params}`)
        return res.json()
      } else {
        const params = new URLSearchParams({
          campaign_id: activeCampaignId!, sort, tab, page: String(page), limit: String(limit),
        })
        if (search) params.set('q', search)
        if (brandFilter !== 'all') params.set('brand_name', brandFilter)
        if (channelFilter !== 'all') params.set('channel_name', channelFilter)
        if (ownershipFilter !== 'all') params.set('is_ours', ownershipFilter === 'ours' ? 'true' : 'false')
        const res = await fetch(`/api/videos/leaderboard?${params}`)
        return res.json()
      }
    },
    enabled: !!activeCampaignId,
  })

  const videos = videosQuery.data?.data ?? []
  const total = videosQuery.data?.total ?? 0
  const channels = videosQuery.data?.channels ?? []
  const loading = videosQuery.isLoading

  const brands = useMemo(() => {
    const allBrands = new Set<string>()
    for (const v of videos) for (const b of (v.brands ?? [])) allBrands.add(b)
    return Array.from(allBrands).sort()
  }, [videos])

  // Fetch daily gain for current page videos
  const fetchDailyGain = useCallback(async (videoIds: string[], campId: string) => {
    if (!videoIds.length || !campId) return
    try {
      const res = await fetch('/api/videos/batch-snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_ids: videoIds, campaign_id: campId }),
      })
      const d = await res.json()
      if (d.data) setGainMap(d.data)
    } catch { /* ignore */ }
  }, [])

  // Fetch daily gain when videos change
  useEffect(() => {
    if (activeCampaignId && videos.length > 0) {
      const ids = videos.map(v => v.id).filter(Boolean)
      fetchDailyGain(ids, activeCampaignId)
    }
  }, [videos, activeCampaignId, fetchDailyGain])

  const handleSearch = () => { setPage(1) }
  const totalPages = Math.ceil(total / limit)

  const addVideoByUrl = async () => {
    if (!activeCampaignId || !addUrl.trim()) return
    setAddingVideo(true); setAddResult(null)
    try {
      const tags = addTags.split(',').map(t => t.trim()).filter(Boolean)
      const res = await fetch('/api/videos/add-by-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: addUrl, campaign_id: activeCampaignId, tags }),
      })
      const d = await res.json()
      if (res.ok) {
        setAddResult({ msg: d.message || 'Video added!', type: 'success' })
        setAddUrl(''); setAddTags('')
        setTimeout(() => { setAddResult(null); setShowAddUrl(false) }, 1500)
        setPage(1); videosQuery.refetch()
      } else setAddResult({ msg: d.error || 'Failed', type: 'error' })
    } catch { setAddResult({ msg: 'Network error', type: 'error' }) }
    finally { setAddingVideo(false) }
  }

  const toggleOwnership = async (videoId: string, current: boolean) => {
    if (!activeCampaignId) return
    setTogglingOwnership(videoId)
    try {
      await fetch('/api/videos/ownership', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: videoId, is_ours: !current, campaign_id: activeCampaignId }),
      })
      videosQuery.refetch()
    } catch { /* ignore */ }
    finally { setTogglingOwnership(null) }
  }

  const saveTags = async (youtubeId: string, tags: string[]) => {
    if (!activeCampaignId) return
    try {
      await fetch('/api/videos/tags', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtube_id: youtubeId, tags, campaign_id: activeCampaignId }),
      })
      videosQuery.refetch()
      setEditingTags(null)
    } catch { /* ignore */ }
  }

  const handleExport = () => {
    const headers = 'Title,Channel,Views,Daily Gain,Rank,Keywords,Brand Tags,Duration,Published,Ownership'
    const rows = videos.map(v => [
      `"${(v.title || '').replace(/"/g, '""')}"`, `"${v.channel_name || ''}"`,
      String(v.view_count || 0), String(gainMap[v.id]?.daily_gain ?? ''),
      String(v.best_rank || ''), String(v.keyword_count || 0),
      `"${(v.brands || v.tags || []).join(', ')}"`, fmtDuration(v.duration),
      v.published_at || '', v.is_ours ? 'Yes' : 'No',
    ])
    const blob = new Blob([headers + '\n' + rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'campaign_videos.csv'; a.click()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            Campaign Videos <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({total})</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setShowAddUrl(v => !v)} className="btn btn-sm" style={{ background: 'var(--green-gradient)', border: 'none', color: '#fff' }}>
            <Plus size={13} /> Add Video
          </button>
          <button onClick={handleExport} className="btn btn-ghost btn-sm">
            <Download size={12} /> Export
          </button>
        </div>
      </div>

      {/* Add Video by URL */}
      {showAddUrl && (
        <div className="card" style={{ border: '1.5px solid var(--border-green)', background: 'var(--green-dim)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#059669', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Link2 size={14} /> Add Video by YouTube URL
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
            <input className="input" placeholder="https://youtube.com/watch?v=..." value={addUrl} onChange={e => setAddUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addVideoByUrl()} style={{ flex: 1 }} />
            <input className="input" placeholder="Brand tags (comma separated)" value={addTags} onChange={e => setAddTags(e.target.value)} style={{ width: 220 }} />
          </div>
          {addResult && <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: addResult.type === 'success' ? '#059669' : '#DC2626' }}>{addResult.msg}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={addVideoByUrl} disabled={addingVideo || !addUrl.trim()} style={{ background: '#059669', color: '#fff', border: 'none' }}>
              {addingVideo ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={12} />} Add
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAddUrl(false)}><X size={12} /> Cancel</button>
          </div>
        </div>
      )}

      {/* Filters Row */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', border: '1px solid var(--border-2)', borderRadius: 'var(--border-radius-xs)', overflow: 'hidden' }}>
          <button onClick={() => { setShowAll(false); setTab('long'); setPage(1) }} className={`toggle-btn ${!showAll && tab === 'long' ? 'on' : ''}`}>Long-Form</button>
          <button onClick={() => { setShowAll(false); setTab('short'); setPage(1) }} className={`toggle-btn ${!showAll && tab === 'short' ? 'on' : ''}`}>Shorts</button>
          <button onClick={() => { setShowAll(true); setPage(1) }} className={`toggle-btn ${showAll ? 'on' : ''}`}>All Discovered</button>
        </div>

        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input" placeholder="Search videos…" value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()} style={{ paddingLeft: 32 }} />
        </div>

        <select className="input" value={sort} onChange={e => { setSort(e.target.value as any); setPage(1) }} style={{ minWidth: 110 }}>
          <option value="views">Top Views</option>
          <option value="rank">Best Rank</option>
          <option value="date">Recent</option>
          <option value="channel">Channel</option>
        </select>

        <button onClick={() => setShowFilters(v => !v)} className="btn btn-ghost btn-sm"
          style={{ borderColor: showFilters ? 'var(--blue)' : undefined, color: showFilters ? 'var(--blue)' : undefined }}>
          <Filter size={12} /> Filters
          {(brandFilter !== 'all' || channelFilter !== 'all' || ownershipFilter !== 'all') && (
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--blue)', marginLeft: 4 }} />
          )}
        </button>
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="card" style={{ padding: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div className="section-title" style={{ marginBottom: 5 }}>Brand</div>
            <select className="input" value={brandFilter} onChange={e => { setBrandFilter(e.target.value); setPage(1) }}>
              <option value="all">All Brands</option>
              {brands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <div className="section-title" style={{ marginBottom: 5 }}>Channel</div>
            <select className="input" value={channelFilter} onChange={e => { setChannelFilter(e.target.value); setPage(1) }}>
              <option value="all">All Channels</option>
              {channels.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="section-title" style={{ marginBottom: 5 }}>Ownership</div>
            <select className="input" value={ownershipFilter} onChange={e => { setOwnershipFilter(e.target.value as any); setPage(1) }}>
              <option value="all">All Videos</option>
              <option value="ours">Our Videos</option>
              <option value="theirs">Not Ours</option>
            </select>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => { setBrandFilter('all'); setChannelFilter('all'); setOwnershipFilter('all'); setPage(1) }}>Clear All</button>
        </div>
      )}

      {/* Video List */}
      {loading ? (
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, color: 'var(--text-muted)' }}>
          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} /> Loading…
        </div>
      ) : videos.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <Video size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
          <div>No videos found.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {videos.map((v, i) => {
            const tags = v.brands || v.tags || []
            const gain = gainMap[v.id]
            const isEditing = editingTags === v.youtube_id
            return (
              <div key={v.id || v.youtube_id}
                style={{
                  display: 'flex', gap: 14, padding: '14px 18px',
                  borderBottom: i < videos.length - 1 ? '1px solid var(--border-1)' : 'none',
                  background: v.is_ours ? 'var(--green-dim)' : 'transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!v.is_ours) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { if (!v.is_ours) e.currentTarget.style.background = 'transparent' }}
              >
                {/* Thumbnail */}
                <Link href={`/video/${v.youtube_id}`} style={{ flexShrink: 0, textDecoration: 'none' }}>
                  <div style={{ position: 'relative' }}>
                    <img src={v.thumbnail_url || `https://img.youtube.com/vi/${v.youtube_id}/mqdefault.jpg`}
                      alt="" style={{ width: 110, height: 62, borderRadius: 6, objectFit: 'cover', display: 'block' }} />
                    {v.is_short && <span style={{ position: 'absolute', bottom: 4, right: 4, fontSize: 8, fontWeight: 700, background: '#000', color: '#fff', padding: '1px 5px', borderRadius: 3 }}>SHORT</span>}
                    {v.best_rank && v.best_rank <= 3 && <span style={{ position: 'absolute', top: 4, left: 4, fontSize: 8, fontWeight: 700, background: '#FEF3C7', color: '#92400E', padding: '1px 5px', borderRadius: 3, border: '1px solid #FDE68A' }}>#{v.best_rank}</span>}
                  </div>
                </Link>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <Link href={`/video/${v.youtube_id}`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.title}
                    </Link>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><User size={10} /> {v.channel_name}</span>
                      {v.duration && <span><Clock size={10} style={{ verticalAlign: -1 }} /> {fmtDuration(v.duration)}</span>}
                      {v.published_at && <span>· {fmtRelative(v.published_at)}</span>}
                    </div>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                      <Eye size={11} /> {fmtIndian(v.view_count || gain?.latest_views)}
                      {gain?.daily_gain != null && gain.daily_gain !== 0 && (
                        <span style={{ fontSize: 10, fontWeight: 700, marginLeft: 2, color: gain.daily_gain > 0 ? '#059669' : '#DC2626', fontFamily: "'JetBrains Mono', monospace" }}>
                          ({fmtGain(gain.daily_gain)})
                        </span>
                      )}
                    </span>

                    {v.best_rank && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        background: v.best_rank <= 3 ? '#FEF3C7' : v.best_rank <= 5 ? '#DBEAFE' : 'var(--bg-elevated)',
                        color: v.best_rank <= 3 ? '#92400E' : v.best_rank <= 5 ? '#1D4ED8' : 'var(--text-muted)' }}>
                        <Hash size={9} /> #{v.best_rank}
                      </span>
                    )}

                    {v.keyword_count > 0 && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{v.keyword_count} KW</span>}

                    <button onClick={() => toggleOwnership(v.id, v.is_ours)} disabled={togglingOwnership === v.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, border: 'none', cursor: 'pointer',
                        background: v.is_ours ? '#DCFCE7' : 'var(--bg-elevated)', color: v.is_ours ? '#16A34A' : 'var(--text-muted)', fontFamily: 'inherit' }}>
                      {togglingOwnership === v.id ? <Loader2 size={9} style={{ animation: 'spin 1s linear infinite' }} /> : v.is_ours ? <><Check size={9} /> Ours</> : 'Mark ours'}
                    </button>
                  </div>

                  {/* Brand Tags */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                    {isEditing ? (
                      <>
                        <input autoFocus value={tagInput} onChange={e => setTagInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveTags(v.youtube_id, tagInput.split(',').map(t => t.trim()).filter(Boolean)); if (e.key === 'Escape') setEditingTags(null) }}
                          style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--blue)', outline: 'none', width: 160 }} placeholder="Brand1, Brand2" />
                        <button onClick={() => saveTags(v.youtube_id, tagInput.split(',').map(t => t.trim()).filter(Boolean))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#059669', padding: 2 }}><Check size={11} /></button>
                        <button onClick={() => setEditingTags(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}><X size={11} /></button>
                      </>
                    ) : (
                      <>
                        {tags.map((tag: string) => (
                          <span key={tag} style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: `${brandColor(tag)}10`, color: brandColor(tag), border: `1px solid ${brandColor(tag)}20` }}>{tag}</span>
                        ))}
                        <button onClick={() => { setEditingTags(v.youtube_id); setTagInput(tags.join(', ')) }}
                          style={{ width: 18, height: 18, borderRadius: 4, border: '1px dashed var(--border-2)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                          <Plus size={10} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* External link */}
                <a href={`https://youtube.com/watch?v=${v.youtube_id}`} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--text-muted)', padding: 4, flexShrink: 0 }} title="Open on YouTube">
                  <ExternalLink size={12} />
                </a>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
            <ChevronLeft size={14} /> Prev
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Page {page} of {totalPages}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
