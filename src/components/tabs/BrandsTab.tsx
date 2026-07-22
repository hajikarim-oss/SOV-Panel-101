'use client'

import { useState, useMemo } from 'react'
import {
  BarChart, Bar, Cell, PieChart, Pie, Tooltip as RechartsTooltip, ResponsiveContainer, XAxis, YAxis, CartesianGrid,
  ScatterChart, Scatter, ZAxis
} from 'recharts'
import { motion } from 'framer-motion'
import { Award, Star, Info } from 'lucide-react'
import { useDashboard } from '@/lib/dashboard-context'

const C = [
  '#4C78A8', '#54A24B', '#E45756', '#72B7B2', '#EECA3B',
  '#B279A2', '#FF9DA6', '#9D755D', '#BAB0AC', '#D67195',
  '#F58518', '#4C78A8', '#54A24B', '#E45756', '#72B7B2',
  '#79B8FF', '#A8D8B9', '#F4A582', '#CAB2D6', '#FFFFB3',
]

function brandColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  return C[Math.abs(hash) % C.length]
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toLocaleString()
}

function pct(a: number, b: number) {
  if (!b) return 0
  return Math.round((a / b) * 1000) / 10
}

function Bar100({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 4, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden', minWidth: 60 }}>
      <div style={{ height: '100%', width: `${Math.min(100, value)}%`, background: color, borderRadius: 99 }} />
    </div>
  )
}

function Card({ title, sub, height = 240, children, right, info }: {
  title: string; sub?: string; height?: number; children: React.ReactNode; right?: React.ReactNode; info?: string
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', border: '1px solid #F1F5F9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
            {info && <span title={info} style={{ cursor: 'help', color: '#CBD5E1', flexShrink: 0 }}><Info size={11} /></span>}
          </div>
          {sub && <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>{sub}</div>}
        </div>
        {right && <div style={{ marginLeft: 8, flexShrink: 0 }}>{right}</div>}
      </div>
      <div style={{ height }}>{children}</div>
    </div>
  )
}

