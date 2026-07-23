'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus, Trash2, Play, Pause, RefreshCw, Key, Tag,
  ChevronDown, ChevronUp, Search, Check, AlertTriangle,
  Zap, BarChart2, CheckCircle, XCircle, Loader2, X,
  Hash, Users as UsersIcon, Shield, ShieldCheck, ShieldAlert,
  Eye, UserPlus, UserMinus, MoreVertical, ShoppingBag, Activity,
} from 'lucide-react'
import { AMAZON_INDIA_CATEGORIES } from '@/lib/amazon-india'

interface Campaign {
  id: string; name: string; category: string; sub_category: string; description: string
  status: 'active' | 'paused' | 'archived'
  keyword_count: number; brand_count: number
  last_scraped: string | null; created_at: string
}

interface Keyword {
  id: string; campaign_id: string; text: string; language: string
  category: 'generic' | 'branded' | 'comparison'
  status: 'active' | 'paused'
  result_count: number; last_scraped: string | null; created_at: string
}

interface ScrapeJob {
  id: string; keyword_text: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  results_count: number; error_msg: string | null
  api_key_used: string | null; created_at: string; completed_at: string | null
}

interface ScrapeItem {
  keywordId: string
  text: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  message?: string
}

function fmtRelative(iso: string | null): string {
  if (!iso) return 'Never'
  const d = new Date(iso.includes('T') ? iso : iso + 'Z')
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`
}

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error' | 'info' | 'warning'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  const bg = type === 'success' ? '#00C853' : type === 'error' ? '#FF2D55' : type === 'warning' ? '#F59E0B' : '#1A73E8'
  return (
    <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderRadius: 12, minWidth: 280, background: bg, color: '#FFF', fontWeight: 600, fontSize: 13, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', animation: 'fadeUp 0.25s ease' }}>
      {type === 'success' && <CheckCircle size={16} />}
      {type === 'error' && <XCircle size={16} />}
      {type === 'info' && <Zap size={16} />}
      {type === 'warning' && <AlertTriangle size={16} />}
      <span style={{ flex: 1 }}>{msg}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FFF', padding: 2 }}><X size={14} /></button>
    </div>
  )
}

function PageAccessBadge({ role }: { role: string }) {
  const cfg: Record<string, { label: string; color: string }> = {
    owner: { label: 'Everything', color: '#00C853' },
    admin: { label: 'Manage + Edit', color: '#1A73E8' },
    editor: { label: 'Edit Content', color: '#7C3AED' },
    viewer: { label: 'View Only', color: '#64748B' },
  }
  const { label, color } = cfg[role] || cfg.viewer
  return <span style={{ fontSize: 10.5, fontWeight: 700, color, background: `${color}15`, padding: '2px 8px', borderRadius: 99, display: 'inline-block' }}>{label}</span>
}

function ScrapeStatusIcon({ status }: { status: string }) {
  if (status === 'running') return <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', color: '#1A73E8' }} />
  if (status === 'completed') return <CheckCircle size={12} style={{ color: '#00C853' }} />
  if (status === 'failed') return <XCircle size={12} style={{ color: '#FF2D55' }} />
  return <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#CBD5E1' }} />
}

export default function ControlPage() {
  const [tab, setTab] = useState<'campaigns' | 'members'>('campaigns')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [activeCampaign, setActiveCampaign] = useState<string | null>(null)
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [brands, setBrands] = useState<any[]>([])
  const [jobs, setJobs] = useState<ScrapeJob[]>([])
  const [loading, setLoading] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null)
  const [search, setSearch] = useState('')
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const [selCategory, setSelCategory] = useState('')
  const [selSubCategory, setSelSubCategory] = useState('')
  const [scrapeProgress, setScrapeProgress] = useState<ScrapeItem[]>([])

  const [members, setMembers] = useState<any[]>([])
  const [memberCampaignId, setMemberCampaignId] = useState('')
  const [newMember, setNewMember] = useState({ user_id: '', role: 'viewer' as 'owner' | 'admin' | 'editor' | 'viewer' })
  const [usersList, setUsersList] = useState<any[]>([])

  const [showNewCampaign, setShowNewCampaign] = useState(false)
  const [newCampaign, setNewCampaign] = useState({ name: '', category: '', sub_category: '', description: '' })
  const [campaignCategory, setCampaignCategory] = useState('')
  const [campaignSubCategory, setCampaignSubCategory] = useState('')
  const [showAddKw, setShowAddKw] = useState(false)
  const [bulkKw, setBulkKw] = useState('')
  const [kwLang, setKwLang] = useState('en')
  const [kwType, setKwType] = useState<'generic' | 'branded' | 'comparison'>('generic')

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const subCategories = AMAZON_INDIA_CATEGORIES.find(c => c.id === selCategory)?.subCategories || []
  const filteredKw = keywords.filter(k => k.text.toLowerCase().includes(search.toLowerCase()))
  const selectedCampaign = campaigns.find(c => c.id === activeCampaign)
  const runningJobs = jobs.filter(j => j.status === 'running' || j.status === 'pending')
  const hasActiveScrape = scrapeProgress.some(s => s.status === 'running' || s.status === 'pending')

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => setToast({ msg, type }), [])

  const fetchCampaigns = useCallback(async () => {
    try { const r = await fetch('/api/campaigns'); const d = await r.json(); setCampaigns(d.campaigns ?? []) } catch { showToast('Failed to load campaigns', 'error') }
  }, [showToast])

  const fetchCampaignDetail = useCallback(async (id: string) => {
    try {
      const [campaignRes, brandsRes] = await Promise.all([fetch(`/api/campaigns/${id}`), fetch(`/api/brands?campaign_id=${id}`)])
      const [campaignData, brandsData] = await Promise.all([campaignRes.json(), brandsRes.json()])
      setKeywords(campaignData.keywords ?? []); setJobs(campaignData.jobs ?? []); setBrands(brandsData.data ?? [])
    } catch { showToast('Failed to load campaign data', 'error') }
  }, [showToast])

  const fetchMembers = useCallback(async (campaignId: string) => {
    if (!campaignId) { setMembers([]); return }
    try { const r = await fetch(`/api/workspace/members?campaign_id=${campaignId}`); const d = await r.json(); setMembers(d.members ?? []) } catch {}
  }, [])

  const fetchUsersList = useCallback(async () => {
    try { const r = await fetch('/api/users'); const d = await r.json(); setUsersList(d.users ?? []) } catch {}
  }, [])

  const addMember = async () => {
    if (!memberCampaignId || !newMember.user_id) return showToast('Select a user and role', 'error')
    try {
      const r = await fetch('/api/workspace/members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaign_id: memberCampaignId, user_id: newMember.user_id, role: newMember.role }) })
      if (!r.ok) { const d = await r.json(); return showToast(d.error || 'Failed', 'error') }
      setNewMember({ user_id: '', role: 'viewer' }); await fetchMembers(memberCampaignId); showToast('Member added!')
    } catch { showToast('Connection error', 'error') }
  }

  const removeMember = async (userId: string) => {
    if (!confirm('Remove this member?')) return
    try {
      const r = await fetch(`/api/workspace/members?campaign_id=${memberCampaignId}&user_id=${userId}`, { method: 'DELETE' })
      if (!r.ok) return showToast('Cannot remove', 'error')
      await fetchMembers(memberCampaignId); showToast('Member removed')
    } catch { showToast('Failed', 'error') }
  }

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])
  useEffect(() => { if (activeCampaign) fetchCampaignDetail(activeCampaign) }, [activeCampaign, fetchCampaignDetail])
  useEffect(() => {
    const hasRunning = jobs.some(j => j.status === 'running' || j.status === 'pending')
    if (hasRunning && activeCampaign) {
      pollRef.current = setInterval(() => { fetchCampaignDetail(activeCampaign); fetchCampaigns() }, 3000)
    } else { if (pollRef.current) clearInterval(pollRef.current) }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [jobs, activeCampaign, fetchCampaignDetail, fetchCampaigns])
  useEffect(() => {
    if (!openMenuId) return
    const handler = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('[data-menu-id]')) setOpenMenuId(null) }
    document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler)
  }, [openMenuId])

  const createCampaign = async () => {
    if (!newCampaign.name.trim()) return showToast('Enter a campaign name', 'error')
    setLoading(true)
    const catName = campaignCategory ? AMAZON_INDIA_CATEGORIES.find(c => c.id === campaignCategory)?.name || '' : ''
    const subName = campaignSubCategory ? AMAZON_INDIA_CATEGORIES.find(c => c.id === campaignCategory)?.subCategories.find(s => s.id === campaignSubCategory)?.name || '' : ''
    try {
      const r = await fetch('/api/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newCampaign, category: catName, sub_category: subName }) })
      const d = await r.json()
      if (!r.ok) return showToast(d.error, 'error')
      setNewCampaign({ name: '', category: '', sub_category: '', description: '' }); setCampaignCategory(''); setCampaignSubCategory(''); setShowNewCampaign(false)
      await fetchCampaigns(); setActiveCampaign(d.campaign.id); showToast(`Campaign "${d.campaign.name}" created!`)
    } finally { setLoading(false) }
  }

  const confirmDeleteCampaign = async () => {
    if (!deleteTarget) return
    if (deleteConfirmText !== deleteTarget.name) return showToast('Type the campaign name to confirm', 'error')
    setDeleting(true)
    try {
      await fetch(`/api/campaigns/${deleteTarget.id}`, { method: 'DELETE' })
      if (activeCampaign === deleteTarget.id) setActiveCampaign(null)
      await fetchCampaigns(); showToast(`Campaign "${deleteTarget.name}" deleted`)
      setDeleteTarget(null); setDeleteConfirmText('')
    } catch { showToast('Delete failed', 'error') } finally { setDeleting(false) }
  }

  const addKeywords = async () => {
    if (!bulkKw.trim() || !activeCampaign) return showToast('Enter at least one keyword', 'error')
    const kwList = bulkKw.split('\n').map(l => l.trim()).filter(Boolean).map(text => ({ text, language: kwLang, type: kwType }))
    setLoading(true)
    try {
      const r = await fetch('/api/keywords', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaign_id: activeCampaign, keywords: kwList }) })
      const d = await r.json()
      if (!r.ok) return showToast(d.error, 'error')
      setBulkKw(''); setShowAddKw(false); await fetchCampaignDetail(activeCampaign); await fetchCampaigns(); showToast(`${d.added} keyword(s) added`)
    } finally { setLoading(false) }
  }

  const deleteKeyword = async (id: string) => {
    try { await fetch(`/api/keywords?id=${id}`, { method: 'DELETE' }); if (activeCampaign) await fetchCampaignDetail(activeCampaign); await fetchCampaigns(); showToast('Keyword removed') } catch { showToast('Failed', 'error') }
  }

  const toggleKeyword = async (id: string, current: string) => {
    const next = current === 'active' ? 'paused' : 'active'
    try { await fetch('/api/keywords', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: next }) }); if (activeCampaign) await fetchCampaignDetail(activeCampaign) } catch { showToast('Update failed', 'error') }
  }

  const updateScrapeItem = (keywordId: string, status: ScrapeItem['status'], message?: string) => {
    setScrapeProgress(prev => prev.map(s => s.keywordId === keywordId ? { ...s, status, message } : s))
  }

  const triggerScrape = async (keywordId?: string) => {
    if (!activeCampaign) return
    setScraping(true)

    if (keywordId) {
      const kw = keywords.find(k => k.id === keywordId)
      if (!kw) return
      setScrapeProgress(prev => {
        const exists = prev.find(s => s.keywordId === keywordId)
        if (exists) return prev.map(s => s.keywordId === keywordId ? { ...s, status: 'running' } : s)
        return [...prev, { keywordId: kw.id, text: kw.text, status: 'running' }]
      })
      try {
        const r = await fetch('/api/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaign_id: activeCampaign, keyword_id: keywordId, limit: 1 }) })
        const d = await r.json()
        if (!r.ok) { updateScrapeItem(keywordId, 'failed', d.error); return showToast(d.error, 'error') }
        updateScrapeItem(keywordId, 'completed', d.message)
      } catch { updateScrapeItem(keywordId, 'failed', 'Connection error') }
    } else {
      const active = keywords.filter(k => k.status === 'active')
      if (active.length === 0) { showToast('No active keywords to scrape', 'warning'); setScraping(false); return }

      setScrapeProgress(active.map(k => ({ keywordId: k.id, text: k.text, status: 'pending' as const })))

      for (let i = 0; i < active.length; i++) {
        const kw = active[i]
        updateScrapeItem(kw.id, 'running')
        try {
          const r = await fetch('/api/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaign_id: activeCampaign, keyword_id: kw.id, limit: 1 }) })
          const d = await r.json()
          if (!r.ok) { updateScrapeItem(kw.id, 'failed', d.error) }
          else { updateScrapeItem(kw.id, 'completed', d.message) }
        } catch { updateScrapeItem(kw.id, 'failed', 'Connection error') }
      }
    }
    await fetchCampaignDetail(activeCampaign); setScraping(false)
  }

  const kwListCss: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 14px', borderRadius: 8, fontSize: 12.5,
    border: '1.5px solid transparent', transition: 'all 0.12s',
    cursor: 'default',
  }

  const showProgressPanel = hasActiveScrape || scrapeProgress.length > 0

  return (
    <div className="anim-fade-up">
      <div className="page-header">
        <div>
          <h1 className="page-title">Campaign <span className="accent">Control Center</span></h1>
          <p className="page-subtitle">Manage campaigns, keywords & YouTube scrape jobs</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {runningJobs.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: 'var(--blue-dim)', border: '1.5px solid var(--border-blue)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: 'var(--blue)' }}>
              <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
              {runningJobs.length} job{runningJobs.length > 1 ? 's' : ''} running
            </div>
          )}
        </div>
      </div>

      <div className="toggle-group" style={{ marginBottom: 24, width: 'fit-content' }}>
        <button className={`toggle-btn ${tab === 'campaigns' ? 'active' : ''}`} onClick={() => setTab('campaigns')}>
          <BarChart2 size={13} /> Campaigns & Keywords
        </button>
        <button className={`toggle-btn ${tab === 'members' ? 'active' : ''}`} onClick={() => { setTab('members'); fetchUsersList(); if (memberCampaignId) fetchMembers(memberCampaignId) }}>
          <UsersIcon size={13} /> Project Access
        </button>
      </div>

      {/* ════════════════════════ CAMPAIGNS & KEYWORDS ════════════════════════ */}
      {tab === 'campaigns' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: showProgressPanel && activeCampaign ? '280px minmax(0, 1fr) 260px' : '280px minmax(0, 1fr)',
          gap: 16, alignItems: 'start',
        }}>
          {/* ── Campaign List ── */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>Campaigns <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({campaigns.length})</span></span>
              <button className="btn btn-blue btn-xs" onClick={() => setShowNewCampaign(v => !v)}><Plus size={11} /> New</button>
            </div>
            {showNewCampaign && (
              <div style={{ padding: 12, borderBottom: '1px solid var(--border-1)', background: 'var(--blue-dim)' }}>
                <input className="input" placeholder="Campaign name *" value={newCampaign.name} style={{ marginBottom: 5, fontSize: 12, height: 32 }} onChange={e => setNewCampaign(p => ({ ...p, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && createCampaign()} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 5 }}>
                  <select value={campaignCategory} onChange={e => { setCampaignCategory(e.target.value); setCampaignSubCategory('') }} style={{ height: 32, fontSize: 11.5, padding: '4px 8px', border: '1.5px solid rgba(26,115,232,0.12)', borderRadius: 9, background: '#FFF', fontFamily: 'inherit', color: '#0F172A', cursor: 'pointer', width: '100%' }}>
                    <option value="">Select Category</option>
                    {AMAZON_INDIA_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select value={campaignSubCategory} onChange={e => setCampaignSubCategory(e.target.value)} style={{ height: 32, fontSize: 11.5, padding: '4px 8px', border: '1.5px solid rgba(26,115,232,0.12)', borderRadius: 9, background: '#FFF', fontFamily: 'inherit', color: '#0F172A', cursor: 'pointer', width: '100%' }} disabled={!campaignCategory}>
                    <option value="">Select Subcategory</option>
                    {AMAZON_INDIA_CATEGORIES.find(c => c.id === campaignCategory)?.subCategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <input className="input" placeholder="Description (optional)" value={newCampaign.description} style={{ marginBottom: 6, fontSize: 12, height: 32 }} onChange={e => setNewCampaign(p => ({ ...p, description: e.target.value }))} />
                <div style={{ display: 'flex', gap: 5 }}>
                  <button className="btn btn-blue btn-sm" onClick={createCampaign} disabled={loading} style={{ flex: 1, fontSize: 11.5, height: 30 }}>{loading ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={11} />} Create</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowNewCampaign(false)} style={{ height: 30 }}><X size={11} /></button>
                </div>
              </div>
            )}
            <div style={{ maxHeight: 540, overflowY: 'auto' }}>
              {campaigns.length === 0 && <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>No campaigns yet.</div>}
              {campaigns.map(c => (
                <div key={c.id} onClick={() => setActiveCampaign(c.id)}
                  style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-1)', cursor: 'pointer',
                    background: activeCampaign === c.id ? 'var(--blue-dim)' : 'white',
                    borderLeft: activeCampaign === c.id ? '3px solid var(--blue)' : '3px solid transparent',
                    transition: 'all 0.12s', paddingLeft: activeCampaign === c.id ? 11 : 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: activeCampaign === c.id ? 'var(--blue)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                      {c.category && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <ShoppingBag size={9} style={{ flexShrink: 0 }} />
                          {c.category}{c.sub_category ? <><span style={{ color: '#CBD5E1' }}>/</span>{c.sub_category}</> : ''}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <span style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}><Hash size={9} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 1 }} />{c.keyword_count} kw</span>
                        {c.last_scraped && <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{fmtRelative(c.last_scraped)}</span>}
                      </div>
                    </div>
                    <div style={{ position: 'relative', flexShrink: 0 }} data-menu-id={c.id}>
                      <button onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === c.id ? null : c.id) }}
                        style={{ background: openMenuId === c.id ? 'var(--blue-dim)' : 'none', border: 'none', cursor: 'pointer', padding: 3, color: 'var(--text-muted)', borderRadius: 4 }}>
                        <MoreVertical size={13} />
                      </button>
                      {openMenuId === c.id && (
                        <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 3, background: '#FFF', border: '1.5px solid var(--border-1)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', zIndex: 50, minWidth: 150, overflow: 'hidden' }}>
                          <button onClick={() => { setDeleteTarget({ id: c.id, name: c.name }); setOpenMenuId(null) }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 11.5, color: '#EF4444', fontFamily: 'inherit' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <Trash2 size={11} /> Delete Campaign
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Keyword Management ── */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {!activeCampaign ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Select a campaign to manage keywords.</div>
            ) : (
              <>
                {/* Header */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {selectedCampaign?.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({keywords.length} keywords)</span>
                  </span>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button className="btn btn-blue btn-xs" onClick={() => { setShowAddKw(v => !v); setSelCategory(''); setSelSubCategory('') }} style={{ fontSize: 10.5 }}>
                      <Plus size={10} /> Add Keywords
                    </button>
                    <button className="btn btn-ghost btn-xs" onClick={() => triggerScrape()} disabled={scraping} style={{ fontSize: 10.5 }}>
                      {scraping ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={10} />} Scrape All
                    </button>
                  </div>
                </div>

                {/* Add Keywords form */}
                {showAddKw && (
                  <div style={{ padding: 14, borderBottom: '1px solid var(--border-1)', background: 'rgba(245,130,32,0.03)' }}>
                    {/* Amazon India Category / Subcategory */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 9.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>Category</label>
                        <select value={selCategory} onChange={e => { setSelCategory(e.target.value); setSelSubCategory('') }}
                          style={{ height: 32, fontSize: 11.5, padding: '4px 8px', border: '1.5px solid rgba(26,115,232,0.12)', borderRadius: 9, background: '#FFF', fontFamily: 'inherit', color: '#0F172A', cursor: 'pointer', width: '100%' }}>
                          <option value="">All Categories</option>
                          {AMAZON_INDIA_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 9.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>Subcategory</label>
                        <select value={selSubCategory} onChange={e => setSelSubCategory(e.target.value)}
                          style={{ height: 32, fontSize: 11.5, padding: '4px 8px', border: '1.5px solid rgba(26,115,232,0.12)', borderRadius: 9, background: '#FFF', fontFamily: 'inherit', color: '#0F172A', cursor: 'pointer', width: '100%' }} disabled={!selCategory}>
                          <option value="">All Subcategories</option>
                          {subCategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <textarea className="input" rows={3} value={bulkKw} onChange={e => setBulkKw(e.target.value)}
                      placeholder="Enter keywords, one per line&#10;e.g.&#10;best smartphones 2026&#10;top laptops under 50000&#10;wireless headphones review"
                      style={{ resize: 'none', fontSize: 12, marginBottom: 8 }} />
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      <select className="input" value={kwLang} onChange={e => setKwLang(e.target.value)} style={{ height: 30, fontSize: 11, flex: 1 }}>
                        <option value="en">English</option>
                        <option value="hi">Hindi</option><option value="ta">Tamil</option><option value="te">Telugu</option><option value="bn">Bengali</option>
                      </select>
                      <select className="input" value={kwType} onChange={e => setKwType(e.target.value as any)} style={{ height: 30, fontSize: 11, flex: 1 }}>
                        <option value="generic">Generic</option>
                        <option value="branded">Branded</option>
                        <option value="comparison">Comparison</option>
                      </select>
                      <button className="btn btn-blue btn-sm" onClick={addKeywords} disabled={loading} style={{ height: 30, fontSize: 11 }}>
                        {loading ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={10} />} Add
                      </button>
                    </div>
                    {selCategory && (
                      <div style={{ fontSize: 10, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ShoppingBag size={10} />
                        {AMAZON_INDIA_CATEGORIES.find(c => c.id === selCategory)?.name}
                        {selSubCategory && <> &rarr; {subCategories.find(s => s.id === selSubCategory)?.name}</>}
                        {selSubCategory && AMAZON_INDIA_CATEGORIES.find(c => c.id === selCategory) && (
                          <span style={{ marginLeft: 'auto', color: '#F58220', fontWeight: 600 }}>
                            {keywords.length} keywords in this campaign
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Search */}
                <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border-1)' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                    <input className="input" placeholder="Search keywords..." value={search} onChange={e => setSearch(e.target.value)}
                      style={{ height: 30, paddingLeft: 28, fontSize: 11.5 }} />
                  </div>
                </div>

                {/* Keyword list - improved card-style rows */}
                <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                  {filteredKw.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#CBD5E1', fontSize: 13 }}>
                      {search ? 'No matching keywords.' : 'No keywords yet. Add keywords above.'}
                    </div>
                  ) : (
                    <div style={{ padding: '6px 10px' }}>
                      {filteredKw.map(kw => (
                        <div key={kw.id}
                          style={{
                            ...kwListCss,
                            background: kw.status === 'active' ? '#FFFFFF' : '#FAFBFC',
                            borderColor: kw.status === 'active' ? 'rgba(26,115,232,0.05)' : 'rgba(100,116,139,0.05)',
                            marginBottom: 4,
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(245,130,32,0.15)'; e.currentTarget.style.background = 'rgba(245,130,32,0.02)' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = kw.status === 'active' ? '#FFFFFF' : '#FAFBFC' }}
                        >
                          {/* Status dot */}
                          <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                            background: kw.status === 'active' ? '#00C853' : '#94A3B8' }} />

                          {/* Keyword text */}
                          <span style={{ flex: 1, fontWeight: 600, color: '#0F172A', fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {kw.text}
                          </span>

                          {/* Type badge */}
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
                            color: kw.category === 'branded' ? '#7C3AED' : kw.category === 'comparison' ? '#FF6D00' : '#1A73E8',
                            background: kw.category === 'branded' ? 'rgba(124,58,237,0.08)' : kw.category === 'comparison' ? 'rgba(255,109,0,0.08)' : 'rgba(26,115,232,0.08)',
                            whiteSpace: 'nowrap',
                          }}>
                            {kw.category}
                          </span>

                          {/* Lang */}
                          <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, minWidth: 24, textAlign: 'center' }}>
                            {kw.language.toUpperCase()}
                          </span>

                          {/* Last scraped */}
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', minWidth: 50, textAlign: 'right' }}>
                            {fmtRelative(kw.last_scraped)}
                          </span>

                          {/* Actions */}
                          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                            <button onClick={() => toggleKeyword(kw.id, kw.status)}
                              style={{
                                padding: '3px 5px', borderRadius: 4, border: 'none', cursor: 'pointer',
                                background: kw.status === 'active' ? 'rgba(0,200,83,0.08)' : 'rgba(148,163,184,0.1)',
                                color: kw.status === 'active' ? '#00C853' : '#94A3B8',
                                display: 'flex', alignItems: 'center',
                              }}
                              title={kw.status === 'active' ? 'Pause' : 'Activate'}>
                              {kw.status === 'active' ? <Pause size={10} /> : <Play size={10} />}
                            </button>
                            <button onClick={() => triggerScrape(kw.id)}
                              style={{ padding: '3px 5px', borderRadius: 4, border: 'none', cursor: 'pointer', background: 'rgba(26,115,232,0.06)', color: '#1A73E8', display: 'flex', alignItems: 'center' }}
                              title="Scrape this keyword">
                              <RefreshCw size={10} />
                            </button>
                            <button onClick={() => deleteKeyword(kw.id)}
                              style={{ padding: '3px 5px', borderRadius: 4, border: 'none', cursor: 'pointer', background: 'rgba(255,45,85,0.06)', color: '#FF2D55', display: 'flex', alignItems: 'center' }}
                              title="Delete">
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── Scrape Progress Panel ── */}
          {showProgressPanel && activeCampaign && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'sticky', top: 20 }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Activity size={12} /> Scrape Progress
                </span>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#64748B' }}>
                  {scrapeProgress.filter(s => s.status === 'completed').length}/{scrapeProgress.length} done
                </span>
              </div>
              <div style={{ maxHeight: 460, overflowY: 'auto', padding: '6px 8px' }}>
                {scrapeProgress.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 11.5 }}>No scrape activity yet.</div>
                ) : (
                  scrapeProgress.map(item => (
                    <div key={item.keywordId} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 8px', borderRadius: 6, fontSize: 11,
                      marginBottom: 2,
                      background: item.status === 'running' ? 'rgba(26,115,232,0.03)' : 'transparent',
                    }}>
                      <ScrapeStatusIcon status={item.status} />
                      <span style={{
                        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontWeight: item.status === 'running' ? 600 : 500,
                        color: item.status === 'failed' ? '#FF2D55' : item.status === 'completed' ? '#00C853' : '#0F172A',
                      }}>
                        {item.text}
                      </span>
                      {item.status === 'running' && (
                        <span style={{ fontSize: 9, color: '#1A73E8', fontWeight: 600, animation: 'pulse 1.5s ease-in-out infinite' }}>
                          scraping...
                        </span>
                      )}
                      {item.status === 'failed' && item.message && (
                        <span style={{ fontSize: 9, color: '#FF2D55', fontWeight: 500, textAlign: 'right', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.message}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
              {scrapeProgress.some(s => s.status === 'running' || s.status === 'pending') && (
                <div style={{ padding: '6px 14px 10px' }}>
                  <div style={{ height: 3, borderRadius: 99, background: '#E2E8F0', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 99,
                      background: 'linear-gradient(90deg, #F58220, #FF9F43)',
                      width: `${(scrapeProgress.filter(s => s.status === 'completed' || s.status === 'failed').length / Math.max(scrapeProgress.length, 1)) * 100}%`,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>
              )}
              {scrapeProgress.filter(s => s.status === 'completed' || s.status === 'failed').length === scrapeProgress.length && scrapeProgress.length > 0 && (
                <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border-1)' }}>
                  <button className="btn btn-ghost btn-xs" onClick={() => setScrapeProgress([])} style={{ width: '100%', fontSize: 10.5 }}>
                    <X size={10} /> Clear History
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════ PROJECT ACCESS ════════════════════════ */}
      {tab === 'members' && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Project Access</div>
            <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5, marginBottom: 14 }}>Manage members and roles per project.</p>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>Select Project</label>
              <select className="input" value={memberCampaignId} onChange={e => { setMemberCampaignId(e.target.value); if (e.target.value) fetchMembers(e.target.value) }} style={{ height: 34, fontSize: 12.5 }}>
                <option value="">-- Select --</option>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {memberCampaignId && (
              <>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>Add User</label>
                  <select className="input" value={newMember.user_id} onChange={e => setNewMember(p => ({ ...p, user_id: e.target.value }))} style={{ height: 34, fontSize: 12.5, marginBottom: 6 }}>
                    <option value="">-- User --</option>
                    {usersList.filter((u, i, arr) => arr.findIndex(x => x.id === u.id) === i).map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>Role</label>
                  <select className="input" value={newMember.role} onChange={e => setNewMember(p => ({ ...p, role: e.target.value as any }))} style={{ height: 34, fontSize: 12.5 }}>
                    <option value="viewer">Viewer (read-only)</option>
                    <option value="editor">Editor (add keywords/brands)</option>
                    <option value="admin">Admin (manage members)</option>
                  </select>
                </div>
                <button className="btn btn-blue btn-sm" onClick={addMember} style={{ width: '100%' }}><UserPlus size={12} /> Add to Project</button>
              </>
            )}
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{memberCampaignId ? `Members (${members.length})` : 'Select a project'}</span>
            </div>
            {memberCampaignId ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead><tr><th>User</th><th>Role</th><th>Access</th><th>Joined</th><th style={{ width: 60, textAlign: 'center' }}>Action</th></tr></thead>
                  <tbody>
                    {members.length === 0 ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: '#CBD5E1', fontSize: 13 }}>No members.</td></tr>
                    : members.map(m => (
                      <tr key={m.user_id}>
                        <td style={{ fontWeight: 600, color: '#0F172A' }}>{m.email}{m.user_role === 'admin' && <span className="badge badge-blue" style={{ marginLeft: 6, fontSize: 9 }}>MASTER</span>}</td>
                        <td>
                          <select value={m.role} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, border: '1.5px solid rgba(26,115,232,0.1)', background: '#FFF', cursor: 'pointer', fontFamily: 'inherit', color: m.role === 'owner' ? '#00C853' : m.role === 'admin' ? '#1A73E8' : m.role === 'editor' ? '#7C3AED' : '#64748B' }} disabled={m.role === 'owner'}>
                            <option value="owner" disabled>Owner</option><option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Viewer</option>
                          </select>
                        </td>
                        <td><PageAccessBadge role={m.role} /></td>
                        <td style={{ fontSize: 12, color: '#64748B' }}>{new Date(m.joined_at).toLocaleDateString()}</td>
                        <td style={{ textAlign: 'center' }}>
                          {m.role !== 'owner' && (
                            <button onClick={() => removeMember(m.user_id)} style={{ background: '#FEF2F2', border: '1.5px solid rgba(255,45,85,0.1)', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', color: '#EF4444', display: 'inline-flex', alignItems: 'center' }}>
                              <UserMinus size={11} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div style={{ textAlign: 'center', padding: 48, color: '#94A3B8', fontSize: 13 }}>Select a project to manage members.</div>}
          </div>
        </div>
      )}

      {/* ════════════════════════ DELETE CONFIRMATION MODAL ════════════════════════ */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div className="card" style={{ maxWidth: 420, width: '100%', padding: 24, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--red-dim)', color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertTriangle size={18} /></div>
              <div><h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: 0 }}>Delete Campaign</h3><p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>This action cannot be undone</p></div>
            </div>
            <p style={{ fontSize: 12.5, color: '#475569', marginBottom: 14, lineHeight: 1.5 }}>
              Type <strong style={{ color: '#EF4444' }}>{deleteTarget.name}</strong> below to confirm permanent deletion.
            </p>
            <input className="input" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} placeholder={deleteTarget.name} style={{ height: 38, fontSize: 13, marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-danger btn-sm" onClick={confirmDeleteCampaign} disabled={deleteConfirmText !== deleteTarget.name || deleting} style={{ flex: 1, opacity: deleteConfirmText !== deleteTarget.name ? 0.5 : 1 }}>
                {deleting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={13} />} Delete Permanently
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setDeleteTarget(null); setDeleteConfirmText('') }} style={{ flex: 1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  )
}
