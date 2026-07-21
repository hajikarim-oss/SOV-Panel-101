'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus, Trash2, Play, Pause, RefreshCw, Key, Tag, Settings,
  ChevronDown, ChevronUp, Search, Copy, Check, AlertTriangle,
  Zap, BarChart2, CheckCircle, XCircle, Loader2, X, Globe,
  BookOpen, Hash, TrendingUp
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Campaign {
  id: string
  name: string
  category: string
  description: string
  status: 'active' | 'paused' | 'archived'
  keyword_count: number
  brand_count: number
  last_scraped: string | null
  created_at: string
}

interface Keyword {
  id: string
  campaign_id: string
  text: string
  language: string
  category: 'generic' | 'branded' | 'comparison'
  status: 'active' | 'paused'
  result_count: number
  last_scraped: string | null
  created_at: string
}

interface ApiKey {
  id: string
  label: string
  api_key_masked: string
  bucket: 1 | 2
  units_used: number
  units_limit: number
  usage_pct: number
  is_active: boolean
  last_used_at: string | null
  reset_date: string
}

interface ApiKeyStats {
  total: number
  active: number
  total_used: number
  total_capacity: number
  exhausted: number
}

interface ScrapeJob {
  id: string
  keyword_text: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  results_count: number
  error_msg: string | null
  api_key_used: string | null
  created_at: string
  completed_at: string | null
}

// ── Small helpers ────────────────────────────────────────────────────────────
function fmtRelative(iso: string | null): string {
  if (!iso) return 'Never'
  const d = new Date(iso.includes('T') ? iso : iso + 'Z')
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function fmt(n: number): string {
  if (n == null || isNaN(n)) return '0'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error' | 'info' | 'warning'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  const bg = type === 'success' ? '#00C853' : type === 'error' ? '#FF2D55' : type === 'warning' ? '#F59E0B' : '#1A73E8'
  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '14px 20px', borderRadius: 12, minWidth: 280,
      background: bg, color: '#FFF', fontWeight: 600, fontSize: 13,
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      animation: 'fadeUp 0.25s ease',
    }}>
      {type === 'success' && <CheckCircle size={16} />}
      {type === 'error' && <XCircle size={16} />}
      {type === 'info' && <Zap size={16} />}
      {type === 'warning' && <AlertTriangle size={16} />}
      <span style={{ flex: 1 }}>{msg}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FFF', padding: 2 }}>
        <X size={14} />
      </button>
    </div>
  )
}

function UsageBar({ pct, color }: { pct: number; color: string }) {
  const c = pct > 80 ? '#FF2D55' : pct > 60 ? '#FF6D00' : color
  return (
    <div style={{ height: 6, borderRadius: 99, background: '#E2E8F0', overflow: 'hidden', width: '100%' }}>
      <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', borderRadius: 99, background: c, transition: 'width 0.4s ease' }} />
    </div>
  )
}

