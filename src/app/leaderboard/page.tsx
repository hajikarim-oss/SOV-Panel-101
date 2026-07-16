'use client'

import { useState, useEffect, useCallback } from 'react'
import { ExternalLink, Download, ChevronUp, ChevronDown, Search, Loader2, AlertCircle, Plus, X, Tag, Brain } from 'lucide-react'
import { useCampaignStore } from '@/lib/store'
import Link from 'next/link'

interface KeywordRank {
  keyword_text: string
  rank: number
}

interface VideoRow {
  id: string
  youtube_id: string
  title: string
  channel_name: string
  view_count: number
  best_rank: number
  keyword_count: number
  discovered_at: string
  is_new: boolean
  keywords_appeared: string[]
  tags: string[]
  keyword_ranks?: KeywordRank[]
}

const BRAND_COLORS: Record<string, string> = {
  BrandAlpha: '#1A73E8', CompetitorX: '#3B82F6', MarketLeader: '#22C55E',
  RisingBrand: '#A855F7', NichePro: '#EF4444',
}

function fmt(n: number): string {
  if (n == null || isNaN(n)) return '0'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const W = 56, H = 22
  const points = data.map((v, i) =>
    `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * H}`
  ).join(' ')
  const trend = data[data.length - 1] > data[0]
  return (
    <svg width={W} height={H} className="sparkline">
      <polyline points={points} fill="none"
        stroke={trend ? '#10B981' : '#EF4444'}
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

function KeywordRankBreakdown({ ranks }: { ranks?: KeywordRank[] }) {
  const [expanded, setExpanded] = useState(false)
  if (!ranks || ranks.length === 0) return null
  
  const show = expanded ? ranks : ranks.slice(0, 2)
  const remaining = ranks.length - 2

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4, alignItems: 'center' }}>
      {show.map((r, i) => (
        <span key={i} style={{ 
          fontSize: 9.5, padding: '2px 6px', borderRadius: 4, 
          background: 'rgba(26,115,232,0.06)', border: '1px solid rgba(26,115,232,0.15)',
          color: '#1A73E8', fontWeight: 600
        }}>
          {r.keyword_text}: <strong>#{r.rank}</strong>
        </span>
      ))}
      {!expanded && remaining > 0 && (
        <button 
          onClick={() => setExpanded(true)} 
          style={{ background: 'none', border: 'none', color: '#1A73E8', fontSize: 9, fontWeight: 700, cursor: 'pointer', padding: '2px 4px', display: 'inline-flex', alignItems: 'center', gap: 1 }}
        >
          +{remaining} more <ChevronDown size={8} />
        </button>
      )}
      {expanded && (
        <button 
          onClick={() => setExpanded(false)} 
          style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 9, fontWeight: 700, cursor: 'pointer', padding: '2px 4px', display: 'inline-flex', alignItems: 'center', gap: 1 }}
        >
          Less <ChevronUp size={8} />
        </button>
      )}
    </div>
  )
}

