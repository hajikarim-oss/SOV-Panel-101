'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Layers, Loader2, AlertCircle, Hash, ChevronDown, ChevronUp, Search } from 'lucide-react'
import { useCampaignStore } from '@/lib/store'

interface MultiVideo {
  youtube_id: string
  title: string
  description?: string
  channel_name: string
  view_count: number
  thumbnail_url: string
  keyword_count: number
  keywords_appeared: string[]
  brands?: string[]
  is_short: boolean
}

function fmt(n: number): string {
  if (n == null || isNaN(n)) return '0'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

const THRESHOLDS = [2, 5, 10, 15]

const COLORS = ['#1A73E8', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899']

function BrandPills({ brands }: { brands: string[] }) {
  if (!brands || brands.length === 0) {
    return <span style={{ color: '#CBD5E1', fontSize: 11 }}>—</span>
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
      {brands.map((b, i) => (
        <span key={b} style={{
          fontSize: 10, padding: '2px 7px', borderRadius: 5, fontWeight: 700,
          background: `${COLORS[i % COLORS.length]}15`,
          border: `1px solid ${COLORS[i % COLORS.length]}40`,
          color: COLORS[i % COLORS.length],
        }}>{b}</span>
      ))}
    </div>
  )
}

function KeywordPills({ keywords, max = 5 }: { keywords: string[], max?: number }) {
  const [expanded, setExpanded] = useState(false)
  const show = expanded ? keywords : keywords.slice(0, max)
  const more = keywords.length - max
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, maxWidth: 320, alignItems: 'center' }}>
      {show.map(k => (
        <span key={k} style={{
          fontSize: 9.5, padding: '2px 6px', borderRadius: 4,
          background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#475569', fontWeight: 500,
        }}>{k}</span>
      ))}
      {!expanded && more > 0 && (
        <button
          onClick={() => setExpanded(true)}
          style={{ fontSize: 9, color: '#1A73E8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: '2px 4px', display: 'flex', alignItems: 'center', gap: 2 }}
        >
          +{more} more <ChevronDown size={10} />
        </button>
      )}
      {expanded && (
        <button
          onClick={() => setExpanded(false)}
          style={{ fontSize: 9, color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: '2px 4px', display: 'flex', alignItems: 'center', gap: 2 }}
        >
          Less <ChevronUp size={10} />
        </button>
      )}
    </div>
  )
}

export default function MultiKeywordPage() {
  const { activeCampaignId, fetchCampaigns } = useCampaignStore()
  const [minKeywords, setMinKeywords] = useState(2)

  // Filters State
  const [search, setSearch] = useState('')
  const [selectedBrand, setSelectedBrand] = useState('')
  const [selectedKeyword, setSelectedKeyword] = useState('')
  const [selectedChannel, setSelectedChannel] = useState('')
  const [campaignBrands, setCampaignBrands] = useState<string[]>([])
  const [keywords, setKeywords] = useState<any[]>([])

  const multiQuery = useQuery({
    queryKey: ['multi-keyword', activeCampaignId, minKeywords, selectedBrand, selectedKeyword, search, selectedChannel],
    queryFn: async () => {
      let url = `/api/videos/multi-keyword?campaign_id=${activeCampaignId}&min_keywords=${minKeywords}`
      if (selectedBrand) url += `&brand_name=${encodeURIComponent(selectedBrand)}`
      if (selectedKeyword) url += `&keyword_id=${encodeURIComponent(selectedKeyword)}`
      if (selectedChannel) url += `&channel_name=${encodeURIComponent(selectedChannel)}`
      if (search.trim()) url += `&q=${encodeURIComponent(search.trim())}`

      const res = await fetch(url)
      const d = await res.json()
      return d
    },
    enabled: !!activeCampaignId,
  })

  const data = multiQuery.data?.data ?? []
  const commonTerms = multiQuery.data?.common_terms ?? []
  const channels = multiQuery.data?.channels ?? []

  const fetchBrands = useCallback(async (campId: string) => {
    try {
      const res = await fetch(`/api/brands?campaign_id=${campId}`)
      const d = await res.json()
      if (d.data) {
        setCampaignBrands(d.data.map((b: any) => b.brand_name ?? b.name))
      }
    } catch (e) { console.error(e) }
  }, [])

  const fetchKeywords = useCallback(async (campId: string) => {
    try {
      const res = await fetch(`/api/keywords?campaign_id=${campId}`)
      const d = await res.json()
      if (d.keywords) {
        setKeywords(d.keywords)
      }
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])
  
  useEffect(() => {
    if (activeCampaignId) {
      fetchBrands(activeCampaignId)
      fetchKeywords(activeCampaignId)
    }
  }, [activeCampaignId, fetchBrands, fetchKeywords])

  if (multiQuery.isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 12 }}>
      <Loader2 size={32} style={{ color: '#1A73E8', animation: 'spin 1s linear infinite' }} />
      <div style={{ fontSize: 13.5, color: '#64748B', fontWeight: 600 }}>Loading multi-keyword data…</div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <div className="anim-fade-up">
      <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <div className="page-header">
        <div>
          <h1 className="page-title">Multi-Keyword <span className="accent">Appearances</span></h1>
          <p className="page-subtitle">Videos ranking across many keywords — common phrasing explains broad authority</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>Min Keywords:</label>
          <select className="input" style={{ width: 90, padding: '6px 12px' }} value={minKeywords} onChange={e => setMinKeywords(Number(e.target.value))}>
            {THRESHOLDS.map(n => <option key={n} value={n}>{n}+</option>)}
          </select>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
          <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: 34 }}
            placeholder="Search cross-ranking videos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Brand Dropdown Filter */}
        <div style={{ minWidth: 150 }}>
          <select
            className="input"
            value={selectedBrand}
            onChange={e => setSelectedBrand(e.target.value)}
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
            onChange={e => setSelectedKeyword(e.target.value)}
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
            onChange={e => setSelectedChannel(e.target.value)}
            style={{ cursor: 'pointer', padding: '6px 12px' }}
          >
            <option value="">All Channels</option>
            {channels.map((c: string) => (
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
            }}
            style={{ color: '#EF4444' }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {commonTerms.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, color: '#0F172A' }}>
            <Hash size={14} /> Common Terminology Across Multi-Ranking Videos
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {commonTerms.map((term: string) => (
              <span key={term} className="badge badge-blue" style={{ fontSize: 11 }}>{term}</span>
            ))}
          </div>
        </div>
      )}

      {data.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 280, gap: 14, background: '#FFFFFF', borderRadius: 14, border: '1px solid #F1F5F9' }}>
          <AlertCircle size={36} style={{ color: '#CBD5E1' }} />
          <div style={{ fontSize: 14, fontWeight: 700 }}>No Cross-ranking Videos Found</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>Try lowering the threshold or check your search filters.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 52, textAlign: 'center' }}>Rank</th>
                  <th style={{ minWidth: 280 }}>Video</th>
                  <th>Channel</th>
                  <th>Brand</th>
                  <th style={{ textAlign: 'right' }}>Views</th>
                  <th style={{ textAlign: 'center' }}>Keywords</th>
                  <th style={{ minWidth: 280 }}>Matching Keywords</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {data.map((video: MultiVideo, i: number) => (
                  <tr key={video.youtube_id}>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: i < 3 ? 'rgba(26,115,232,0.1)' : '#F8FAFC',
                        color: i < 3 ? '#1A73E8' : '#64748B',
                        fontWeight: 800, fontSize: 13, margin: '0 auto',
                      }}>
                        #{i + 1}
                      </div>
                    </td>
                    <td style={{ maxWidth: 300 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {/* Thumbnail */}
                        <a
                          href={`https://youtube.com/watch?v=${video.youtube_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ flexShrink: 0, display: 'block', width: 80, height: 46, borderRadius: 6, overflow: 'hidden', background: '#F1F5F9' }}
                        >
                          <img
                            src={video.thumbnail_url || `https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => { (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg` }}
                          />
                        </a>
                        <div style={{ minWidth: 0, flex: 1 }}>
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
                          {video.description && (
                            <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 3, lineHeight: 1.3,
                              display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                            } as React.CSSProperties}>
                              {video.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12, fontWeight: 500, color: '#334155' }}>
                      {video.channel_name}
                    </td>
                    <td style={{ minWidth: 120 }}>
                      <BrandPills brands={video.brands ?? []} />
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums' } as React.CSSProperties}>
                      {fmt(video.view_count)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        minWidth: 32, height: 26, borderRadius: 7, fontWeight: 800, fontSize: 13,
                        background: 'rgba(26,115,232,0.08)', color: '#1A73E8',
                      }}>
                        {video.keyword_count}
                      </span>
                    </td>
                    <td>
                      <KeywordPills keywords={video.keywords_appeared} max={5} />
                    </td>
                    <td>
                      <span className={`badge ${video.is_short ? 'badge-purple' : 'badge-blue'}`}>
                        {video.is_short ? 'Shorts' : 'Long-Form'}
                      </span>
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