export default function BrandsTab() {
  const { videos, setDrawerType, downloadCSV, distinctLanguages } = useDashboard()
  const [brandSOVLang, setBrandSOVLang] = useState<string>('all')
  const [brandSOVFormat, setBrandSOVFormat] = useState<'all' | 'long' | 'short'>('all')

  const videoLanguagesMap = useMemo(() => {
    const map = new Map<string, string[]>()
    videos.forEach((v: any) => {
      const langs = new Set<string>()
      ;(v.keywords_appeared || []).forEach((kwText: string) => {
        const kw = (v.keywords || []).find((k: any) => k.text === kwText)
        if (kw?.language) langs.add(kw.language)
      })
      map.set(v.id, Array.from(langs))
    })
    return map
  }, [videos])

  const analytics = useMemo(() => {
    let filteredBrandVideos = videos
    if (brandSOVFormat !== 'all') {
      filteredBrandVideos = brandSOVFormat === 'long'
        ? videos.filter((v: any) => !v.is_short)
        : videos.filter((v: any) => v.is_short)
    }
    if (brandSOVLang !== 'all') {
      filteredBrandVideos = filteredBrandVideos.filter((v: any) => {
        const langs = videoLanguagesMap.get(v.id) || []
        return langs.includes(brandSOVLang)
      })
    }

    const brandMap = new Map<string, { views: number; freq: number; videoCount: number }>()
    filteredBrandVideos.forEach((v: any) => {
      const brandList = v.tags || v.brands || []
      brandList.forEach((b: string) => {
        if (!brandMap.has(b)) brandMap.set(b, { views: 0, freq: 0, videoCount: 0 })
        const m = brandMap.get(b)!
        m.views += v.view_count || 0
        m.freq += v.keyword_count || 1
        m.videoCount++
      })
    })

    const totalViewsFiltered = Array.from(brandMap.values()).reduce((sum, item) => sum + item.views, 0) || 1
    const totalFreqFiltered = Array.from(brandMap.values()).reduce((sum, item) => sum + item.freq, 0) || 1

    const topViews = Array.from(brandMap.entries()).map(([name, item]) => ({
      name, value: item.views, pct: pct(item.views, totalViewsFiltered), videoCount: item.videoCount, color: brandColor(name)
    })).sort((a, b) => b.value - a.value)

    const topFreq = Array.from(brandMap.entries()).map(([name, item]) => ({
      name, value: item.freq, pct: pct(item.freq, totalFreqFiltered), videoCount: item.videoCount, color: brandColor(name)
    })).sort((a, b) => b.value - a.value)

    const brandBar = topViews.slice(0, 5).map((b) => ({
      name: b.name.slice(0, 10), Views: b.value, Freq: topFreq.find((x: any) => x.name === b.name)?.value ?? 0, fill: b.color,
    }))

    const brandPositioning = topViews.slice(0, 6).map((b) => {
      const f = topFreq.find((x: any) => x.name === b.name)
      return { name: b.name, viewSOV: b.pct, freqSOV: f?.pct ?? 0, z: b.videoCount * 50 + 300, color: b.color }
    })

    const brandEfficiency = topViews.slice(0, 6).map((b) => {
      const f = topFreq.find((x: any) => x.name === b.name)
      const count = f?.value ?? 1
      return { name: b.name.slice(0, 10), efficiency: Math.round(b.value / count), color: b.color }
    }).sort((a, b) => b.efficiency - a.efficiency)

    return { topViews, topFreq, brandBar, brandPositioning, brandEfficiency }
  }, [videos, brandSOVLang, brandSOVFormat, videoLanguagesMap])

  const { topViews, topFreq, brandBar, brandPositioning, brandEfficiency } = analytics

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      {/* Leader banners */}
      {topViews.length >= 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', borderRadius: 10, padding: '14px 18px', border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Award size={15} style={{ color: '#FFF' }} /></div>
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.4px' }}>View SOV Leader</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#064E3B' }}>{topViews[0]?.name}</div>
              <div style={{ fontSize: 11, color: '#10B981', fontWeight: 600 }}>{topViews[0]?.pct?.toFixed(1)}% of views · {topViews[0]?.videoCount} videos</div>
            </div>
          </div>
          <div style={{ background: 'linear-gradient(135deg,#EFF6FF,#DBEAFE)', borderRadius: 10, padding: '14px 18px', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Star size={15} style={{ color: '#FFF' }} /></div>
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Frequency SOV Leader</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#1E3A8A' }}>{topFreq[0]?.name}</div>
              <div style={{ fontSize: 11, color: '#3B82F6', fontWeight: 600 }}>{topFreq[0]?.pct?.toFixed(1)}% keyword frequency · {topFreq[0]?.value} appearances</div>
            </div>
          </div>
        </div>
      )}

      {/* Brand SOV widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        <Card
          title="View share of voice"
          sub="Percent share of captured views per brand"
          height={210}
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select className="select-filter" value={brandSOVFormat} onChange={(e) => setBrandSOVFormat(e.target.value as any)}>
                <option value="all">All formats</option>
                <option value="long">Long-form</option>
                <option value="short">Shorts</option>
              </select>
              <select className="select-filter" value={brandSOVLang} onChange={(e) => setBrandSOVLang(e.target.value)}>
                <option value="all">All languages</option>
                {distinctLanguages.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
              </select>
              <button onClick={() => setDrawerType('brand_sov_detail')} style={{ background: '#F1F5F9', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#1E293B' }}>View more</button>
            </div>
          }
        >
          <div style={{ display: 'flex', alignItems: 'center', height: '100%', gap: 16 }}>
            <div style={{ width: 140, height: 140, flexShrink: 0, position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={topViews} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={64} paddingAngle={2}>
                    {topViews.map((d: any, i: number) => <Cell key={i} fill={d.color} stroke="transparent" />)}
                  </Pie>
                  <RechartsTooltip formatter={(v: any) => [fmt(v) + ' views', 'Views']} contentStyle={{ background: '#0F172A', border: 'none', borderRadius: 8, fontSize: 11 }} itemStyle={{ color: '#FFF' }} labelStyle={{ color: '#94A3B8' }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>{topViews[0]?.pct?.toFixed(0)}%</div>
                <div style={{ fontSize: 8, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Top SOV</div>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, overflowY: 'auto', maxHeight: 150 }}>
              {topViews.slice(0, 5).map((d: any) => (
                <div key={d.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', maxWidth: 85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: d.color }}>{d.pct.toFixed(1)}%</span>
                  </div>
                  <Bar100 value={d.pct} color={d.color} />
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card
          title="Keyword frequency SOV"
          sub="Brand presence share in top-ranked keywords"
          height={210}
          right={
            <button onClick={() => setDrawerType('brand_sov_detail')} style={{ background: '#F1F5F9', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#1E293B' }}>View more</button>
          }
        >
          <div style={{ display: 'flex', alignItems: 'center', height: '100%', gap: 16 }}>
            <div style={{ width: 140, height: 140, flexShrink: 0, position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={topFreq} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={64} paddingAngle={2}>
                    {topFreq.map((d: any, i: number) => <Cell key={i} fill={d.color} stroke="transparent" />)}
                  </Pie>
                  <RechartsTooltip formatter={(v: any) => [v + ' appearances', 'Freq']} contentStyle={{ background: '#0F172A', border: 'none', borderRadius: 8, fontSize: 11 }} itemStyle={{ color: '#FFF' }} labelStyle={{ color: '#94A3B8' }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>{topFreq[0]?.pct?.toFixed(0)}%</div>
                <div style={{ fontSize: 8, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Top Freq</div>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, overflowY: 'auto', maxHeight: 150 }}>
              {topFreq.slice(0, 5).map((d: any) => (
                <div key={d.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', maxWidth: 85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: d.color }}>{d.pct.toFixed(1)}%</span>
                  </div>
                  <Bar100 value={d.pct} color={d.color} />
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Positioning Map & Efficiency */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card
          title="Brand positioning map"
          sub="View SOV (X) vs keyword frequency SOV (Y) - bubble size = video count"
          height={240}
          info="Brands in the top-right quadrant dominate both view share and search frequency."
        >
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis type="number" dataKey="viewSOV" name="View SOV %" tick={{ fontSize: 9.5, fill: '#94A3B8' }} axisLine={false} tickLine={false}
                label={{ value: 'View SOV %', position: 'insideBottom', offset: -14, fontSize: 10, fill: '#94A3B8', fontWeight: 600 }} />
              <YAxis type="number" dataKey="freqSOV" name="Freq SOV %" tick={{ fontSize: 9.5, fill: '#94A3B8' }} axisLine={false} tickLine={false}
                label={{ value: 'Freq SOV %', angle: -90, position: 'insideLeft', offset: 18, fontSize: 10, fill: '#94A3B8', fontWeight: 600 }} />
              <ZAxis type="number" dataKey="z" range={[60, 320]} />
              <RechartsTooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload
                  if (!d) return null
                  return (
                    <div style={{ background: '#0F172A', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', minWidth: 140 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#FFF', marginBottom: 4 }}>{d.name}</div>
                      <div style={{ fontSize: 10.5, color: '#94A3B8' }}>View SOV: <strong style={{ color: '#38BDF8' }}>{d.viewSOV?.toFixed(1)}%</strong></div>
                      <div style={{ fontSize: 10.5, color: '#94A3B8' }}>Freq SOV: <strong style={{ color: '#34D399' }}>{d.freqSOV?.toFixed(1)}%</strong></div>
                      <div style={{ fontSize: 10.5, color: '#94A3B8' }}>Videos: <strong style={{ color: '#FFF' }}>{Math.round((d.z - 300) / 50)}</strong></div>
                    </div>
                  )
                }}
              />
              {brandPositioning.map((d: any, i: number) => <Scatter key={i} name={d.name} data={[d]} fill={d.color} fillOpacity={0.8} />)}
            </ScatterChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {brandPositioning.map((d: any, i: number) => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: d.color }} />
                <span style={{ fontSize: 10, color: '#475569', fontWeight: 600 }}>{d.name}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Brand efficiency score"
          sub="Views earned per keyword ranking appearance"
          height={240}
          info="Efficiency = Total Views / Keyword Appearances."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={brandEfficiency} layout="vertical" margin={{ top: 4, right: 60, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 9.5, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={(v: any) => fmt(v)} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} width={75} />
              <RechartsTooltip
                content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div style={{ background: '#0F172A', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#FFF', marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 10.5, color: '#94A3B8' }}>Views/appearance: <strong style={{ color: '#38BDF8' }}>{fmt(payload[0]?.value)}</strong></div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="efficiency" radius={[0, 4, 4, 0]} label={{ position: 'right', formatter: (v: any) => fmt(v), fontSize: 10, fill: '#64748B', fontWeight: 700 }}>
                {brandEfficiency.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </motion.div>
  )
}
