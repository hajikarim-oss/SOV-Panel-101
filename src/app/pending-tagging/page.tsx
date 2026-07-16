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

function formatDate(d: string): string {
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

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])
  useEffect(() => { fetchData() }, [fetchData])
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

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: '24px 32px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <Link href="/" style={{ color: '#64748B', fontSize: 13, textDecoration: 'none' }}>Dashboard</Link>
          <span style={{ color: '#CBD5E1' }}>/</span>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={20} color="#EF4444" /> Pending Tagging
          </h1>
          <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, marginLeft: 8 }}>{total} videos need brands</span>
        </div>
        <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 20px 0' }}>
          Top-ranked videos that haven&apos;t been tagged with a brand yet. Click &quot;Tag&quot; to manually assign a brand, or use AI analysis.
        </p>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 400 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search untagged videos..."
              style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, background: '#fff', outline: 'none' }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Loader2 size={24} className="animate-spin" style={{ color: '#8B5CF6' }} />
            <p style={{ color: '#94A3B8', fontSize: 13, marginTop: 12 }}>Loading untagged videos...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#EF4444', fontSize: 13 }}>{error}</div>
        ) : data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, background: '#fff', borderRadius: 12, border: '1px solid #F1F5F9' }}>
            <Check size={32} style={{ color: '#10B981', marginBottom: 12 }} />
            <p style={{ color: '#0F172A', fontSize: 14, fontWeight: 700, margin: '0 0 4px 0' }}>All caught up!</p>
            <p style={{ color: '#94A3B8', fontSize: 13 }}>No pending videos need tagging.</p>
          </div>
        ) : (
          <>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F1F5F9', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#FEF2F2', borderBottom: '1px solid #FEE2E2' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#991B1B', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Video</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#991B1B', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Channel</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#991B1B', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Views</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#991B1B', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Best Rank</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#991B1B', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Keywords</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#991B1B', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((v: PendingVideo) => (
                    <tr key={v.id} style={{ borderBottom: '1px solid #F8FAFC', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FFFBFB')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ padding: '10px 14px', maxWidth: 350 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {v.thumbnail_url && (
                            <img src={v.thumbnail_url} alt="" style={{ width: 56, height: 32, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: '#0F172A', fontSize: 12, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {v.title || 'Untitled'}
                            </div>
                            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Added {formatDate(v.discovered_at)}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#64748B', fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.channel_name || '—'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#0F172A', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                        {fmt(v.view_count)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 28, height: 28, borderRadius: '50%',
                          background: v.best_rank <= 3 ? '#FEF2F2' : v.best_rank <= 5 ? '#FFFBEB' : '#F8FAFC',
                          color: v.best_rank <= 3 ? '#DC2626' : v.best_rank <= 5 ? '#D97706' : '#64748B',
                          fontWeight: 800, fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                          border: `1px solid ${v.best_rank <= 3 ? '#FECACA' : v.best_rank <= 5 ? '#FDE68A' : '#E2E8F0'}`,
                        }}>
                          {v.best_rank}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {v.keyword_names.slice(0, 2).map((kw: string) => (
                            <span key={kw} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(26,115,232,0.06)', border: '1px solid rgba(26,115,232,0.15)', color: '#1A73E8', fontWeight: 600 }}>{kw}</span>
                          ))}
                          {v.keyword_count > 2 && (
                            <span style={{ fontSize: 10, color: '#94A3B8', padding: '2px 4px' }}>+{v.keyword_count - 2}</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <button
                          onClick={() => setTagModal({ videoId: v.id, title: v.title, brands: [] })}
                          style={{
                            padding: '5px 12px', borderRadius: 6, border: 'none',
                            background: '#8B5CF6', color: '#fff',
                            fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          <Tag size={11} /> Tag
                        </button>
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

      {tagModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setTagModal(null)}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 24, width: 440, maxWidth: '90vw',
            boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0 }}>Tag Video</h3>
              <button onClick={() => setTagModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 18 }}>×</button>
            </div>
            <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              {tagModal.title}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={manualTag}
                onChange={e => setManualTag(e.target.value)}
                placeholder="Enter brand name..."
                onKeyDown={e => { if (e.key === 'Enter') handleSaveTag(tagModal.videoId) }}
                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none' }}
              />
              <button
                onClick={() => handleSaveTag(tagModal.videoId)}
                disabled={tagSaving || !manualTag.trim()}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none',
                  background: manualTag.trim() ? '#8B5CF6' : '#E2E8F0',
                  color: manualTag.trim() ? '#fff' : '#94A3B8',
                  fontSize: 12, fontWeight: 700, cursor: manualTag.trim() ? 'pointer' : 'default',
                }}
              >
                {tagSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button
                onClick={async () => {
                  if (!activeCampaignId) return
                  setAnalyzing(prev => new Set(prev).add(tagModal.videoId))
                  try {
                    const res = await fetch('/api/brands/analyze', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ video_id: tagModal.videoId, campaign_id: activeCampaignId }),
                    })
                    const json = await res.json()
                    if (json.brands) {
                      setTagModal(prev => prev ? { ...prev, brands: json.brands } : null)
                    }
                  } catch (err) {
                    console.error('AI analyze error:', err)
                  } finally {
                    setAnalyzing(prev => { const n = new Set(prev); n.delete(tagModal.videoId); return n })
                  }
                }}
                disabled={analyzing.has(tagModal.videoId)}
                style={{
                  padding: '6px 12px', borderRadius: 6, border: '1px solid #E2E8F0',
                  background: '#fff', color: '#8B5CF6',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <Brain size={12} /> {analyzing.has(tagModal.videoId) ? 'Analyzing...' : 'AI Analyze'}
              </button>
            </div>
            {tagModal.brands.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tagModal.brands.map(b => (
                  <button key={b} onClick={() => setManualTag(b)} style={{
                    padding: '4px 10px', borderRadius: 6, border: '1px solid #E2E8F0',
                    background: manualTag === b ? '#8B5CF6' : '#fff',
                    color: manualTag === b ? '#fff' : '#64748B',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}>{b}</button>
                ))}
              </div>
            )}
            <a href={`https://youtube.com/watch?v=${tagModal?.videoId}`} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 12, fontSize: 11, color: '#94A3B8', textDecoration: 'none' }}>
              <ExternalLink size={11} /> Watch on YouTube
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