// ── Main Control Page ───────────────────────────────────────────────────────
export default function ControlPage() {
  const [tab, setTab] = useState<'campaigns' | 'api-keys' | 'brands' | 'users' | 'backup'>('campaigns')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [apiKeyStats, setApiKeyStats] = useState<ApiKeyStats | null>(null)
  const [activeCampaign, setActiveCampaign] = useState<string | null>(null)
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [brands, setBrands] = useState<any[]>([])
  const [jobs, setJobs] = useState<ScrapeJob[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [refreshingViews, setRefreshingViews] = useState(false)
  const [viewRefreshProgress, setViewRefreshProgress] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null)
  const [search, setSearch] = useState('')
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // ── New User Form ──
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'brand' as 'admin' | 'brand', campaign_id: '', brand_name: '' })

  // ── New Campaign form ──
  const [showNewCampaign, setShowNewCampaign] = useState(false)
  const [newCampaign, setNewCampaign] = useState({ name: '', category: '', description: '' })

  // ── New Keywords form ──
  const [showAddKw, setShowAddKw] = useState(false)
  const [bulkKw, setBulkKw] = useState('')
  const [kwLang, setKwLang] = useState('en')
  const [kwType, setKwType] = useState<'generic' | 'branded' | 'comparison'>('generic')

  // ── New Brand form ──
  const [showAddBrand, setShowAddBrand] = useState(false)
  const [newBrandName, setNewBrandName] = useState('')
  const [newBrandType, setNewBrandType] = useState<'own' | 'competitor'>('competitor')

  // ── New API Key form ──
  const [showAddKey, setShowAddKey] = useState(false)
  const [newKey, setNewKey] = useState({ label: '', api_key: '', units_limit: '10000' })
  const [keyVisible, setKeyVisible] = useState(false)

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToast({ msg, type })
  }, [])

  // ── Fetch campaigns ────────────────────────────────────────────────────────
  const fetchCampaigns = useCallback(async () => {
    try {
      const r = await fetch('/api/campaigns')
      const d = await r.json()
      setCampaigns(d.campaigns ?? [])
    } catch { showToast('Failed to load campaigns', 'error') }
  }, [showToast])

  // ── Fetch API keys ─────────────────────────────────────────────────────────
  const fetchApiKeys = useCallback(async () => {
    try {
      const r = await fetch('/api/api-keys')
      const d = await r.json()
      setApiKeys(d.keys ?? [])
      setApiKeyStats(d.stats ?? null)
    } catch { showToast('Failed to load API keys', 'error') }
  }, [showToast])

  // ── Fetch keywords + jobs for active campaign ──────────────────────────────
  const fetchCampaignDetail = useCallback(async (id: string) => {
    try {
      const [campaignRes, brandsRes] = await Promise.all([
        fetch(`/api/campaigns/${id}`),
        fetch(`/api/brands?campaign_id=${id}`),
      ])
      const [campaignData, brandsData] = await Promise.all([
        campaignRes.json(),
        brandsRes.json(),
      ])
      setKeywords(campaignData.keywords ?? [])
      setJobs(campaignData.jobs ?? [])
      setBrands(brandsData.data ?? [])
    } catch { showToast('Failed to load campaign keywords and brands', 'error') }
  }, [showToast])

  // ── Fetch users ──────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    try {
      const r = await fetch('/api/users')
      const d = await r.json()
      setUsers(d.users ?? [])
    } catch { showToast('Failed to load users list', 'error') }
  }, [showToast])

  useEffect(() => {
    fetchCampaigns()
    fetchApiKeys()
    fetchUsers()
  }, [fetchCampaigns, fetchApiKeys, fetchUsers])

  useEffect(() => {
    if (activeCampaign) fetchCampaignDetail(activeCampaign)
  }, [activeCampaign, fetchCampaignDetail])

  // ── Poll jobs if any are running ──────────────────────────────────────────
  useEffect(() => {
    const hasRunning = jobs.some(j => j.status === 'running' || j.status === 'pending')
    if (hasRunning && activeCampaign) {
      pollRef.current = setInterval(() => {
        fetchCampaignDetail(activeCampaign)
        fetchCampaigns()
      }, 3000)
    } else {
      if (pollRef.current) clearInterval(pollRef.current)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [jobs, activeCampaign, fetchCampaignDetail, fetchCampaigns])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const createCampaign = async () => {
    if (!newCampaign.name.trim()) return showToast('Enter a campaign name', 'error')
    setLoading(true)
    try {
      const r = await fetch('/api/campaigns', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCampaign),
      })
      const d = await r.json()
      if (!r.ok) return showToast(d.error, 'error')
      setNewCampaign({ name: '', category: '', description: '' })
      setShowNewCampaign(false)
      await fetchCampaigns()
      setActiveCampaign(d.campaign.id)
      showToast(`Campaign "${d.campaign.name}" created!`)
    } finally { setLoading(false) }
  }

  const deleteCampaign = async (id: string, name: string) => {
    if (!confirm(`Delete campaign "${name}" and all its data?`)) return
    try {
      await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
      if (activeCampaign === id) setActiveCampaign(null)
      await fetchCampaigns()
      showToast(`Campaign deleted`)
    } catch { showToast('Delete failed', 'error') }
  }

  const addKeywords = async () => {
    if (!bulkKw.trim() || !activeCampaign) return showToast('Enter at least one keyword', 'error')
    const lines = bulkKw.split('\n').map(l => l.trim()).filter(Boolean)
    const kwList = lines.map(text => ({ text, language: kwLang, type: kwType }))
    setLoading(true)
    try {
      const r = await fetch('/api/keywords', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: activeCampaign, keywords: kwList }),
      })
      const d = await r.json()
      if (!r.ok) return showToast(d.error, 'error')
      setBulkKw('')
      setShowAddKw(false)
      await fetchCampaignDetail(activeCampaign)
      await fetchCampaigns()
      showToast(`${d.added} keyword(s) added`)
    } finally { setLoading(false) }
  }

  const createBrand = async () => {
    if (!activeCampaign) return
    if (!newBrandName.trim()) return showToast('Enter a brand/product name', 'error')
    setLoading(true)
    try {
      const r = await fetch('/api/brands', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: activeCampaign,
          name: newBrandName.trim(),
          type: newBrandType,
        }),
      })
      const d = await r.json()
      if (!r.ok) return showToast(d.error, 'error')
      setNewBrandName('')
      setShowAddBrand(false)
      await fetchCampaignDetail(activeCampaign)
      showToast(`Brand "${d.id}" added!`)
    } finally { setLoading(false) }
  }

  const deleteBrand = async (brandId: string) => {
    if (!confirm('Remove this brand from the campaign? This will remove related tagging data.')) return
    try {
      await fetch(`/api/brands?id=${brandId}`, { method: 'DELETE' })
      if (activeCampaign) await fetchCampaignDetail(activeCampaign)
      showToast('Brand removed')
    } catch { showToast('Delete failed', 'error') }
  }

  const deleteKeyword = async (id: string) => {
    try {
      await fetch(`/api/keywords?id=${id}`, { method: 'DELETE' })
      if (activeCampaign) await fetchCampaignDetail(activeCampaign)
      await fetchCampaigns()
      showToast('Keyword removed')
    } catch { showToast('Delete failed', 'error') }
  }

  const toggleKeyword = async (id: string, current: string) => {
    const next = current === 'active' ? 'paused' : 'active'
    try {
      await fetch('/api/keywords', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: next }),
      })
      if (activeCampaign) await fetchCampaignDetail(activeCampaign)
    } catch { showToast('Update failed', 'error') }
  }

  const triggerScrape = async (keywordId?: string) => {
    if (!activeCampaign) return
    setScraping(true)

    if (keywordId) {
      const kw = keywords.find(k => k.id === keywordId)
      showToast(`Scraping "${kw?.text}"…`, 'info')
      try {
        const r = await fetch('/api/scrape', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaign_id: activeCampaign, keyword_id: keywordId, limit: 1 }),
        })
        const d = await r.json()
        if (!r.ok) return showToast(d.error, 'error')
        showToast(d.message, 'info')
      } catch { showToast('Scrape failed', 'error') }
    } else {
      const active = keywords.filter(k => k.status === 'active')
      let done = 0
      showToast(`Scraping ${active.length} keywords in batches of 2…`, 'info')
      try {
        while (done < active.length) {
          const r = await fetch('/api/scrape', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaign_id: activeCampaign, limit: 2 }),
          })
          const d = await r.json()
          if (!r.ok) { showToast(d.error, 'error'); break }
          done += d.results?.length || 0
          if (d.remaining > 0) showToast(`Progress: ${done}/${active.length} scraped…`, 'info')
          else { showToast(d.message, 'info'); break }
        }
      } catch { showToast('Scrape failed', 'error') }
    }

    await fetchCampaignDetail(activeCampaign)
    setScraping(false)
  }

  const addApiKey = async () => {
    if (!newKey.api_key.trim()) return showToast('Enter the API key', 'error')
    setLoading(true)
    try {
      const r = await fetch('/api/api-keys', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: newKey.label,
          api_key: newKey.api_key,
          units_limit: parseInt(newKey.units_limit),
        }),
      })
      const d = await r.json()
      if (!r.ok) return showToast(d.error, 'error')
      setNewKey({ label: '', api_key: '', units_limit: '10000' })
      setShowAddKey(false)
      await fetchApiKeys()
      showToast('API key added!')
    } finally { setLoading(false) }
  }

  const toggleApiKey = async (id: string) => {
    try {
      await fetch('/api/api-keys', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'toggle' }),
      })
      await fetchApiKeys()
    } catch { showToast('Failed', 'error') }
  }

  const resetApiKey = async (id: string) => {
    try {
      await fetch('/api/api-keys', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'reset' }),
      })
      await fetchApiKeys()
      showToast('Quota reset')
    } catch { showToast('Failed', 'error') }
  }

  const deleteApiKey = async (id: string) => {
    if (!confirm('Remove this API key?')) return
    try {
      await fetch(`/api/api-keys?id=${id}`, { method: 'DELETE' })
      await fetchApiKeys()
      showToast('Key removed')
    } catch { showToast('Failed', 'error') }
  }

  // ── User Management Actions ───────────────────────────────────────────────
  const createUser = async () => {
    if (!newUser.email.trim() || !newUser.password.trim()) {
      return showToast('Email and password required', 'error')
    }
    setLoading(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      })
      const d = await res.json()
      if (!res.ok) return showToast(d.error || 'Failed to create user', 'error')
      setNewUser({ email: '', password: '', role: 'brand', campaign_id: '', brand_name: '' })
      await fetchUsers()
      showToast('User account created!')
    } finally {
      setLoading(false)
    }
  }

  const deleteUser = async (id: string, email: string) => {
    if (!confirm(`Delete user login "${email}"?`)) return
    try {
      const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      await fetchUsers()
      showToast('User deleted')
    } catch {
      showToast('Failed to delete user', 'error')
    }
  }

  // ── Filtered views ───────────────────────────────────────────────────────
  const filteredKw = keywords.filter(k => k.text.toLowerCase().includes(search.toLowerCase()))
  const selectedCampaign = campaigns.find(c => c.id === activeCampaign)
  const runningJobs = jobs.filter(j => j.status === 'running' || j.status === 'pending')

  // ── STATUS COLOR ──────────────────────────────────────────────────────────
  const statusColor = (s: string) => ({
    completed: 'var(--green)', failed: 'var(--red)',
    running: 'var(--blue)', pending: 'var(--orange)',
  }[s] ?? 'var(--text-muted)')

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="anim-fade-up">

      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Campaign <span className="accent">Control Center</span></h1>
          <p className="page-subtitle">Manage campaigns, keywords & API keys — then fire YouTube scrape jobs</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {runningJobs.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px',
              background: 'var(--blue-dim)', border: '1.5px solid var(--border-blue)',
              borderRadius: 20, fontSize: 12, fontWeight: 600, color: 'var(--blue)',
            }}>
              <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
              {runningJobs.length} job{runningJobs.length > 1 ? 's' : ''} running
            </div>
          )}
          {apiKeyStats && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
              background: 'white', border: '1.5px solid var(--border-1)',
              borderRadius: 20, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
            }}>
              <Key size={13} style={{ color: 'var(--blue)' }} />
              {apiKeyStats.active}/{apiKeyStats.total} keys active
            </div>
          )}
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="toggle-group" style={{ marginBottom: 24, width: 'fit-content' }}>
        <button className={`toggle-btn ${tab === 'campaigns' ? 'active' : ''}`} onClick={() => setTab('campaigns')}>
          <BarChart2 size={13} /> Campaigns & Keywords
        </button>
        <button className={`toggle-btn ${tab === 'brands' ? 'active' : ''}`} onClick={() => setTab('brands')}>
          <Tag size={13} /> Brands & Products
        </button>
        <button className={`toggle-btn ${tab === 'api-keys' ? 'active' : ''}`} onClick={() => setTab('api-keys')}>
          <Key size={13} /> API Key Vault
        </button>
        <button className={`toggle-btn ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
          <Globe size={13} /> Client Logins
        </button>
        <button className={`toggle-btn ${tab === 'backup' ? 'active' : ''}`} onClick={() => setTab('backup')}>
          <BookOpen size={13} /> Backup
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB: CAMPAIGNS & KEYWORDS
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'campaigns' && (
        <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', gap: 20, alignItems: 'start', overflow: 'hidden' }}>

          {/* ── Campaign List Panel ── */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid var(--border-1)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                Campaigns <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({campaigns.length})</span>
              </div>
              <button className="btn btn-blue btn-xs" onClick={() => setShowNewCampaign(v => !v)} data-tutorial="create-campaign">
                <Plus size={12} /> New
              </button>
            </div>

            {/* New Campaign Form */}
            {showNewCampaign && (
              <div style={{ padding: 16, borderBottom: '1px solid var(--border-1)', background: 'var(--blue-dim)' }}>
                <input
                  className="input" placeholder="Campaign name *"
                  value={newCampaign.name} style={{ marginBottom: 8 }}
                  onChange={e => setNewCampaign(p => ({ ...p, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && createCampaign()}
                />
                <input
                  className="input" placeholder="Category (e.g. Smartphones)"
                  value={newCampaign.category} style={{ marginBottom: 8 }}
                  onChange={e => setNewCampaign(p => ({ ...p, category: e.target.value }))}
                />
                <input
                  className="input" placeholder="Description (optional)"
                  value={newCampaign.description} style={{ marginBottom: 10 }}
                  onChange={e => setNewCampaign(p => ({ ...p, description: e.target.value }))}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-blue btn-sm" onClick={createCampaign} disabled={loading} style={{ flex: 1 }}>
                    {loading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={12} />}
                    Create
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowNewCampaign(false)}>
                    <X size={12} />
                  </button>
                </div>
              </div>
            )}

            {/* Campaign items */}
            <div style={{ maxHeight: 600, overflowY: 'auto' }}>
              {campaigns.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  No campaigns yet. Create one above.
                </div>
              )}
              {campaigns.map(c => (
                <div
                  key={c.id}
                  onClick={() => setActiveCampaign(c.id)}
                  style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--border-1)',
                    cursor: 'pointer',
                    background: activeCampaign === c.id ? 'var(--blue-dim)' : 'white',
                    borderLeft: activeCampaign === c.id ? '3px solid var(--blue)' : '3px solid transparent',
                    transition: 'all 0.15s',
                    paddingLeft: activeCampaign === c.id ? 17 : 20,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 700, color: activeCampaign === c.id ? 'var(--blue)' : 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {c.name}
                      </div>
                      {c.category && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{c.category}</div>
                      )}
                      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          <Hash size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />
                          {c.keyword_count} keywords
                        </span>
                        {c.last_scraped && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {fmtRelative(c.last_scraped)}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); deleteCampaign(c.id, c.name) }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                        color: 'var(--text-muted)', borderRadius: 4, flexShrink: 0,
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Keywords Panel ── */}
          <div>
            {!activeCampaign ? (
              <div className="card" style={{ textAlign: 'center', padding: 60 }}>
                <BarChart2 size={40} style={{ color: 'var(--border-2)', margin: '0 auto 14px' }} />
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
                  Select a campaign
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Choose a campaign from the left panel to manage its keywords.
                </div>
              </div>
            ) : (
              <>
                {/* Campaign Detail Header */}
                <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 3 }}>
                        {selectedCampaign?.name}
                      </div>
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {keywords.length} keywords total
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--green)' }}>
                          {keywords.filter(k => k.status === 'active').length} active
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {keywords.filter(k => k.status === 'paused').length} paused
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--blue)' }}>
                          {keywords.filter(k => k.last_scraped && new Date(k.last_scraped).getTime() > Date.now() - 86400000).length} scraped (24h)
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setShowAddKw(v => !v)}
                        data-tutorial="add-keywords"
                      >
                        <Plus size={13} /> Add Keywords
                      </button>
                      <button
                        className="btn btn-blue btn-sm"
                        onClick={() => triggerScrape()}
                        disabled={scraping || keywords.filter(k => k.status === 'active').length === 0}
                        data-tutorial="run-scrape"
                      >
                        {scraping
                          ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Scraping…</>
                          : <><Play size={13} /> Scrape All</>
                        }
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={async () => {
                          setRefreshingViews(true)
                          setViewRefreshProgress('Starting…')
                          try {
                            let offset = 0
                            const limit = 10
                            let totalUpdated = 0
                            let totalProcessed = 0
                            let chunkNum = 0
                            while (true) {
                              chunkNum++
                              setViewRefreshProgress(`Chunk ${chunkNum}…`)
                              const r = await fetch(`/api/cron?job=daily_views&offset=${offset}&limit=${limit}`)
                              const d = await r.json()
                              if (!d.ok) { showToast(d.error || 'Chunk failed', 'error'); break }
                              totalUpdated += d.updated || 0
                              totalProcessed += d.processed || 0
                              setViewRefreshProgress(`${totalProcessed}/${d.total} (${totalUpdated} updated)`)
                              if (d.completed || d.remaining <= 0 || d.processed === 0) {
                                showToast(`Views refreshed: ${totalUpdated} updated across ${totalProcessed} videos (${chunkNum} chunks)`, 'success')
                                break
                              }
                              offset += limit
                              if (chunkNum >= 200) { showToast(`Stopped at ${chunkNum} chunks. ${d.remaining} remaining.`, 'warning'); break }
                            }
                          } catch { showToast('Refresh failed', 'error') }
                          finally { setRefreshingViews(false); setViewRefreshProgress('') }
                        }}
                        disabled={refreshingViews}
                        style={{
                          background: refreshingViews ? '#F1F5F9' : 'rgba(0,200,83,0.08)',
                          border: `1px solid ${refreshingViews ? '#E2E8F0' : 'rgba(0,200,83,0.25)'}`,
                          color: '#059669', fontWeight: 700,
                        }}
                      >
                        {refreshingViews
                          ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> {viewRefreshProgress || 'Updating…'}</>
                          : <><RefreshCw size={13} /> Refresh Views</>
                        }
                      </button>
                    </div>
                  </div>
                </div>

                {/* Add Keywords Drawer */}
                {showAddKw && (
                  <div className="card" style={{ marginBottom: 16, border: '1.5px solid var(--border-blue)', background: 'var(--blue-dim)' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>
                      Add Keywords
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                      <div>
                        <div className="section-title" style={{ marginBottom: 5 }}>Language</div>
                        <select className="input" value={kwLang} onChange={e => setKwLang(e.target.value)}>
                          <option value="en">English</option>
                          <option value="hi">Hindi</option>
                          <option value="es">Spanish</option>
                          <option value="pt">Portuguese</option>
                          <option value="fr">French</option>
                          <option value="de">German</option>
                          <option value="ja">Japanese</option>
                        </select>
                      </div>
                      <div>
                        <div className="section-title" style={{ marginBottom: 5 }}>Type</div>
                        <select className="input" value={kwType} onChange={e => setKwType(e.target.value as any)}>
                          <option value="generic">Generic</option>
                          <option value="branded">Branded</option>
                          <option value="comparison">Comparison</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <div className="section-title" style={{ marginBottom: 5 }}>
                        Keywords — one per line (bulk paste supported)
                      </div>
                      <textarea
                        className="input"
                        rows={5}
                        placeholder="best smartphone 2024&#10;samsung galaxy review&#10;iphone vs samsung&#10;buy phone online india"
                        value={bulkKw}
                        onChange={e => setBulkKw(e.target.value)}
                        style={{ resize: 'vertical', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
                      />
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        {bulkKw.split('\n').filter(l => l.trim()).length} keyword(s) ready to add
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-blue btn-sm" onClick={addKeywords} disabled={loading}>
                        {loading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={12} />}
                        Add Keywords
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setShowAddKw(false)}>Cancel</button>
                    </div>
                  </div>
                )}

                {/* Keyword search bar */}
                <div style={{ position: 'relative', marginBottom: 12 }}>
                  <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    className="input"
                    placeholder="Search keywords…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ paddingLeft: 36 }}
                  />
                </div>

                {/* Keywords Table */}
                <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
                  {filteredKw.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                      {keywords.length === 0 ? 'No keywords yet — add some above' : 'No keywords match your search'}
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: 36 }}>#</th>
                          <th>Keyword</th>
                          <th>Type</th>
                          <th>Lang</th>
                          <th style={{ textAlign: 'right' }}>Results</th>
                          <th>Last Scraped</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredKw.map((kw, i) => (
                          <tr key={kw.id}>
                            <td>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{i + 1}</span>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{kw.text}</div>
                            </td>
                            <td>
                              <span className={`badge ${kw.category === 'branded' ? 'badge-blue' : kw.category === 'comparison' ? 'badge-purple' : 'badge-gray'}`}>
                                {kw.category}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{kw.language.toUpperCase()}</span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: 13 }}>
                                {kw.result_count ?? 0}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {fmtRelative(kw.last_scraped)}
                              </span>
                            </td>
                            <td>
                              <span
                                className={kw.status === 'active' ? 'badge badge-green' : 'badge badge-gray'}
                              >
                                {kw.status}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                <button
                                  onClick={() => triggerScrape(kw.id)}
                                  disabled={scraping || kw.status !== 'active'}
                                  title="Scrape this keyword"
                                  style={{
                                    background: 'var(--blue-dim)', border: '1px solid var(--border-blue)',
                                    color: 'var(--blue)', borderRadius: 6, padding: '4px 8px',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                                    opacity: kw.status !== 'active' ? 0.4 : 1,
                                  }}
                                >
                                  <Play size={11} />
                                </button>
                                <button
                                  onClick={() => toggleKeyword(kw.id, kw.status)}
                                  title={kw.status === 'active' ? 'Pause' : 'Resume'}
                                  style={{
                                    background: 'var(--bg-elevated)', border: '1px solid var(--border-1)',
                                    color: 'var(--text-secondary)', borderRadius: 6, padding: '4px 8px',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                                  }}
                                >
                                  {kw.status === 'active' ? <Pause size={11} /> : <Play size={11} />}
                                </button>
                                <button
                                  onClick={() => deleteKeyword(kw.id)}
                                  title="Delete"
                                  style={{
                                    background: 'var(--red-dim)', border: '1px solid rgba(255,45,85,0.15)',
                                    color: 'var(--red)', borderRadius: 6, padding: '4px 8px',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                                  }}
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  )}
                </div>

                {/* Scrape Jobs Log */}
                {jobs.length > 0 && (
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{
                      padding: '12px 20px', borderBottom: '1px solid var(--border-1)',
                      fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span>Scrape Job Log</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                        {runningJobs.length > 0 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--blue)' }}>
                            <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                            Live updating…
                          </span>
                        )}
                      </span>
                    </div>
                    <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                      {jobs.slice(0, 20).map(j => (
                        <div key={j.id} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 20px', borderBottom: '1px solid var(--border-1)',
                        }}>
                          <div style={{
                            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                            background: statusColor(j.status),
                            boxShadow: (j.status === 'running' || j.status === 'pending') ? `0 0 6px ${statusColor(j.status)}` : 'none',
                          }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {j.keyword_text}
                            </div>
                            {j.error_msg && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 2 }}>{j.error_msg}</div>}
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: statusColor(j.status) }}>
                              {j.status === 'completed' ? `${j.results_count} results` : j.status.toUpperCase()}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtRelative(j.created_at)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: API KEY VAULT
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'api-keys' && (
        <div>
          {/* Stats summary */}
          {apiKeyStats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
              {[
                { label: 'Total Keys', val: apiKeyStats.total, color: 'var(--blue)' },
                { label: 'Active Keys', val: apiKeyStats.active, color: 'var(--green)' },
                { label: 'Exhausted Today', val: apiKeyStats.exhausted, color: 'var(--red)' },
                {
                  label: 'Total Quota Used',
                  val: `${((apiKeyStats.total_used / Math.max(apiKeyStats.total_capacity, 1)) * 100).toFixed(0)}%`,
                  color: 'var(--orange)',
                },
              ].map(s => (
                <div key={s.label} className="kpi-card">
                  <div className="kpi-value mono" style={{ color: s.color, fontSize: 26 }}>{s.val}</div>
                  <div className="kpi-label">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Add Key Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              API Key Vault
            </div>
            <button className="btn btn-blue btn-sm" onClick={() => setShowAddKey(v => !v)}>
              <Plus size={13} /> Add API Key
            </button>
          </div>

          {/* Add Key Form */}
          {showAddKey && (
            <div className="card" style={{ marginBottom: 16, border: '1.5px solid var(--border-blue)', background: 'var(--blue-dim)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>
                Add YouTube Data API Key
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <div className="section-title" style={{ marginBottom: 5 }}>Label</div>
                  <input className="input" placeholder="e.g. Project Alpha Key 1"
                    value={newKey.label} onChange={e => setNewKey(p => ({ ...p, label: e.target.value }))} />
                </div>
                <div>
                  <div className="section-title" style={{ marginBottom: 5 }}>Daily Quota Limit</div>
                  <input className="input" type="number" placeholder="10000"
                    value={newKey.units_limit} onChange={e => setNewKey(p => ({ ...p, units_limit: e.target.value }))} />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <div className="section-title" style={{ marginBottom: 5 }}>YouTube API Key *</div>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input"
                    type={keyVisible ? 'text' : 'password'}
                    placeholder="AIzaSy…"
                    value={newKey.api_key}
                    onChange={e => setNewKey(p => ({ ...p, api_key: e.target.value }))}
                    style={{ paddingRight: 40, fontFamily: "'JetBrains Mono', monospace" }}
                  />
                  <button
                    onClick={() => setKeyVisible(v => !v)}
                    style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                    }}
                  >
                    {keyVisible ? <X size={14} /> : <Search size={14} />}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-blue btn-sm" onClick={addApiKey} disabled={loading}>
                  {loading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={12} />}
                  Save Key
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowAddKey(false)}>Cancel</button>
              </div>
            </div>
          )}

          {/* Key Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
            {apiKeys.length === 0 && (
              <div className="card" style={{ gridColumn: '1/-1', padding: 48, textAlign: 'center' }}>
                <Key size={36} style={{ color: 'var(--border-2)', margin: '0 auto 14px' }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>No API keys yet</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
                  Add your YouTube Data API v3 keys above. You provided 5 keys — add them using the form.
                </div>
              </div>
            )}
            {apiKeys.map(k => (
              <div
                key={k.id}
                className="card"
                style={{
                  padding: '16px 20px',
                  opacity: k.is_active ? 1 : 0.55,
                  borderLeft: '3px solid var(--blue)',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {k.label}
                    </div>
                    {!k.is_active && <span className="badge badge-gray">Disabled</span>}
                    {k.usage_pct >= 80 && <span className="badge badge-red" style={{ marginLeft: 4 }}>⚠ High Usage</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => toggleApiKey(k.id)} title={k.is_active ? 'Disable' : 'Enable'}
                      style={{ background: 'none', border: '1px solid var(--border-1)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                      {k.is_active ? <Pause size={12} /> : <Play size={12} />}
                    </button>
                    <button onClick={() => resetApiKey(k.id)} title="Reset quota"
                      style={{ background: 'none', border: '1px solid var(--border-1)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                      <RefreshCw size={12} />
                    </button>
                    <button onClick={() => deleteApiKey(k.id)} title="Remove key"
                      style={{ background: 'var(--red-dim)', border: '1px solid rgba(255,45,85,0.15)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--red)' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Masked Key */}
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)',
                  background: 'var(--bg-elevated)', padding: '6px 10px', borderRadius: 6, marginBottom: 12,
                  letterSpacing: '0.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {k.api_key_masked}
                </div>

                {/* Quota usage */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Quota Used</span>
                    <span style={{
                      fontWeight: 700, fontFamily: 'monospace',
                      color: k.usage_pct > 80 ? 'var(--red)' : k.usage_pct > 60 ? 'var(--orange)' : 'var(--green)',
                    }}>
                      {k.units_used.toLocaleString()} / {k.units_limit.toLocaleString()} ({k.usage_pct}%)
                    </span>
                  </div>
                  <UsageBar pct={k.usage_pct} color="var(--blue)" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Resets: {k.reset_date}
                    </span>
                    {k.last_used_at && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Last: {fmtRelative(k.last_used_at)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: BRANDS & PRODUCTS ── */}
      {tab === 'brands' && (
        <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
          {/* Create Brand panel */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>Manage Campaign Brands</div>
            <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5, marginBottom: 16 }}>
              Define brands and product keywords for this campaign. The scraper will automatically scan video titles and channels for these brand tags.
            </p>

            {selectedCampaign ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Brand/Product Name</label>
                  <input
                    className="input"
                    placeholder="e.g. Atomberg"
                    value={newBrandName}
                    onChange={e => setNewBrandName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && createBrand()}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Type</label>
                  <select
                    className="input"
                    value={newBrandType}
                    onChange={e => setNewBrandType(e.target.value as 'own' | 'competitor')}
                  >
                    <option value="own">Own Brand/Product</option>
                    <option value="competitor">Competitor Brand/Product</option>
                  </select>
                </div>
                <button className="btn btn-blue" onClick={createBrand} style={{ marginTop: 6 }}>
                  <Plus size={14} /> Add Brand Tag
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#EF4444', fontWeight: 600 }}>Please select or create a campaign first from the left menu on the Campaigns & Keywords tab.</div>
            )}
          </div>

          {/* Brands list */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Registered Brand Tags ({brands.length})</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Brand/Product Name</th>
                    <th>Type</th>
                    <th style={{ textAlign: 'right' }}>Tracked Videos</th>
                    <th style={{ textAlign: 'right' }}>Views Sum</th>
                    <th style={{ textAlign: 'right' }}>SOV Share</th>
                    <th style={{ width: 60, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {brands.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#CBD5E1', fontSize: 13 }}>
                        No brand tags defined yet. Add one in the left panel!
                      </td>
                    </tr>
                  ) : (
                    brands.map(b => (
                      <tr key={b.id}>
                        <td style={{ fontWeight: 700, color: '#0F172A' }}>{b.name}</td>
                        <td>
                          <span className={`badge ${b.type === 'own' ? 'badge-blue' : 'badge-orange'}`}>
                            {b.type === 'own' ? 'Own Brand' : 'Competitor'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{b.video_count} videos</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(b.total_views ?? 0)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#1A73E8' }}>{b.sov_percent?.toFixed(1)}%</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => deleteBrand(b.id)}
                            style={{
                              background: 'var(--red-dim)',
                              border: '1px solid rgba(255,45,85,0.15)',
                              borderRadius: 6,
                              padding: '5px 8px',
                              cursor: 'pointer',
                              color: 'var(--red)',
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: CLIENT LOGINS ── */}
      {tab === 'users' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
          {/* Create User panel */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>Create Client Account</div>
            <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5, marginBottom: 16 }}>
              Add a brand login credential. Assigned users can access their master dashboard with limited scoping.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Email Address</label>
                <input
                  type="email"
                  className="input"
                  placeholder="e.g. client@brand.com"
                  value={newUser.email}
                  onChange={e => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Password</label>
                <input
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  value={newUser.password}
                  onChange={e => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>System Role</label>
                <select
                  className="input"
                  value={newUser.role}
                  onChange={e => setNewUser(prev => ({ ...prev, role: e.target.value as 'admin' | 'brand' }))}
                >
                  <option value="brand">Brand Client (Restricted)</option>
                  <option value="admin">Administrator (Full Access)</option>
                </select>
              </div>

              {newUser.role === 'brand' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Assigned Campaign</label>
                    <select
                      className="input"
                      value={newUser.campaign_id}
                      onChange={e => {
                        const val = e.target.value
                        setNewUser(prev => ({ ...prev, campaign_id: val, brand_name: '' }))
                      }}
                    >
                      <option value="">-- Select Campaign --</option>
                      {campaigns.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {newUser.campaign_id && (
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Assigned Brand</label>
                      <input
                        className="input"
                        placeholder="e.g. Atomberg (exact match tag)"
                        value={newUser.brand_name}
                        onChange={e => setNewUser(prev => ({ ...prev, brand_name: e.target.value }))}
                      />
                    </div>
                  )}
                </>
              )}

              <button className="btn btn-blue" onClick={createUser} style={{ marginTop: 6 }}>
                <Plus size={14} /> Register Login Account
              </button>
            </div>
          </div>

          {/* Users List */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Registered Dashboard Logins ({users.length})</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Email Address</th>
                    <th>Role</th>
                    <th>Scope Restriction</th>
                    <th style={{ width: 60, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: '#CBD5E1', fontSize: 13 }}>
                        No login credentials registered yet. Register one in the left panel!
                      </td>
                    </tr>
                  ) : (
                    users.map(u => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 700, color: '#0F172A' }}>{u.email}</td>
                        <td>
                          <span className={`badge ${u.role === 'admin' ? 'badge-blue' : 'badge-gray'}`}>
                            {u.role === 'admin' ? 'Admin' : 'Brand Client'}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: '#64748B' }}>
                          {u.role === 'admin' ? (
                            <span style={{ color: '#10B981', fontWeight: 600 }}>Unrestricted (All Campaigns)</span>
                          ) : u.campaign_name && u.brand_name ? (
                            <span>Campaign: <strong>{u.campaign_name}</strong> Brand: <strong>{u.brand_name}</strong></span>
                          ) : (
                            <span style={{ color: '#EF4444' }}>Unassigned brand or campaign</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => deleteUser(u.id, u.email)}
                            style={{
                              background: 'var(--red-dim)',
                              border: '1px solid rgba(255,45,85,0.15)',
                              borderRadius: 6,
                              padding: '5px 8px',
                              cursor: 'pointer',
                              color: 'var(--red)',
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: BACKUP
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'backup' && (
        <BackupTab toast={toast} setToast={setToast} />
      )}

      {/* ── Toast ── */}
      {toast && (
        <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}

// ── Backup Tab Component ───────────────────────────────────────────────────
function BackupTab({ toast, setToast }: { toast: any; setToast: (t: any) => void }) {
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/sync')
      const data = await res.json()
      setSyncStatus(data)
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/sync', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setToast({ msg: `Synced ${data.rowsWritten} rows across ${data.sheetsUpdated.length} sheets`, type: 'success' })
        fetchStatus()
      } else {
        setToast({ msg: data.error || 'Sync failed', type: 'error' })
      }
    } catch {
      setToast({ msg: 'Sync failed — network error', type: 'error' })
    } finally { setSyncing(false) }
  }

  if (loading) return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, color: 'var(--text-muted)' }}>
      <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} /> Loading…
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 600 }}>
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Google Sheets Backup</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Export all database tables to Google Sheets</div>
          </div>
          <button className="btn btn-primary" onClick={handleSync} disabled={syncing} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {syncing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />}
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>

        {syncStatus && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ padding: '8px 14px', borderRadius: 8, background: syncStatus.configured ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${syncStatus.configured ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, fontSize: 12, fontWeight: 600 }}>
                <span style={{ color: syncStatus.configured ? '#16A34A' : '#DC2626' }}>{syncStatus.configured ? '● Configured' : '● Not Configured'}</span>
              </div>
              <div style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-1)', fontSize: 12, color: 'var(--text-muted)' }}>
                Last sync: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{syncStatus.lastSyncAt ? fmtRelative(syncStatus.lastSyncAt) : 'Never'}</span>
              </div>
            </div>
            {syncStatus.lastSync && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-1)' }}>
                Last sync: {syncStatus.lastSync.total_rows} rows across {syncStatus.lastSync.sheets}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)' }}>Sheets Included</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6 }}>
          {['Campaigns', 'Keywords', 'Videos', 'Brand Tags', 'SOV Daily', 'Rankings', 'Brand Analysis', 'Quota Usage'].map(name => (
            <div key={name} style={{ padding: '6px 10px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-1)', fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', textAlign: 'center' }}>
              {name}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