const PER_PAGE = 20
export default function LeaderboardPage() {
  const { campaigns, activeCampaignId, fetchCampaigns } = useCampaignStore()
  const [tab, setTab] = useState<'long' | 'short'>('long')
  const [sort, setSort] = useState<'views' | 'frequency' | 'rank'>('views')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [videos, setVideos] = useState<VideoRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  
  // Filters
  const [selectedBrand, setSelectedBrand] = useState('')
  const [selectedKeyword, setSelectedKeyword] = useState('')
  const [selectedChannel, setSelectedChannel] = useState('')
  const [keywords, setKeywords] = useState<any[]>([])
  const [channels, setChannels] = useState<string[]>([])

  // Tag editing state
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null)
  const [campaignBrands, setCampaignBrands] = useState<string[]>([])
  const [customTagInput, setCustomTagInput] = useState('')
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [batchAnalyzing, setBatchAnalyzing] = useState(false)

  const fetchVideos = useCallback(async (campId: string, t: 'long' | 'short', s: 'views' | 'frequency' | 'rank', p: number, brand = '', kwId = '', qStr = '', channel = '') => {
    if (!campId) return
    setLoading(true)
    try {
      let url = `/api/videos/leaderboard?campaign_id=${campId}&tab=${t}&sort=${s}&page=${p}&limit=${PER_PAGE}`
      if (brand) url += `&brand_name=${encodeURIComponent(brand)}`
      if (kwId) url += `&keyword_id=${encodeURIComponent(kwId)}`
      if (channel) url += `&channel_name=${encodeURIComponent(channel)}`
      if (qStr.trim()) url += `&q=${encodeURIComponent(qStr.trim())}`
      const res = await fetch(url)
      const d = await res.json()
      if (d.data) {
        setVideos(d.data)
        setTotal(d.total ?? 0)
        if (d.channels) setChannels(d.channels)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchBrands = useCallback(async (campId: string) => {
    try {
      const res = await fetch(`/api/brands?campaign_id=${campId}`)
      const d = await res.json()
      if (d.data) {
        setCampaignBrands(d.data.map((b: any) => b.brand_name ?? b.name))
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  const fetchKeywords = useCallback(async (campId: string) => {
    try {
      const res = await fetch(`/api/keywords?campaign_id=${campId}`)
      const d = await res.json()
      if (d.keywords) {
        setKeywords(d.keywords)
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  useEffect(() => {
    if (activeCampaignId) {
      fetchVideos(activeCampaignId, tab, sort, page, selectedBrand, selectedKeyword, search, selectedChannel)
      fetchBrands(activeCampaignId)
      fetchKeywords(activeCampaignId)
    } else {
      setLoading(false)
    }
  }, [activeCampaignId, tab, sort, page, selectedBrand, selectedKeyword, search, selectedChannel, fetchVideos, fetchBrands, fetchKeywords])

  const handleUpdateTags = async (youtubeId: string, newTags: string[]) => {
    if (!activeCampaignId) return
    try {
      setVideos(prev => prev.map(v => v.youtube_id === youtubeId ? { ...v, tags: newTags } : v))
      
      await fetch('/api/videos/tags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtube_id: youtubeId,
          tags: newTags,
          campaign_id: activeCampaignId,
        })
      })
    } catch (e) {
      console.error(e)
    }
  }

  const handleAutoAnalyze = async (youtubeId: string) => {
    if (!activeCampaignId) return
    setAnalyzingId(youtubeId)
    try {
      const res = await fetch('/api/brands/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_ids: [youtubeId], campaign_id: activeCampaignId, force: false }),
      })
      const result = await res.json()
      const analysis = result.results?.[0]
      if (analysis?.status === 'analyzed' && analysis.high_confidence_brands?.length > 0) {
        const currentTags = videos.find(v => v.youtube_id === youtubeId)?.tags || []
        const mergedTags = [...new Set([...currentTags, ...analysis.high_confidence_brands])]
        setVideos(prev => prev.map(v => v.youtube_id === youtubeId ? { ...v, tags: mergedTags } : v))
      }
    } catch (e) {
      console.error('Auto analysis failed:', e)
    } finally {
      setAnalyzingId(null)
    }
  }

  const handleBatchAnalyze = async () => {
    if (!activeCampaignId || videos.length === 0) return
    setBatchAnalyzing(true)
    try {
      const ids = videos.map(v => v.youtube_id)
      const res = await fetch('/api/brands/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_ids: ids, campaign_id: activeCampaignId, force: false }),
      })
      const result = await res.json()
      // Refresh video list to get updated tags
      fetchVideos(activeCampaignId, tab, sort, page, selectedBrand, selectedKeyword, search, selectedChannel)
    } catch (e) {
      console.error('Batch analysis failed:', e)
    } finally {
      setBatchAnalyzing(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  const handleExportCSV = () => {
    const headers = 'Youtube ID,Title,Channel,Views,Best Rank,Discovered At,Tags'
    const rows = videos.map((v) =>
      `"${v.youtube_id}","${v.title.replace(/"/g, '""')}","${v.channel_name.replace(/"/g, '""')}",${v.view_count},${v.best_rank},${new Date(v.discovered_at).toLocaleDateString()},"${v.tags.join(';')}"`
    )
    const blob = new Blob([headers + '\n' + rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `top_${tab}_videos.csv`; a.click()
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 12 }}>
        <Loader2 size={32} style={{ color: '#1A73E8', animation: 'spin 1s linear infinite' }} />
        <div style={{ fontSize: 13.5, color: '#64748B', fontWeight: 600 }}>Loading video leaderboard…</div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div className="anim-fade-up">
      <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Top Videos <span className="accent">Leaderboard</span></h1>
          <p className="page-subtitle">Rankings based on search query extraction. Click on video tags to add or remove tags.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="toggle-group">
            <button className={`toggle-btn ${tab === 'long' ? 'active' : ''}`} onClick={() => { setTab('long'); setPage(1) }}>
              Long-Form
            </button>
            <button className={`toggle-btn ${tab === 'short' ? 'active' : ''}`} onClick={() => { setTab('short'); setPage(1) }}>
              Shorts
            </button>
          </div>
          <div className="toggle-group">
            <button className={`toggle-btn ${sort === 'views' ? 'active' : ''}`} onClick={() => { setSort('views'); setPage(1) }}>
              Top by Views
            </button>
            <button className={`toggle-btn ${sort === 'frequency' ? 'active' : ''}`} onClick={() => { setSort('frequency'); setPage(1) }}>
              Top by Freq
            </button>
            <button className={`toggle-btn ${sort === 'rank' ? 'active' : ''}`} onClick={() => { setSort('rank'); setPage(1) }}>
              YouTube Rank
            </button>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleExportCSV}>
            <Download size={13} /> Export CSV
          </button>
          <button
            className="btn btn-sm"
            onClick={handleBatchAnalyze}
            disabled={batchAnalyzing}
            style={{
              background: batchAnalyzing ? '#F1F5F9' : 'rgba(124,58,237,0.08)',
              border: `1px solid ${batchAnalyzing ? '#E2E8F0' : 'rgba(124,58,237,0.25)'}`,
              color: '#7C3AED',
              fontWeight: 700,
            }}
          >
            {batchAnalyzing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Brain size={13} />}
            {batchAnalyzing ? 'Analyzing...' : 'AI Analyze All'}
          </button>
        </div>
      </div>

      {/* Search & Select Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
          <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: 34 }}
            placeholder="Search within page results..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Brand Dropdown Filter */}
        <div style={{ minWidth: 150 }}>
          <select
            className="input"
            value={selectedBrand}
            onChange={e => { setSelectedBrand(e.target.value); setPage(1) }}
            style={{ cursor: 'pointer', padding: '6px 12px' }}
          >
            <option value="">All Brands</option>
            {campaignBrands.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {/* Keyword Dropdown Filter */}
        <div style={{ minWidth: 180 }}>
          <select
            className="input"
            value={selectedKeyword}
            onChange={e => {
              const val = e.target.value
              setSelectedKeyword(val)
              setSort(val ? 'rank' : 'views')
              setPage(1)
            }}
            style={{ cursor: 'pointer', padding: '6px 12px' }}
          >
            <option value="">All Keywords</option>
            {keywords.map(kw => (
              <option key={kw.id} value={kw.id}>{kw.text} ({kw.language})</option>
            ))}
          </select>
        </div>

        {/* Channel Dropdown Filter */}
        <div style={{ minWidth: 180 }}>
          <select
            className="input"
            value={selectedChannel}
            onChange={e => { setSelectedChannel(e.target.value); setPage(1) }}
            style={{ cursor: 'pointer', padding: '6px 12px' }}
          >
            <option value="">All Channels</option>
            {channels.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Reset Filters */}
        {(selectedBrand || selectedKeyword || selectedChannel || search) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setSelectedBrand('')
              setSelectedKeyword('')
              setSelectedChannel('')
              setSearch('')
              setPage(1)
            }}
            style={{ color: '#EF4444' }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Main Table */}
      {videos.length === 0 ? (
        <div style={{
          display: 'flex', gap: 12, padding: 28, borderRadius: 14, background: '#FFFFFF',
          border: '1px solid #F1F5F9', alignItems: 'center', justifyContent: 'center', flexDirection: 'column'
        }}>
          <AlertCircle size={32} style={{ color: '#94A3B8', marginBottom: 8 }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>No Leaderboard Entries Found</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>Add keywords and fire scrape jobs in Campaign Control to populate listings.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 68, textAlign: 'center', fontSize: 10, color: '#94A3B8' }}>
                    Row
                  </th>
                  <th>Video</th>
                  <th>Keywords Tagged</th>
                  <th>Tags / Products</th>
                  <th>Channel</th>
                  <th style={{ textAlign: 'right' }}>Views</th>
                  <th style={{ textAlign: 'right' }}>Best Rank</th>
                  <th style={{ textAlign: 'center' }}>Keyword Count</th>
                  <th>Trend</th>
                  <th>Extracted</th>
                </tr>
              </thead>
              <tbody>
                {videos.map((video, i) => {
                  const globalRank = (page - 1) * PER_PAGE + i + 1
                  const sparkData = Array.from({ length: 7 }, (_, j) =>
                    video.view_count * (0.8 + j * 0.04 + Math.random() * 0.08)
                  )
                  const isEditing = editingVideoId === video.youtube_id

                  return (
                    <tr key={video.youtube_id}>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: globalRank <= 3 ? 'rgba(26,115,232,0.12)' : 'transparent',
                          color: globalRank <= 3 ? '#1A73E8' : 'var(--text-muted)',
                          fontWeight: 800, fontSize: 12, margin: '0 auto',
                        }}>
                          {globalRank}
                        </div>
                      </td>
                      <td style={{ maxWidth: 320 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Link
                            href={`/video/${video.youtube_id}`}
                            style={{ flexShrink: 0, display: 'block', width: 72, height: 40, borderRadius: 6, background: '#F1F5F9', overflow: 'hidden' }}
                          >
                            <img
                              src={`https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </Link>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', gap: 4, marginBottom: 3 }}>
                              {video.is_new && <span className="badge badge-green" style={{ fontSize: 9 }}>NEW</span>}
                            </div>
                            <Link
                              href={`/video/${video.youtube_id}`}
                              style={{
                                fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                                textDecoration: 'none', lineHeight: 1.4,
                                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                              } as React.CSSProperties}
                            >
                              {video.title}
                            </Link>
                          </div>
                        </div>
                      </td>
                      <td style={{ minWidth: 180 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                          {video.keyword_ranks && video.keyword_ranks.length > 0 ? video.keyword_ranks.map((kr, idx) => (
                            <span
                              key={`kw-${idx}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                fontSize: 9.5,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: 'rgba(26,115,232,0.06)',
                                border: '1px solid rgba(26,115,232,0.15)',
                                color: '#1A73E8',
                                fontWeight: 600,
                              }}
                            >
                              {kr.keyword_text.length > 18 ? kr.keyword_text.slice(0, 18) + '…' : kr.keyword_text}: <strong>#{kr.rank}</strong>
                            </span>
                          )) : (
                            <span style={{ fontSize: 11, color: '#CBD5E1' }}>—</span>
                          )}
                        </div>
                      </td>
                      <td style={{ minWidth: 200, position: 'relative' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                          {video.tags && video.tags.map(tag => (
                            <span
                              key={tag}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                fontSize: 10.5,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: 'rgba(26,115,232,0.06)',
                                border: '1px solid rgba(26,115,232,0.15)',
                                color: '#1A73E8',
                                fontWeight: 700,
                              }}
                            >
                              {tag}
                              <button
                                onClick={() => handleUpdateTags(video.youtube_id, video.tags.filter(t => t !== tag))}
                                style={{ background: 'none', border: 'none', color: '#1A73E8', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                              >
                                <X size={10} />
                              </button>
                            </span>
                          ))}

                          {/* Auto Analyze Button */}
                          <button
                            onClick={() => handleAutoAnalyze(video.youtube_id)}
                            disabled={analyzingId === video.youtube_id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: analyzingId === video.youtube_id ? '#F1F5F9' : 'rgba(124,58,237,0.06)',
                              border: `1px solid ${analyzingId === video.youtube_id ? '#E2E8F0' : 'rgba(124,58,237,0.2)'}`,
                              color: '#7C3AED',
                              fontSize: 10,
                              fontWeight: 700,
                              cursor: analyzingId === video.youtube_id ? 'not-allowed' : 'pointer',
                              opacity: analyzingId === video.youtube_id ? 0.6 : 1,
                              transition: 'all 0.15s',
                            }}
                            title="AI auto-detect brands from transcript"
                          >
                            {analyzingId === video.youtube_id ? (
                              <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />
                            ) : (
                              <Brain size={10} />
                            )}
                            {analyzingId === video.youtube_id ? '...' : 'AI'}
                          </button>

                          <button
                            onClick={() => {
                              setEditingVideoId(isEditing ? null : video.youtube_id)
                              setCustomTagInput('')
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 20,
                              height: 20,
                              borderRadius: 4,
                              background: '#F1F5F9',
                              border: '1px solid #E2E8F0',
                              cursor: 'pointer',
                              color: '#64748B',
                            }}
                            title="Add / edit product tags"
                          >
                            <Plus size={12} />
                          </button>
                        </div>

                        {/* Inline Tags Popover */}
                        {isEditing && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            zIndex: 90,
                            background: '#FFFFFF',
                            border: '1px solid #E2E8F0',
                            borderRadius: 8,
                            padding: 10,
                            width: 220,
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                            marginTop: 4,
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderBottom: '1px solid #F1F5F9', paddingBottom: 4 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Select Brand/Product</span>
                              <button
                                onClick={() => setEditingVideoId(null)}
                                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0 }}
                              >
                                <X size={12} />
                              </button>
                            </div>
                            
                            {/* Campaign Brands list */}
                            <div style={{ maxHeight: 110, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                              {campaignBrands.length === 0 ? (
                                <span style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic' }}>No campaign brands defined. Add them in Control tab.</span>
                              ) : (
                                campaignBrands.map(brand => {
                                  const hasTag = video.tags && video.tags.includes(brand)
                                  return (
                                    <label key={brand} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, cursor: 'pointer', color: '#334155' }}>
                                      <input
                                        type="checkbox"
                                        checked={hasTag}
                                        onChange={() => {
                                          const next = hasTag
                                            ? video.tags.filter(t => t !== brand)
                                            : [...(video.tags || []), brand]
                                          handleUpdateTags(video.youtube_id, next)
                                        }}
                                      />
                                      {brand}
                                    </label>
                                  )
                                })
                              )}
                            </div>

                            {/* Custom tag input */}
                            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                              <input
                                className="input"
                                style={{ padding: '4px 8px', fontSize: 11 }}
                                placeholder="Custom tag name..."
                                value={customTagInput}
                                onChange={e => setCustomTagInput(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && customTagInput.trim()) {
                                    const val = customTagInput.trim()
                                    if (!video.tags.includes(val)) {
                                      handleUpdateTags(video.youtube_id, [...video.tags, val])
                                    }
                                    setCustomTagInput('')
                                  }
                                }}
                              />
                              <button
                                onClick={() => {
                                  if (customTagInput.trim()) {
                                    const val = customTagInput.trim()
                                    if (!video.tags.includes(val)) {
                                      handleUpdateTags(video.youtube_id, [...video.tags, val])
                                    }
                                    setCustomTagInput('')
                                  }
                                }}
                                style={{
                                  background: '#1A73E8',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  borderRadius: 4,
                                  padding: '4px 8px',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{video.channel_name}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                          {fmt(video.view_count)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: '#1A73E8' }}>
                          #{video.best_rank}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>
                          {video.keyword_count}
                        </span>
                      </td>
                      <td><Sparkline data={sparkData} /></td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date(video.discovered_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px', borderTop: '1px solid var(--border-1)',
            background: 'var(--bg-surface)',
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Showing <strong style={{ color: 'var(--text-secondary)' }}>
                {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)}
              </strong> of <strong style={{ color: 'var(--text-secondary)' }}>{total}</strong> videos
            </span>
            <div className="pagination">
              <button className="page-btn" onClick={() => setPage(1)} disabled={page === 1}>«</button>
              <button className="page-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} className={`page-btn ${page === p ? 'active' : ''}`} onClick={() => setPage(p)}>
                  {p}
                </button>
              ))}
              <button className="page-btn" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>›</button>
              <button className="page-btn" onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
