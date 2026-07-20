'use client'

import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useCampaignStore } from '@/lib/store'
import { ChevronLeft, Loader2, AlertCircle, Eye, Video, TrendingUp, HelpCircle } from 'lucide-react'
import Link from 'next/link'

interface Params {
  brandName: string
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '0'
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toLocaleString()
}

export default function BrandDetailPage({ params }: { params: Promise<Params> }) {
  const { brandName } = use(params)
  const decodedBrandName = decodeURIComponent(brandName)
  const { activeCampaignId } = useCampaignStore()
  const brandQuery = useQuery({
    queryKey: ['brand-detail', activeCampaignId, decodedBrandName],
    queryFn: async () => {
      const res = await fetch(`/api/brands/${encodeURIComponent(decodedBrandName)}?campaign_id=${activeCampaignId}`)
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      return d
    },
    enabled: !!activeCampaignId,
  })

  const data = brandQuery.data as any
  const loading = brandQuery.isLoading
  const error = brandQuery.error?.message as string | null

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 12 }}>
        <Loader2 size={32} style={{ color: '#1A73E8', animation: 'spin 1s linear infinite' }} />
        <div style={{ fontSize: 13.5, color: '#64748B', fontWeight: 600 }}>Loading brand insights…</div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ display: 'flex', gap: 12, padding: 28, borderRadius: 14, background: '#FFFFFF', border: '1px solid #F1F5F9', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <AlertCircle size={32} style={{ color: '#EF4444', marginBottom: 8 }} />
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>Failed to Load Brand Profile</div>
        <div style={{ fontSize: 12, color: '#64748B' }}>{error || 'Make sure active campaign has tagged videos for this brand.'}</div>
        <Link href="/brands" className="btn btn-ghost btn-sm" style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
          <ChevronLeft size={14} /> Back to Brands List
        </Link>
      </div>
    )
  }

  const { metrics, topVideos, topKeywords, langBreakdown } = data
  const colors = ['#1A73E8', '#10B981', '#F59E0B', '#8B5CF6']

  const langChartData = langBreakdown.map((l: any, i: number) => ({
    name: l.language === 'en' ? 'English' : l.language === 'ta' ? 'Tamil' : l.language === 'te' ? 'Telugu' : l.language === 'ml' ? 'Malayalam' : l.language,
    count: l.video_count,
    fill: colors[i % colors.length]
  }))

  return (
    <div className="anim-fade-up">
      <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {/* Header breadcrumb */}
      <div style={{ marginBottom: 16 }}>
        <Link href="/brands" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 600, color: '#64748B', textDecoration: 'none' }}>
          <ChevronLeft size={14} /> Brands Overview
        </Link>
      </div>

      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Brand Profile: <span className="accent">{decodedBrandName}</span></h1>
          <p className="page-subtitle">Deep dive performance statistics and content footprint.</p>
        </div>
      </div>

      {/* Grid statistics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: 12, border: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94A3B8', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Total Appearances</span>
            <Video size={16} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A' }}>{metrics.total_videos}</div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Across all tracked keywords</div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: 12, border: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94A3B8', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Unique Videos</span>
            <Video size={16} style={{ color: '#10B981' }} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A' }}>{metrics.unique_videos}</div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Distinct YouTube assets</div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: 12, border: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94A3B8', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Unique Viewership</span>
            <Eye size={16} style={{ color: '#1A73E8' }} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A' }}>{fmt(metrics.unique_views)}</div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Aggregated unique views</div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: 12, border: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94A3B8', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>7d View Growth</span>
            <TrendingUp size={16} style={{ color: metrics.growth_7d >= 0 ? '#10B981' : '#EF4444' }} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: metrics.growth_7d >= 0 ? '#10B981' : '#EF4444' }}>
            {metrics.growth_7d >= 0 ? '+' : ''}{metrics.growth_7d}%
          </div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Growth vs previous week</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24, alignItems: 'start' }}>
        {/* Left: Top Keywords */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Top Keywords Ranks</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Keyword</th>
                  <th style={{ textAlign: 'center' }}>Best Rank</th>
                  <th style={{ textAlign: 'right' }}>Videos Count</th>
                </tr>
              </thead>
              <tbody>
                {topKeywords.map((k: any) => (
                  <tr key={k.keyword}>
                    <td style={{ fontWeight: 600, fontSize: 12.5 }}>{k.keyword}</td>
                    <td style={{ textAlign: 'center', color: '#1A73E8', fontWeight: 700 }}>#{k.best_rank}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{k.brand_videos_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Language distribution */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Language Distribution</div>
          {langChartData.length === 0 ? (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#94A3B8' }}>No language data found</div>
          ) : (
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={langChartData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                  <XAxis type="number" axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {langChartData.map((d: any, idx: number) => (
                      <Cell key={idx} fill={d.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Videos Section */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Top Videos for {decodedBrandName}</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Video Title</th>
                <th>Channel</th>
                <th style={{ textAlign: 'right' }}>Views</th>
                <th style={{ textAlign: 'center' }}>Best Rank</th>
                <th style={{ textAlign: 'center' }}>Keywords</th>
              </tr>
            </thead>
            <tbody>
              {topVideos.map((v: any) => (
                <tr key={v.youtube_id}>
                  <td>
                    <a href={`https://youtube.com/watch?v=${v.youtube_id}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: '#1E293B', fontWeight: 600, fontSize: 12.5 }}>
                      {v.title}
                    </a>
                  </td>
                  <td style={{ fontSize: 12 }}>{v.channel_name}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(v.view_count)}</td>
                  <td style={{ textAlign: 'center', color: '#1A73E8', fontWeight: 700 }}>#{v.best_rank}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{v.keywords_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
