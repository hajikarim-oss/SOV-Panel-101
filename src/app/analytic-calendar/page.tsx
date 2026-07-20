'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  ChevronLeft, ChevronRight, Eye, Video, Hash, TrendingUp, TrendingDown,
  Zap, BarChart2, Download, AlertCircle, Loader2, Calendar, ArrowUpRight,
  ArrowDownRight, Minus, X
} from 'lucide-react'
import { useCampaignStore } from '@/lib/store'
import { useQuery } from '@tanstack/react-query'
import { PageSkeleton } from '@/components/PageSkeleton'
import Link from 'next/link'

const BRAND_COLORS = [
  '#4C78A8', '#54A24B', '#E45756', '#72B7B2', '#EECA3B',
  '#B279A2', '#FF9DA6', '#9D755D', '#BAB0AC', '#D67195',
]

function brandColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  return BRAND_COLORS[Math.abs(hash) % BRAND_COLORS.length]
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toLocaleString()
}

function fmtFull(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '0'
  return n.toLocaleString('en-IN')
}

function fmtIndian(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  if (n >= 1e7) return (n / 1e7).toFixed(1) + ' Cr'
  if (n >= 1e5) return (n / 1e5).toFixed(1) + ' Lakh'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + ' K'
  return n.toLocaleString('en-IN')
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

interface DayData {
  date: string
  views: number
  newVideos: number
  keywordsAdded: number
  scrapeJobs: number
  scrapeResults: number
  rankings: Array<{
    keyword: string
    brand: string
    oldRank: number
    newRank: number
    movement: number
    videoTitle: string
    channel: string
    viewCount: number
  }>
  topBrands: Array<{ brand: string; views: number; sov: number }>
}

export default function AnalyticCalendarPage() {
  const { campaigns, activeCampaignId, fetchCampaigns } = useCampaignStore()
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  const calendarQuery = useQuery({
    queryKey: ['analytic-calendar', activeCampaignId, currentMonth],
    queryFn: async () => {
      const res = await fetch(`/api/analytic-calendar?campaign_id=${activeCampaignId}&month=${currentMonth}`)
      if (!res.ok) throw new Error('Failed to fetch calendar data')
      return res.json()
    },
    enabled: !!activeCampaignId,
  })

  const days = calendarQuery.data?.days ?? []
  const summary = calendarQuery.data?.summary ?? null
  const monthLabel = calendarQuery.data?.monthLabel ?? ''

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])

  const navigateMonth = (dir: number) => {
    const [y, m] = currentMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + dir, 1)
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    setCurrentMonth(newMonth)
    setSelectedDay(null)
    setShowDetail(false)
  }

  const calendarGrid = useMemo(() => {
    if (!days.length) return []
    const [y, m] = currentMonth.split('-').map(Number)
    const firstDay = new Date(y, m - 1, 1).getDay()
    const daysInMonth = new Date(y, m, 0).getDate()
    const grid: (DayData | null)[] = []
    for (let i = 0; i < firstDay; i++) grid.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const dayData = days.find(day => day.date === dateStr)
      grid.push(dayData || { date: dateStr, views: 0, newVideos: 0, keywordsAdded: 0, scrapeJobs: 0, scrapeResults: 0, rankings: [], topBrands: [] })
    }
    return grid
  }, [days, currentMonth])

  const maxViewsDay = useMemo(() => {
    if (!days.length) return 0
    return Math.max(...days.map(d => d.views))
  }, [days])

  const today = new Date().toISOString().split('T')[0]

  if (!activeCampaignId && !calendarQuery.isLoading) {
    return (
      <div className="anim-fade-up">
        <div className="page-header">
          <div>
            <h1 className="page-title">Analytics <span className="accent">Calendar</span></h1>
            <p className="page-subtitle">Historical data explorer with daily rankings and metrics</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, background: '#fff', borderRadius: 14, border: '1px solid #F1F5F9' }}>
          <AlertCircle size={36} style={{ color: '#CBD5E1' }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1E293B' }}>Select a Campaign</div>
          <div style={{ fontSize: 13, color: '#64748B' }}>Choose a campaign to view the analytics calendar</div>
        </div>
      </div>
    )
  }

  return (
    <div className="anim-fade-up">
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .cal-day { transition: all 0.15s ease; cursor: pointer; }
        .cal-day:hover { border-color: #1A73E8 !important; box-shadow: 0 2px 12px rgba(26,115,232,0.1); transform: translateY(-1px); }
        .cal-day.today { border-color: #1A73E8 !important; background: rgba(26,115,232,0.03) !important; }
        .cal-day.selected { border-color: #1A73E8 !important; background: rgba(26,115,232,0.06) !important; box-shadow: 0 0 0 2px rgba(26,115,232,0.15); }
        .cal-day.empty { background: transparent; border-color: transparent; cursor: default; }
        .cal-day.empty:hover { transform: none; box-shadow: none; }
        .detail-panel { animation: slideIn 0.25s ease; }
        .rank-mover { transition: all 0.15s ease; }
        .rank-mover:hover { background: rgba(26,115,232,0.03); }
        .sov-bar-bg { background: #F1F5F9; border-radius: 3px; height: 5px; overflow: hidden; }
        .sov-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s ease; }
      `}</style>

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics <span className="accent">Calendar</span></h1>
          <p className="page-subtitle">Historical data explorer with daily rankings and metrics</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => {
            const csv = days.map(d => `${d.date},${d.views},${d.newVideos},${d.keywordsAdded},${d.scrapeJobs}`).join('\n')
            const header = 'Date,Views,New Videos,Keywords Added,Scrape Jobs\n'
            const blob = new Blob([header + csv], { type: 'text/csv' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a'); a.href = url; a.download = `calendar_${currentMonth}.csv`; a.click()
          }}><Download size={13} /> Export</button>
        </div>
      </div>

      {/* Month Navigation + KPIs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigateMonth(-1)} style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid rgba(26,115,232,0.12)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
            <ChevronLeft size={16} style={{ color: '#475569' }} />
          </button>
          <div style={{ minWidth: 180, textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#0F172A' }}>{monthLabel || 'Loading...'}</div>
          </div>
          <button onClick={() => navigateMonth(1)} style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid rgba(26,115,232,0.12)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
            <ChevronRight size={16} style={{ color: '#475569' }} />
          </button>
          <button className="btn btn-ghost btn-xs" onClick={() => {
            const now = new Date()
            setCurrentMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
          }} style={{ marginLeft: 4 }}>Today</button>
        </div>

        {/* Summary KPIs */}
        {summary && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'Total Views', value: fmtIndian(summary.totalViews), icon: Eye, color: '#4C78A8', sub: summary.viewsGrowth !== 0 ? `${summary.viewsGrowth > 0 ? '+' : ''}${summary.viewsGrowth}% vs prev` : null },
              { label: 'New Videos', value: fmtFull(summary.totalVideos), icon: Video, color: '#54A24B', sub: null },
              { label: 'Avg Daily Views', value: fmtIndian(summary.avgDailyViews), icon: BarChart2, color: '#E45756', sub: null },
              { label: 'Rank Changes', value: fmtFull(summary.totalRankingChanges), icon: TrendingUp, color: '#72B7B2', sub: null },
            ].map((kpi) => (
              <div key={kpi.label} style={{ background: '#fff', borderRadius: 12, padding: '10px 16px', border: '1px solid #F1F5F9', display: 'flex', gap: 10, alignItems: 'center', minWidth: 150 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${kpi.color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <kpi.icon size={14} style={{ color: kpi.color }} />
                </div>
                <div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{kpi.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.2 }}>{kpi.value}</div>
                  {kpi.sub && <div style={{ fontSize: 10, color: summary.viewsGrowth > 0 ? '#059669' : '#DC2626', fontWeight: 600 }}>{kpi.sub}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Calendar Grid */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card" style={{ padding: '16px 18px', overflow: 'hidden' }}>
            {/* Weekday Headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
              {WEEKDAYS.map(day => (
                <div key={day} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '6px 0' }}>
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {calendarQuery.isLoading ? (
                Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} style={{ height: 100, borderRadius: 10, background: '#F8FAFC', border: '1px solid #F1F5F9', animation: 'fadeIn 0.3s ease', animationDelay: `${i * 20}ms` }} />
                ))
              ) : (
                calendarGrid.map((day, i) => {
                  if (!day) return <div key={`empty-${i}`} className="cal-day empty" style={{ height: 100 }} />
                  const dateNum = parseInt(day.date.split('-')[2])
                  const isToday = day.date === today
                  const isSelected = selectedDay?.date === day.date
                  const hasData = day.views > 0 || day.newVideos > 0
                  const viewIntensity = maxViewsDay > 0 ? day.views / maxViewsDay : 0

                  return (
                    <div
                      key={day.date}
                      className={`cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                      onClick={() => { setSelectedDay(day); setShowDetail(true) }}
                      style={{
                        height: 100,
                        borderRadius: 10,
                        border: '1px solid #F1F5F9',
                        background: hasData ? `rgba(76,120,168,${0.02 + viewIntensity * 0.06})` : '#FAFBFC',
                        padding: '6px 8px',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Date Number */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{
                          fontSize: 12,
                          fontWeight: isToday ? 800 : 600,
                          color: isToday ? '#fff' : '#475569',
                          background: isToday ? '#1A73E8' : 'transparent',
                          width: isToday ? 22 : 'auto',
                          height: isToday ? 22 : 'auto',
                          borderRadius: isToday ? 6 : 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          {dateNum}
                        </span>
                        {day.scrapeJobs > 0 && (
                          <Zap size={10} style={{ color: '#F59E0B' }} />
                        )}
                      </div>

                      {/* Data Indicators */}
                      {hasData && (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, justifyContent: 'flex-end' }}>
                          {day.views > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              <Eye size={8} style={{ color: '#94A3B8', flexShrink: 0 }} />
                              <span style={{ fontSize: 9, color: '#64748B', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(day.views)}</span>
                            </div>
                          )}
                          {day.newVideos > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              <Video size={8} style={{ color: '#54A24B', flexShrink: 0 }} />
                              <span style={{ fontSize: 9, color: '#54A24B', fontWeight: 600 }}>{day.newVideos} new</span>
                            </div>
                          )}
                          {day.rankings.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              <TrendingUp size={8} style={{ color: '#72B7B2', flexShrink: 0 }} />
                              <span style={{ fontSize: 9, color: '#72B7B2', fontWeight: 600 }}>{day.rankings.length} moves</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Top Brand Dot */}
                      {day.topBrands.length > 0 && (
                        <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                          {day.topBrands.slice(0, 3).map((b, bi) => (
                            <div key={bi} style={{ width: 4, height: 4, borderRadius: '50%', background: brandColor(b.brand) }} title={b.brand} />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingLeft: 4, flexWrap: 'wrap' }}>
            {[
              { icon: Eye, color: '#94A3B8', label: 'Views' },
              { icon: Video, color: '#54A24B', label: 'New Videos' },
              { icon: TrendingUp, color: '#72B7B2', label: 'Rank Changes' },
              { icon: Zap, color: '#F59E0B', label: 'Scrape Jobs' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <l.icon size={10} style={{ color: l.color }} />
                <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Day Detail Panel */}
        {showDetail && selectedDay && (
          <div className="detail-panel" style={{ width: 380, flexShrink: 0 }}>
            <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'sticky', top: 20 }}>
              {/* Panel Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                    {new Date(selectedDay.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{selectedDay.date}</div>
                </div>
                <button onClick={() => setShowDetail(false)} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <X size={14} style={{ color: '#64748B' }} />
                </button>
              </div>

              {/* Day Metrics */}
              <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Views', value: fmtIndian(selectedDay.views), color: '#4C78A8', icon: Eye },
                  { label: 'New Videos', value: String(selectedDay.newVideos), color: '#54A24B', icon: Video },
                  { label: 'Keywords Added', value: String(selectedDay.keywordsAdded), color: '#B279A2', icon: Hash },
                  { label: 'Scrape Jobs', value: String(selectedDay.scrapeJobs), color: '#F59E0B', icon: Zap },
                ].map(m => (
                  <div key={m.label} style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                      <m.icon size={11} style={{ color: m.color }} />
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{m.label}</span>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', fontFamily: "'JetBrains Mono', monospace" }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Brand SOV */}
              {selectedDay.topBrands.length > 0 && (
                <div style={{ padding: '0 20px 16px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Brand SOV</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedDay.topBrands.map((b, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: brandColor(b.brand), flexShrink: 0 }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#475569', minWidth: 70, flexShrink: 0 }}>{b.brand.length > 10 ? b.brand.slice(0, 10) + '…' : b.brand}</span>
                        <div className="sov-bar-bg" style={{ flex: 1 }}>
                          <div className="sov-bar-fill" style={{ width: `${b.sov}%`, background: brandColor(b.brand) }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', minWidth: 35, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{b.sov}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ranking Changes */}
              {selectedDay.rankings.length > 0 && (
                <div style={{ padding: '0 20px 20px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Ranking Changes</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto' }}>
                    {selectedDay.rankings.map((r, i) => (
                      <div key={i} className="rank-mover" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: '#FAFBFC', border: '1px solid #F1F5F9' }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: 6,
                          background: r.movement > 0 ? '#ECFDF5' : r.movement < 0 ? '#FEF2F2' : '#F1F5F9',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          {r.movement > 0
                            ? <ArrowUpRight size={12} style={{ color: '#059669' }} />
                            : r.movement < 0
                              ? <ArrowDownRight size={12} style={{ color: '#DC2626' }} />
                              : <Minus size={12} style={{ color: '#94A3B8' }} />
                          }
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.keyword}</div>
                          <div style={{ fontSize: 9.5, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.channel}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', fontFamily: "'JetBrains Mono', monospace" }}>
                            #{r.oldRank} → #{r.newRank}
                          </div>
                          <div style={{ fontSize: 9, color: r.movement > 0 ? '#059669' : '#DC2626', fontWeight: 600 }}>
                            {r.movement > 0 ? `↑${r.movement}` : `↓${Math.abs(r.movement)}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {selectedDay.views === 0 && selectedDay.newVideos === 0 && selectedDay.rankings.length === 0 && (
                <div style={{ padding: '24px 20px', textAlign: 'center' }}>
                  <Calendar size={28} style={{ color: '#CBD5E1', marginBottom: 8 }} />
                  <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>No data recorded for this day</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
