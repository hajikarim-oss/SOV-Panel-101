'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, Plus, Trash2, Loader2, Globe, Clock, ArrowUpDown } from 'lucide-react'
import { useCampaignStore } from '@/lib/store'
import { getClientCache, setClientCache } from '@/lib/cache'

function fmtRelative(iso: string | null): string {
  if (!iso) return 'Never'
  const d = new Date(iso.includes('T') ? iso : iso + 'Z')
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

const LANG_LABELS: Record<string, string> = {
  en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu', ml: 'Malayalam',
  kn: 'Kannada', bn: 'Bengali', mr: 'Marathi', es: 'Spanish', pt: 'Portuguese',
  fr: 'French', de: 'German', ja: 'Japanese',
}

const TYPE_COLORS: Record<string, string> = {
  generic: 'var(--blue)', branded: 'var(--red)', comparison: 'var(--orange)',
}

type SortKey = 'name' | 'videos' | 'last_scraped' | 'status'

export default function KeywordsTab() {
  const { activeCampaignId } = useCampaignStore()
  const [keywords, setKeywords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [bulkKw, setBulkKw] = useState('')
  const [kwLang, setKwLang] = useState('en')
  const [kwType, setKwType] = useState<'generic' | 'branded' | 'comparison'>('generic')
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterLang, setFilterLang] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const fetchKeywords = useCallback(async (campId: string) => {
    if (!campId) return
    const ck = `kw-tab-v3:${campId}`
    const cached = getClientCache<any>(ck)
    if (cached) { setKeywords(cached.keywords ?? []); setLoading(false); return }
    setLoading(true)
    try { const res = await fetch(`/api/keywords?campaign_id=${campId}`); const d = await res.json(); setKeywords(d.keywords ?? []); setClientCache(ck, d) }
    catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { if (activeCampaignId) fetchKeywords(activeCampaignId) }, [activeCampaignId, fetchKeywords])

  const addKeywords = async () => {
    if (!activeCampaignId || !bulkKw.trim()) return
    setAdding(true)
    try {
      const items = bulkKw.split('\n').map(l => l.trim()).filter(Boolean).map(text => ({ text, language: kwLang, type: kwType }))
      await fetch('/api/keywords', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaign_id: activeCampaignId, keywords: items }) })
      setBulkKw(''); setShowAdd(false); fetchKeywords(activeCampaignId)
    } catch { /* ignore */ } finally { setAdding(false) }
  }

  const deleteKeyword = async (id: string) => {
    if (!confirm('Delete this keyword?')) return
    try { await fetch('/api/keywords', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); if (activeCampaignId) fetchKeywords(activeCampaignId) } catch { /* ignore */ }
  }

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active'
    try { await fetch('/api/keywords', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: newStatus }) }); if (activeCampaignId) fetchKeywords(activeCampaignId) } catch { /* ignore */ }
  }

  const bulkDelete = async () => {
    if (selected.size === 0 || !confirm(`Delete ${selected.size} keyword(s)?`)) return
    setBulkDeleting(true)
    try { for (const id of selected) await fetch('/api/keywords', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); setSelected(new Set()); if (activeCampaignId) fetchKeywords(activeCampaignId) } catch { /* ignore */ } finally { setBulkDeleting(false) }
  }

  const bulkToggleStatus = async (newStatus: 'active' | 'paused') => {
    if (selected.size === 0) return
    try { for (const id of selected) await fetch('/api/keywords', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: newStatus }) }); setSelected(new Set()); if (activeCampaignId) fetchKeywords(activeCampaignId) } catch { /* ignore */ }
  }

  const filtered = useMemo(() => {
    let result = keywords.filter(kw => {
      if (search && !kw.text.toLowerCase().includes(search.toLowerCase())) return false
      if (filterType !== 'all' && kw.category !== filterType) return false
      if (filterLang !== 'all' && kw.language !== filterLang) return false
      return true
    })
    result.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'name': cmp = a.text.localeCompare(b.text); break
        case 'videos': cmp = ((b.long_form_count || 0) + (b.short_form_count || 0)) - ((a.long_form_count || 0) + (a.short_form_count || 0)); break
        case 'last_scraped': cmp = new Date(b.last_scraped || 0).getTime() - new Date(a.last_scraped || 0).getTime(); break
        case 'status': cmp = (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1); break
      }
      return sortAsc ? cmp : -cmp
    })
    return result
  }, [keywords, search, filterType, filterLang, sortKey, sortAsc])

  const distinctLangs = useMemo(() => [...new Set(keywords.map(k => k.language).filter(Boolean))].sort(), [keywords])
  const stats = useMemo(() => ({
    total: keywords.length, active: keywords.filter(k => k.status === 'active').length,
    paused: keywords.filter(k => k.status === 'paused').length,
    totalVideos: keywords.reduce((s, k) => s + (k.long_form_count || 0) + (k.short_form_count || 0), 0),
  }), [keywords])

  const handleSort = (key: SortKey) => { if (sortKey === key) setSortAsc(v => !v); else { setSortKey(key); setSortAsc(true) } }
  const SortIcon = ({ col }: { col: SortKey }) => <ArrowUpDown size={10} style={{ color: sortKey === col ? 'var(--blue)' : 'var(--text-muted)', marginLeft: 3 }} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
          Keywords <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({stats.total} · {stats.active} active · {stats.totalVideos.toLocaleString()} videos)</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {selected.size > 0 && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 10px', borderRadius: 7, background: 'var(--blue-dim)', border: '1px solid var(--border-blue)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)' }}>{selected.size} selected</span>
              <button className="btn btn-sm" style={{ padding: '3px 8px', fontSize: 10, background: 'var(--green)', color: '#fff', border: 'none' }} onClick={() => bulkToggleStatus('active')}>Activate</button>
              <button className="btn btn-sm" style={{ padding: '3px 8px', fontSize: 10, background: 'var(--orange)', color: '#fff', border: 'none' }} onClick={() => bulkToggleStatus('paused')}>Pause</button>
              <button className="btn btn-sm" style={{ padding: '3px 8px', fontSize: 10, background: 'var(--red)', color: '#fff', border: 'none' }} onClick={bulkDelete} disabled={bulkDeleting}>{bulkDeleting ? '...' : 'Delete'}</button>
            </div>
          )}
          <button onClick={() => setShowAdd(v => !v)} className="btn btn-blue btn-sm"><Plus size={13} /> Add Keywords</button>
        </div>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="card" style={{ border: '1.5px solid var(--border-blue)', background: 'var(--blue-dim)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue)', marginBottom: 10 }}>Add New Keywords</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><div className="section-title" style={{ marginBottom: 5 }}>Language</div>
              <select className="input" value={kwLang} onChange={e => setKwLang(e.target.value)}>{Object.entries(LANG_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><div className="section-title" style={{ marginBottom: 5 }}>Type</div>
              <select className="input" value={kwType} onChange={e => setKwType(e.target.value as any)}><option value="generic">Generic</option><option value="branded">Branded</option><option value="comparison">Comparison</option></select></div>
          </div>
          <textarea className="input" rows={4} placeholder={"best water purifier\nsamsung galaxy review"} value={bulkKw} onChange={e => setBulkKw(e.target.value)} style={{ resize: 'vertical', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, marginBottom: 10 }} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>{bulkKw.split('\n').filter(l => l.trim()).length} keyword(s) ready</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-blue btn-sm" onClick={addKeywords} disabled={adding || !bulkKw.trim()}>{adding ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={12} />} Add</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input" placeholder="Search keywords…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32 }} />
        </div>
        <select className="input" value={filterType} onChange={e => setFilterType(e.target.value)} style={{ minWidth: 100 }}>
          <option value="all">All Types</option><option value="generic">Generic</option><option value="branded">Branded</option><option value="comparison">Comparison</option>
        </select>
        <select className="input" value={filterLang} onChange={e => setFilterLang(e.target.value)} style={{ minWidth: 110 }}>
          <option value="all">All Languages</option>{distinctLangs.map(l => <option key={l} value={l}>{LANG_LABELS[l] || l}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160, color: 'var(--text-muted)' }}>
          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}><Search size={28} style={{ marginBottom: 8, opacity: 0.4 }} /><div>{keywords.length === 0 ? 'No keywords yet.' : 'No matches.'}</div></div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 90px 80px 80px 80px 100px 80px', padding: '10px 14px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-1)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', alignItems: 'center' }}>
            <div><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={() => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(k => k.id)))} style={{ cursor: 'pointer' }} /></div>
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={() => handleSort('name')}>Keyword <SortIcon col="name" /></div>
            <div>Type</div><div>Language</div>
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }} onClick={() => handleSort('videos')}>Videos <SortIcon col="videos" /></div>
            <div style={{ textAlign: 'right' }}>Shorts</div>
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={() => handleSort('last_scraped')}>Scraped <SortIcon col="last_scraped" /></div>
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => handleSort('status')}>Status <SortIcon col="status" /></div>
          </div>
          {/* Rows */}
          {filtered.map((kw, i) => (
            <div key={kw.id} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 90px 80px 80px 80px 100px 80px', padding: '10px 14px', borderBottom: i < filtered.length - 1 ? '1px solid var(--border-1)' : 'none', fontSize: 12, alignItems: 'center', background: selected.has(kw.id) ? 'var(--blue-dim)' : 'transparent' }}
              onMouseEnter={e => { if (!selected.has(kw.id)) e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { if (!selected.has(kw.id)) e.currentTarget.style.background = selected.has(kw.id) ? 'var(--blue-dim)' : 'transparent' }}>
              <div><input type="checkbox" checked={selected.has(kw.id)} onChange={() => { const n = new Set(selected); n.has(kw.id) ? n.delete(kw.id) : n.add(kw.id); setSelected(n) }} style={{ cursor: 'pointer' }} /></div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{kw.text}</div>
              <div><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: `color-mix(in srgb, ${TYPE_COLORS[kw.category] || 'var(--text-muted)'} 10%, transparent)`, color: TYPE_COLORS[kw.category] || 'var(--text-muted)' }}>{kw.category || 'generic'}</span></div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}><Globe size={10} /> {LANG_LABELS[kw.language] || kw.language}</div>
              <div style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>{kw.long_form_count || 0}</div>
              <div style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>{kw.short_form_count || 0}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={10} /> {fmtRelative(kw.last_scraped)}</div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button onClick={() => toggleStatus(kw.id, kw.status)} style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, border: 'none', background: kw.status === 'active' ? 'var(--green-dim)' : 'var(--red-dim)', color: kw.status === 'active' ? 'var(--green)' : 'var(--red)', cursor: 'pointer' }}>
                  {kw.status === 'active' ? 'Active' : 'Paused'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
