'use client'

import { useState, useEffect, useCallback } from 'react'
import { Video, Search, Loader2, ExternalLink, ChevronLeft, ChevronRight, Tag, Brain, AlertCircle, Check } from 'lucide-react'
import { useCampaignStore } from '@/lib/store'
import Link from 'next/link'

interface PendingVideo {
  id: string
  youtube_id: string
  title: string
  channel_name: string
  view_count: number
  tags: string[]
  thumbnail_url: string
  published_at: string
  discovered_at: string
  best_rank: number
  keyword_names: string[]
  keyword_count: number
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

export default function PendingTaggingPage() {
  const { campaigns, activeCampaignId, fetchCampaigns } = useCampaignStore()
  const [data, setData] = useState<PendingVideo[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [analyzing, setAnalyzing] = useState<Set<string>>(new Set())
  const [tagModal, setTagModal] = useState<{ videoId: string; title: string; brands: string[] } | null>(null)
  const [manualTag, setManualTag] = useState('')
  const [tagSaving, setTagSaving] = useState(false)
  const [campaignBrands, setCampaignBrands] = useState<string[]>([])

  const fetchData = useCallback(async () => {
    if (!activeCampaignId) return
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        campaign_id: activeCampaignId,
        page: String(page),
        limit: String(PER_PAGE),
      })
      if (search) params.set('q', search)
      const res = await fetch(`/api/videos/pending-tagging?${params}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json.data || [])
      setTotal(json.total || 0)
    } catch (err: any) {
      setError(err.message || 'Failed to load pending videos')
    } finally {
      setLoading(false)
    }
  }, [activeCampaignId, page, search])

  const fetchBrands = useCallback(async (campId: string) => {
    try {
      const res = await fetch(`/api/brands?campaign_id=${campId}`)
      const d = await res.json()
      if (d.data) setCampaignBrands(d.data.map((b: any) => b.brand_name ?? b.name))
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])
  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { if (activeCampaignId) fetchBrands(activeCampaignId) }, [activeCampaignId, fetchBrands])
  useEffect(() => { setPage(1) }, [search])

  const totalPages = Math.ceil(total / PER_PAGE)

  async function handleSaveTag(videoId: string) {
    if (!activeCampaignId || !manualTag.trim()) return
    setTagSaving(true)
    try {
      await fetch('/api/brands/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: videoId, brand_name: manualTag.trim(), campaign_id: activeCampaignId }),
      })
      setManualTag('')
      setTagModal(null)
      fetchData()
    } catch (err) {
      console.error('Tag save error:', err)
    } finally {
      setTagSaving(false)
    }
  }

  async function handleAiAnalyze(videoId: string) {
    if (!activeCampaignId) return
    setAnalyzing(prev => new Set(prev).add(videoId))
    try {
      const res = await fetch('/api/brands/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_ids: [videoId], campaign_id: activeCampaignId, force: false }),
      })
      const json = await res.json()
      const analysis = json.results?.[0]
      if (analysis?.status === 'analyzed' && analysis.high_confidence_brands?.length > 0) {
        setTagModal(prev => prev ? { ...prev, brands: analysis.high_confidence_brands } : null)
      } else {
        setTagModal(prev => prev ? { ...prev, brands: [] } : null)
      }
    } catch (err) {
      console.error('AI analyze error:', err)
    } finally {
      setAnalyzing(prev => { const n = new Set(prev); n.delete(videoId); return n })
    }
  }

  return (
    <div className="anim-fade-up">
      <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <div className="page-header">
        <div>
          <h1 className="page-title"><span className="accent" style={{ background: 'var(--red-gradient)', WebkitBackgroundClip: 'text' }}>Pending</span> Tagging</h1>
          <p className="page-subtitle">Top-ranked videos that haven&apos;t been tagged with a brand yet. Click &quot;Tag&quot; to manually assign, or use AI analysis.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
            {total} videos need brands
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
          <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: 34 }}
            placeholder="Search untagged videos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', gap: 12 }}>
          <Loader2 size={32} style={{ color: '#1A73E8', animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: 13.5, color: '#64748B', fontWeight: 600 }}>Loading untagged videos…</div>
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#EF4444', fontSize: 13 }}>{error}</div>
      ) : data.length === 0 ? (
        <div style={{
          display: 'flex', gap: 12, padding: 28, borderRadius: 14, background: '#FFFFFF',
          border: '1px solid #F1F5F9', alignItems: 'center', justifyContent: 'center', flexDirection: 'column'
        }}>
          <Check size={32} style={{ color: '#10B981', marginBottom: 8 }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>All caught up!</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>No pending videos need tagging.</div>
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Video</th>
                    <th>Channel</th>
                    <th style={{ textAlign: 'right' }}>Views</th>
                    <th style={{ textAlign: 'center' }}>Best Rank</th>
                    <th>Keywords</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((v: PendingVideo) => (
                    <tr key={v.id}>
                      <td style={{ maxWidth: 350 }}>
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
                            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Added {fmtDate(v.discovered_at)}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.channel_name || '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                        <span className="mono">{fmt(v.view_count)}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="rank-num" style={{
                          background: v.best_rank <= 3 ? 'rgba(26,115,232,0.12)' : v.best_rank <= 5 ? 'rgba(255,109,0,0.10)' : 'transparent',
                          color: v.best_rank <= 3 ? '#1A73E8' : v.best_rank <= 5 ? 'var(--orange)' : 'var(--text-muted)',
                        }}>
                          {v.best_rank}
                        </div>
                      </td>
                      <td style={{ minWidth: 180 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                          {v.keyword_names.slice(0, 2).map((kw: string) => (
                            <span key={kw} className="chip">{kw}</span>
                          ))}
                          {v.keyword_count > 2 && (
                            <span className="badge badge-gray">+{v.keyword_count - 2}</span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-sm"
                          onClick={() => setTagModal({ videoId: v.id, title: v.title, brands: [] })}
                          style={{
                            background: 'rgba(124,58,237,0.08)',
                            border: '1px solid rgba(124,58,237,0.25)',
                            color: '#7C3AED',
                            fontWeight: 700,
                          }}
                        >
                          <Tag size={12} /> Tag
                        </button>
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

      {tagModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => { setTagModal(null); setManualTag('') }}>
          <div className="card" style={{ width: 480, maxWidth: '90vw', padding: 28 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-bright)' }}>Tag Video</h3>
              <button onClick={() => { setTagModal(null); setManualTag('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, padding: 4 }}>×</button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              {tagModal.title}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                value={manualTag}
                onChange={e => setManualTag(e.target.value)}
                placeholder="Enter brand name..."
                onKeyDown={e => { if (e.key === 'Enter') handleSaveTag(tagModal.videoId) }}
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-blue btn-sm"
                onClick={() => handleSaveTag(tagModal.videoId)}
                disabled={tagSaving || !manualTag.trim()}
                style={{ opacity: manualTag.trim() ? 1 : 0.5 }}
              >
                {tagSaving ? 'Saving...' : 'Save'}
              </button>
            </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button
                className="btn btn-sm"
                onClick={() => handleAiAnalyze(tagModal.videoId)}
                disabled={analyzing.has(tagModal.videoId)}
                style={{
                  background: 'rgba(124,58,237,0.08)',
                  border: '1px solid rgba(124,58,237,0.25)',
                  color: '#7C3AED',
                  fontWeight: 700,
                }}
              >
                {analyzing.has(tagModal.videoId)
                  ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Analyzing…</>
                  : <><Brain size={12} /> AI Analyze</>
                }
              </button>
            </div>

            {tagModal.brands.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tagModal.brands.map(b => (
                  <button key={b} className={`chip ${manualTag === b ? 'badge badge-purple' : ''}`}
                    onClick={() => setManualTag(b)} style={{ cursor: 'pointer' }}>
                    {b}
                  </button>
                ))}
              </div>
            )}

            {campaignBrands.length > 0 && !tagModal.brands.length && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Quick select from campaign brands
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {campaignBrands.slice(0, 8).map(b => (
                    <button key={b} className={`chip`} onClick={() => setManualTag(b)}
                      style={{ cursor: 'pointer', background: manualTag === b ? 'var(--blue-dim)' : undefined, color: manualTag === b ? 'var(--blue)' : undefined, border: manualTag === b ? '1px solid rgba(26,115,232,0.25)' : undefined }}>
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(26,115,232,0.08)' }}>
              <a href={`https://youtube.com/watch?v=${tagModal?.videoId}`} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', textDecoration: 'none' }}>
                <ExternalLink size={11} /> Watch on YouTube
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
