'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Settings as SettingsIcon, Shield, Key, Globe, BookOpen, Bell,
  Plus, Trash2, X, Check, Loader2, AlertTriangle, CheckCircle, XCircle,
  Users, Tag, Hash, BarChart3, Copy, Eye, EyeOff, RefreshCw,
  ToggleLeft, ToggleRight, Webhook, Mail, Zap,   FolderKanban,
} from 'lucide-react'
import { AMAZON_INDIA_CATEGORIES } from '@/lib/amazon-india'

type SettingsTab = 'general' | 'projects' | 'access' | 'api-keys' | 'users' | 'backup' | 'alerts'

interface AppSettings {
  app_name?: string
  app_tagline?: string
  timezone?: string
  date_format?: string
  items_per_page?: number
  auto_refresh_interval?: number
  default_currency?: string
}

interface AlertRule {
  id: string
  campaign_id: string
  campaign_name?: string
  brand_name: string
  metric: 'sov_percent' | 'view_growth' | 'frequency_growth'
  threshold: number
  direction: 'above' | 'below'
  webhook_url: string | null
  email: string | null
  is_active: boolean
  last_triggered_at: string | null
  created_at: string
}

const SETTINGS_NAV: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'general', label: 'General', icon: <SettingsIcon size={15} /> },
  { id: 'projects', label: 'Projects', icon: <FolderKanban size={15} /> },
  { id: 'access', label: 'Access Control', icon: <Shield size={15} /> },
  { id: 'api-keys', label: 'API Keys', icon: <Key size={15} /> },
  { id: 'users', label: 'Client Logins', icon: <Globe size={15} /> },
  { id: 'backup', label: 'Backup & Sync', icon: <BookOpen size={15} /> },
  { id: 'alerts', label: 'Alerts', icon: <Bell size={15} /> },
]

const METRIC_LABELS: Record<string, string> = {
  sov_percent: 'SOV %',
  view_growth: 'View Growth',
  frequency_growth: 'Frequency Growth',
}

const TAB_ICONS: Record<string, React.ReactNode> = {
  general: <SettingsIcon size={13} />,
  projects: <FolderKanban size={13} />,
  access: <Shield size={13} />,
  'api-keys': <Key size={13} />,
  users: <Globe size={13} />,
  backup: <BookOpen size={13} />,
  alerts: <Bell size={13} />,
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
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FFF', padding: 2 }}><X size={14} /></button>
    </div>
  )
}

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('general')
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null)
  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => setToast({ msg, type }), [])

  // ═══ General Settings ═══
  const [appSettings, setAppSettings] = useState<AppSettings>({})
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)

  // ═══ API Keys ═══
  const [apiKeys, setApiKeys] = useState<any[]>([])
  const [apiKeyStats, setApiKeyStats] = useState<any>(null)
  const [showAddKey, setShowAddKey] = useState(false)
  const [newKey, setNewKey] = useState({ label: '', api_key: '', units_limit: '10000' })
  const [keyVisible, setKeyVisible] = useState<Record<string, boolean>>({})

  // ═══ Users ═══
  const [users, setUsers] = useState<any[]>([])
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'brand' as 'admin' | 'brand', campaign_id: '', brand_name: '' })

  // ═══ Access Control ═══
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [memberCampaignId, setMemberCampaignId] = useState('')

  // ═══ Backup ═══
  const [syncStatus, setSyncStatus] = useState<any>(null)
  const [syncing, setSyncing] = useState(false)

  // ═══ Projects ═══
  const [editingProject, setEditingProject] = useState<any | null>(null)
  const [editForm, setEditForm] = useState({ name: '', category: '', sub_category: '', description: '', status: 'active' })
  const [editCatId, setEditCatId] = useState('')
  const [editSubCatId, setEditSubCatId] = useState('')
  const [savingProject, setSavingProject] = useState(false)
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<any | null>(null)
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState('')
  const [deletingProject, setDeletingProject] = useState(false)

  // ═══ Alerts ═══
  const [alertRules, setAlertRules] = useState<AlertRule[]>([])
  const [showAddAlert, setShowAddAlert] = useState(false)
  const [newAlert, setNewAlert] = useState({ campaign_id: '', brand_name: '', metric: 'sov_percent' as AlertRule['metric'], threshold: '10', direction: 'above' as 'above' | 'below', email: '', webhook_url: '' })

  // ── Fetch all data ──
  useEffect(() => {
    fetchSettings()
    fetchApiKeys()
    fetchUsers()
    fetchAlerts()
    fetchCampaigns()
    fetchSyncStatus()
  }, [])

  const fetchSettings = async () => {
    setSettingsLoading(true)
    try {
      const r = await fetch('/api/settings')
      const d = await r.json()
      setAppSettings(d.settings || {})
    } catch {} finally { setSettingsLoading(false) }
  }

  const saveSettings = async () => {
    setSettingsSaving(true)
    try {
      const r = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appSettings),
      })
      if (!r.ok) throw new Error()
      showToast('Settings saved')
    } catch { showToast('Failed to save settings', 'error') } finally { setSettingsSaving(false) }
  }

  const fetchApiKeys = async () => {
    try {
      const r = await fetch('/api/api-keys')
      const d = await r.json()
      setApiKeys(d.keys ?? [])
      setApiKeyStats(d.stats ?? null)
    } catch {}
  }

  const addApiKey = async () => {
    if (!newKey.api_key.trim()) return showToast('API key required', 'error')
    try {
      const r = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newKey.label, api_key: newKey.api_key, units_limit: parseInt(newKey.units_limit) || 10000 }),
      })
      if (!r.ok) { const d = await r.json(); return showToast(d.error || 'Failed', 'error') }
      setShowAddKey(false); setNewKey({ label: '', api_key: '', units_limit: '10000' })
      await fetchApiKeys()
      showToast('API key added')
    } catch { showToast('Failed', 'error') }
  }

  const toggleKey = async (id: string) => {
    try { await fetch('/api/api-keys', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'toggle' }) }); await fetchApiKeys() } catch {}
  }

  const resetKey = async (id: string) => {
    try { await fetch('/api/api-keys', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'reset' }) }); await fetchApiKeys(); showToast('Quota reset') } catch {}
  }

  const deleteKey = async (id: string) => {
    if (!confirm('Remove this API key?')) return
    try { await fetch(`/api/api-keys?id=${id}`, { method: 'DELETE' }); await fetchApiKeys(); showToast('Key removed') } catch {}
  }

  const fetchUsers = async () => {
    try { const r = await fetch('/api/users'); const d = await r.json(); setUsers(d.users ?? []) } catch {}
  }

  const createUser = async () => {
    if (!newUser.email.trim() || !newUser.password.trim()) return showToast('Email and password required', 'error')
    try {
      const r = await fetch('/api/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      })
      const d = await r.json()
      if (!r.ok) return showToast(d.error || 'Failed', 'error')
      setNewUser({ email: '', password: '', role: 'brand', campaign_id: '', brand_name: '' })
      await fetchUsers()
      showToast('User created')
    } catch { showToast('Failed', 'error') }
  }

  const deleteUser = async (id: string, email: string) => {
    if (!confirm(`Delete "${email}"?`)) return
    try { await fetch(`/api/users?id=${id}`, { method: 'DELETE' }); await fetchUsers(); showToast('User deleted') } catch { showToast('Failed', 'error') }
  }

  const fetchCampaigns = async () => {
    try { const r = await fetch('/api/campaigns'); const d = await r.json(); setCampaigns(d.campaigns ?? []) } catch {}
  }

  const openEditProject = (p: any) => {
    const cat = AMAZON_INDIA_CATEGORIES.find(c => c.name === p.category)
    const sub = cat?.subCategories.find(s => s.name === p.sub_category)
    setEditForm({ name: p.name, category: p.category || '', sub_category: p.sub_category || '', description: p.description || '', status: p.status || 'active' })
    setEditCatId(cat?.id || '')
    setEditSubCatId(sub?.id || '')
    setEditingProject(p)
  }

  const saveProject = async () => {
    if (!editingProject || !editForm.name.trim()) return showToast('Project name required', 'error')
    setSavingProject(true)
    const catName = editCatId ? AMAZON_INDIA_CATEGORIES.find(c => c.id === editCatId)?.name || editForm.category : editForm.category
    const subName = editSubCatId && editCatId ? AMAZON_INDIA_CATEGORIES.find(c => c.id === editCatId)?.subCategories.find(s => s.id === editSubCatId)?.name || editForm.sub_category : editForm.sub_category
    try {
      const r = await fetch(`/api/campaigns/${editingProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, category: catName, sub_category: subName }),
      })
      if (!r.ok) throw new Error()
      setEditingProject(null); await fetchCampaigns(); showToast('Project updated')
    } catch { showToast('Failed to save', 'error') } finally { setSavingProject(false) }
  }

  const confirmDeleteProject = async () => {
    if (!deleteProjectTarget) return
    if (deleteProjectConfirm !== deleteProjectTarget.name) return showToast('Type the project name to confirm', 'error')
    setDeletingProject(true)
    try {
      await fetch(`/api/campaigns/${deleteProjectTarget.id}`, { method: 'DELETE' })
      setDeleteProjectTarget(null); setDeleteProjectConfirm(''); await fetchCampaigns(); showToast('Project deleted')
    } catch { showToast('Delete failed', 'error') } finally { setDeletingProject(false) }
  }

  const fetchMembers = async (campaignId: string) => {
    if (!campaignId) { setMembers([]); return }
    try { const r = await fetch(`/api/workspace/members?campaign_id=${campaignId}`); const d = await r.json(); setMembers(d.members ?? []) } catch {}
  }

  const fetchSyncStatus = async () => {
    try { const r = await fetch('/api/sync'); const d = await r.json(); setSyncStatus(d) } catch {}
  }

  const runSync = async () => {
    setSyncing(true)
    try { const r = await fetch('/api/sync', { method: 'POST' }); const d = await r.json(); showToast(d.message || 'Sync completed'); await fetchSyncStatus() } catch { showToast('Sync failed', 'error') } finally { setSyncing(false) }
  }

  const fetchAlerts = async () => {
    try { const r = await fetch('/api/alerts'); const d = await r.json(); setAlertRules(d.rules ?? []) } catch {}
  }

  const addAlert = async () => {
    if (!newAlert.campaign_id || !newAlert.threshold) return showToast('Campaign and threshold required', 'error')
    try {
      const r = await fetch('/api/alerts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newAlert, threshold: parseFloat(newAlert.threshold) }),
      })
      if (!r.ok) throw new Error()
      setShowAddAlert(false); setNewAlert({ campaign_id: '', brand_name: '', metric: 'sov_percent', threshold: '10', direction: 'above', email: '', webhook_url: '' })
      await fetchAlerts()
      showToast('Alert rule created')
    } catch { showToast('Failed', 'error') }
  }

  const toggleAlert = async (id: string, is_active: boolean) => {
    try { await fetch('/api/alerts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_active: !is_active }) }); await fetchAlerts() } catch {}
  }

  const deleteAlert = async (id: string) => {
    if (!confirm('Delete this alert rule?')) return
    try { await fetch(`/api/alerts?id=${id}`, { method: 'DELETE' }); await fetchAlerts(); showToast('Alert deleted') } catch { showToast('Failed', 'error') }
  }

  const sectionTitle = (label: string) => (
    <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>
      {TAB_ICONS[tab]} {label}
    </div>
  )

  const sectionDesc = (text: string) => (
    <p style={{ fontSize: 12.5, color: '#64748B', marginBottom: 20, fontWeight: 500 }}>{text}</p>
  )

  const labelStyle = { display: 'block', fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.6px', marginBottom: 5 }

  return (
    <div className="anim-fade-up" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure your workspace, manage access, and customize alerts</p>
        </div>
      </div>

      {/* Main Layout: Sidebar + Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, alignItems: 'start' }}>
        {/* ── Settings Nav ── */}
        <div className="card" style={{ padding: 8, position: 'sticky', top: 20 }}>
          {SETTINGS_NAV.map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '8px 12px', border: 'none',
                borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                background: tab === item.id ? 'rgba(245,130,32,0.08)' : 'transparent',
                color: tab === item.id ? '#F58220' : '#475569',
                fontWeight: tab === item.id ? 700 : 500,
                fontSize: 12.5, transition: 'all 0.12s',
              }}
              onMouseEnter={e => { if (tab !== item.id) { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#0F172A' } }}
              onMouseLeave={e => { if (tab !== item.id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#475569' } }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        {/* ── Active Section ── */}
        <div>
          {/* ═══════════════════════════════════════
              GENERAL SETTINGS
          ═══════════════════════════════════════ */}
          {tab === 'general' && (
            <div className="card">
              {sectionTitle('General Settings')}
              {sectionDesc('Configure global application preferences and defaults')}

              {settingsLoading ? (
                <div style={{ textAlign: 'center', padding: 32 }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: '#94A3B8' }} /></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={labelStyle}>Application Name</label>
                      <input className="input" value={appSettings.app_name || ''} onChange={e => setAppSettings(p => ({ ...p, app_name: e.target.value }))} placeholder="SOV Panel" style={{ height: 38, fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={labelStyle}>Tagline</label>
                      <input className="input" value={appSettings.app_tagline || ''} onChange={e => setAppSettings(p => ({ ...p, app_tagline: e.target.value }))} placeholder="YouTube Share-of-Voice Analytics" style={{ height: 38, fontSize: 13 }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={labelStyle}>Timezone</label>
                      <select className="input" value={appSettings.timezone || 'UTC'} onChange={e => setAppSettings(p => ({ ...p, timezone: e.target.value }))} style={{ height: 38, fontSize: 13 }}>
                        {['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney'].map(tz => (
                          <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Date Format</label>
                      <select className="input" value={appSettings.date_format || 'MMM DD, YYYY'} onChange={e => setAppSettings(p => ({ ...p, date_format: e.target.value }))} style={{ height: 38, fontSize: 13 }}>
                        <option value="MMM DD, YYYY">Jan 15, 2026</option>
                        <option value="DD/MM/YYYY">15/01/2026</option>
                        <option value="YYYY-MM-DD">2026-01-15</option>
                        <option value="MM/DD/YYYY">01/15/2026</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Items Per Page</label>
                      <select className="input" value={appSettings.items_per_page || 25} onChange={e => setAppSettings(p => ({ ...p, items_per_page: parseInt(e.target.value) }))} style={{ height: 38, fontSize: 13 }}>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ paddingTop: 12, borderTop: '1.5px solid rgba(26,115,232,0.06)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-blue btn-sm" onClick={saveSettings} disabled={settingsSaving}>
                      {settingsSaving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
                      Save Settings
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════
              ACCESS CONTROL
          ═══════════════════════════════════════ */}
          {tab === 'access' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card">
                {sectionTitle('Access Control')}
                {sectionDesc('Manage project-level membership and role-based permissions')}

                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Select Project</label>
                  <select className="input" value={memberCampaignId} onChange={e => { setMemberCampaignId(e.target.value); if (e.target.value) fetchMembers(e.target.value) }} style={{ height: 38, fontSize: 13, maxWidth: 320 }}>
                    <option value="">-- Select Project --</option>
                    {campaigns.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                {memberCampaignId ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Role</th>
                          <th>Page Access</th>
                          <th>Joined</th>
                          <th style={{ width: 60, textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.length === 0 ? (
                          <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#CBD5E1', fontSize: 13 }}>No members in this project.</td></tr>
                        ) : members.map((m: any) => (
                          <tr key={m.user_id}>
                            <td style={{ fontWeight: 600, color: '#0F172A' }}>{m.email}</td>
                            <td>
                              <select value={m.role} style={{
                                padding: '3px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 700,
                                border: '1.5px solid rgba(26,115,232,0.1)', background: '#FFF', cursor: 'pointer', fontFamily: 'inherit',
                                color: m.role === 'owner' ? '#00C853' : m.role === 'admin' ? '#1A73E8' : m.role === 'editor' ? '#7C3AED' : '#64748B',
                              }} disabled={m.role === 'owner'}>
                                <option value="owner" disabled>Owner</option>
                                <option value="admin">Admin</option>
                                <option value="editor">Editor</option>
                                <option value="viewer">Viewer</option>
                              </select>
                            </td>
                            <td style={{ fontSize: 11, color: '#64748B' }}>
                              {m.role === 'owner' ? 'Everything' : m.role === 'admin' ? 'Manage + Edit' : m.role === 'editor' ? 'Edit Content' : 'View Only'}
                            </td>
                            <td style={{ fontSize: 12, color: '#64748B' }}>{new Date(m.joined_at).toLocaleDateString()}</td>
                            <td style={{ textAlign: 'center' }}>
                              {m.role !== 'owner' && (
                                <button onClick={() => {
                                  if (!confirm(`Remove ${m.email}?`)) return
                                  fetch(`/api/workspace/members?campaign_id=${memberCampaignId}&user_id=${m.user_id}`, { method: 'DELETE' })
                                    .then(() => { fetchMembers(memberCampaignId); showToast('Member removed') })
                                    .catch(() => showToast('Failed', 'error'))
                                }} style={{ background: '#FEF2F2', border: '1.5px solid rgba(255,45,85,0.1)', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', color: '#EF4444', display: 'inline-flex', alignItems: 'center' }}>
                                  <Trash2 size={11} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: 32, color: '#94A3B8', fontSize: 13 }}>Select a project to manage its members.</div>
                )}
              </div>

              {/* Permissions Matrix */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1.5px solid rgba(26,115,232,0.06)' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Role Permissions</span>
                  <span style={{ fontSize: 11, color: '#64748B', marginLeft: 8, fontWeight: 500 }}>What each role can access</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ minWidth: 580 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 200 }}>Page / Feature</th>
                        <th style={{ textAlign: 'center' }}>Owner</th>
                        <th style={{ textAlign: 'center' }}>Admin</th>
                        <th style={{ textAlign: 'center' }}>Editor</th>
                        <th style={{ textAlign: 'center' }}>Viewer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { feature: 'Overview Dashboard', o: true, a: true, e: true, v: true },
                        { feature: 'Top Videos / Leaderboard', o: true, a: true, e: true, v: true },
                        { feature: 'Brand Growth', o: true, a: true, e: true, v: true },
                        { feature: 'SOV Trend', o: true, a: true, e: true, v: true },
                        { feature: 'Keyword SOV', o: true, a: true, e: true, v: true },
                        { feature: 'All Brands', o: true, a: true, e: true, v: true },
                        { feature: 'Multi-Keyword', o: true, a: true, e: true, v: true },
                        { feature: 'Add / Edit Keywords', o: true, a: true, e: true, v: false },
                        { feature: 'Add / Edit Brands', o: true, a: true, e: true, v: false },
                        { feature: 'Campaign Control Center', o: true, a: true, e: false, v: false },
                        { feature: 'Manage Project Access', o: true, a: true, e: false, v: false },
                        { feature: 'Manage API Keys', o: true, a: false, e: false, v: false },
                        { feature: 'Settings & Alerts', o: true, a: false, e: false, v: false },
                        { feature: 'Delete Project', o: true, a: false, e: false, v: false },
                        { feature: 'Backup & Sync', o: true, a: false, e: false, v: false },
                      ].map(row => (
                        <tr key={row.feature}>
                          <td style={{ fontSize: 12.5, fontWeight: 600, color: '#0F172A' }}>{row.feature}</td>
                          {['o', 'a', 'e', 'v'].map(k => (
                            <td key={k} style={{ textAlign: 'center' }}>
                              {(row as any)[k]
                                ? <Check size={13} style={{ color: '#00C853' }} />
                                : <X size={13} style={{ color: '#CBD5E1' }} />
                              }
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════
              API KEYS
          ═══════════════════════════════════════ */}
          {tab === 'api-keys' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Stats strip */}
              {apiKeyStats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                  {[
                    { label: 'Total Keys', value: apiKeyStats.total, color: '#1A73E8' },
                    { label: 'Active', value: apiKeyStats.active, color: '#00C853' },
                    { label: 'Used Units', value: (apiKeyStats.total_used || 0).toLocaleString(), color: '#7C3AED' },
                    { label: 'Capacity', value: (apiKeyStats.total_capacity || 0).toLocaleString(), color: '#FF6D00' },
                  ].map(s => (
                    <div key={s.label} className="card" style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
                      <div style={{ fontSize: 10.5, fontWeight: 600, color: '#64748B', marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1.5px solid rgba(26,115,232,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>API Keys ({apiKeys.length})</span>
                  <button className="btn btn-blue btn-sm" onClick={() => setShowAddKey(true)}><Plus size={12} /> Add Key</button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Label</th>
                        <th>Key</th>
                        <th>Status</th>
                        <th>Usage</th>
                        <th>Bucket</th>
                        <th style={{ width: 100, textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apiKeys.length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#CBD5E1', fontSize: 13 }}>No API keys configured.</td></tr>
                      ) : apiKeys.map((k: any) => (
                        <tr key={k.id}>
                          <td style={{ fontWeight: 600 }}>{k.label}</td>
                          <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                            {keyVisible[k.id] ? k.api_key_masked : k.api_key_masked.slice(0, 12) + '••••••••'}
                            <button onClick={() => setKeyVisible(p => ({ ...p, [k.id]: !p[k.id] }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', marginLeft: 6, verticalAlign: 'middle' }}>
                              {keyVisible[k.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                          </td>
                          <td>
                            <span className={`badge ${k.is_active ? 'badge-green' : 'badge-gray'}`}>
                              {k.is_active ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                          <td style={{ minWidth: 140 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 5, borderRadius: 99, background: '#E2E8F0', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.min(k.usage_pct, 100)}%`, height: '100%', borderRadius: 99, background: k.usage_pct > 80 ? '#FF2D55' : k.usage_pct > 60 ? '#FF6D00' : '#00C853' }} />
                              </div>
                              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace" }}>
                                {k.usage_pct}%
                              </span>
                            </div>
                          </td>
                          <td style={{ fontSize: 12 }}>Bucket {k.bucket}</td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                              <button onClick={() => toggleKey(k.id)} className="btn btn-xs btn-ghost" style={{ padding: '3px 7px', fontSize: 10 }} title={k.is_active ? 'Disable' : 'Enable'}>
                                {k.is_active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                              </button>
                              <button onClick={() => resetKey(k.id)} className="btn btn-xs btn-ghost" style={{ padding: '3px 7px', fontSize: 10 }} title="Reset quota">
                                <RefreshCw size={11} />
                              </button>
                              <button onClick={() => deleteKey(k.id)} className="btn btn-xs btn-danger" style={{ padding: '3px 7px', fontSize: 10 }}>
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add Key Modal */}
              {showAddKey && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
                  <div className="card" style={{ maxWidth: 460, width: '100%', padding: 24, position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #F58220, #FF9F43, transparent)', borderRadius: '14px 14px 0 0' }} />
                    <button onClick={() => setShowAddKey(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(26,115,232,0.04)', border: '1.5px solid rgba(26,115,232,0.08)', borderRadius: 8, cursor: 'pointer', color: '#94A3B8', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} /></button>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: '0 0 16px' }}>Add YouTube API Key</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <label style={labelStyle}>Label</label>
                        <input className="input" value={newKey.label} onChange={e => setNewKey(p => ({ ...p, label: e.target.value }))} placeholder="e.g. Main Key Bucket 1" style={{ height: 38, fontSize: 13 }} />
                      </div>
                      <div>
                        <label style={labelStyle}>API Key</label>
                        <input className="input" value={newKey.api_key} onChange={e => setNewKey(p => ({ ...p, api_key: e.target.value }))} placeholder="AIza..." style={{ height: 38, fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }} />
                      </div>
                      <div>
                        <label style={labelStyle}>Daily Quota Limit</label>
                        <input className="input" type="number" value={newKey.units_limit} onChange={e => setNewKey(p => ({ ...p, units_limit: e.target.value }))} style={{ height: 38, fontSize: 13 }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                      <button className="btn btn-blue btn-sm" onClick={addApiKey} style={{ flex: 1 }}><Check size={13} /> Add Key</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setShowAddKey(false)} style={{ flex: 1 }}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════
              CLIENT LOGINS
          ═══════════════════════════════════════ */}
          {tab === 'users' && (
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>
              <div className="card" style={{ padding: 18 }}>
                {sectionTitle('Create Login')}
                {sectionDesc('Register a new dashboard user account')}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Email</label>
                    <input className="input" type="email" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} placeholder="user@company.com" style={{ height: 36, fontSize: 12.5 }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Password</label>
                    <input className="input" type="password" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" style={{ height: 36, fontSize: 12.5 }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Role</label>
                    <select className="input" value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value as 'admin' | 'brand' }))} style={{ height: 36, fontSize: 12.5 }}>
                      <option value="brand">Brand Client (restricted)</option>
                      <option value="admin">Administrator (full access)</option>
                    </select>
                  </div>
                  <button className="btn btn-blue btn-sm" onClick={createUser} style={{ width: '100%' }}><Plus size={12} /> Register Account</button>
                </div>
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1.5px solid rgba(26,115,232,0.06)' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Registered Users ({users.length})</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Scope</th>
                        <th style={{ width: 60, textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.length === 0 ? (
                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: '#CBD5E1', fontSize: 13 }}>No users registered.</td></tr>
                      ) : users.map((u: any) => (
                        <tr key={u.id}>
                          <td style={{ fontWeight: 600, color: '#0F172A' }}>{u.email}</td>
                          <td><span className={`badge ${u.role === 'admin' ? 'badge-blue' : 'badge-purple'}`}>{u.role}</span></td>
                          <td style={{ fontSize: 12, color: '#64748B' }}>{u.campaign_name || u.brand_name || 'All'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <button onClick={() => deleteUser(u.id, u.email)} className="btn btn-xs btn-danger" style={{ padding: '3px 7px' }}><Trash2 size={11} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════
              BACKUP & SYNC
          ═══════════════════════════════════════ */}
          {tab === 'backup' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card">
                {sectionTitle('Backup & Sync')}
                {sectionDesc('Sync campaign data to Google Sheets for external backup and reporting')}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                  <div style={{ padding: 16, borderRadius: 10, background: syncStatus?.configured ? 'rgba(0,200,83,0.04)' : '#FFF8F0', border: `1.5px solid ${syncStatus?.configured ? 'rgba(0,200,83,0.15)' : 'rgba(255,109,0,0.15)'}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: syncStatus?.configured ? '#00C853' : '#FF6D00', marginBottom: 4 }}>
                      {syncStatus?.configured ? 'Connected' : 'Not Configured'}
                    </div>
                    <div style={{ fontSize: 12.5, color: '#64748B' }}>
                      {syncStatus?.configured ? 'Google Sheets integration is active' : 'Set up GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY'}
                    </div>
                  </div>
                  <div style={{ padding: 16, borderRadius: 10, background: 'rgba(26,115,232,0.04)', border: '1.5px solid rgba(26,115,232,0.1)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#1A73E8', marginBottom: 4 }}>Last Sync</div>
                    <div style={{ fontSize: 12.5, color: '#64748B' }}>
                      {syncStatus?.lastSyncAt ? new Date(syncStatus.lastSyncAt).toLocaleString() : 'Never'}
                    </div>
                  </div>
                </div>

                <button className="btn btn-blue btn-sm" onClick={runSync} disabled={syncing || !syncStatus?.configured}>
                  {syncing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </button>
              </div>

              <div className="card">
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Data Export</div>
                <p style={{ fontSize: 12.5, color: '#64748B', marginBottom: 16, fontWeight: 500 }}>Export raw data for offline analysis</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-ghost btn-sm" disabled>Export Campaigns (CSV)</button>
                  <button className="btn btn-ghost btn-sm" disabled>Export Keywords (CSV)</button>
                  <button className="btn btn-ghost btn-sm" disabled>Export Rankings (CSV)</button>
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 10, fontWeight: 500 }}>CSV export coming soon</div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════
              PROJECTS
          ═══════════════════════════════════════ */}
          {tab === 'projects' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1.5px solid rgba(26,115,232,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>All Projects</span>
                    <span style={{ fontSize: 11, color: '#64748B', marginLeft: 8, fontWeight: 500 }}>{campaigns.length} total</span>
                  </div>
                </div>
                <div style={{ overflowX: 'auto', maxHeight: 500, overflowY: 'auto' }}>
                  <table className="data-table" style={{ position: 'relative' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#FFF', zIndex: 2 }}>
                      <tr>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Subcategory</th>
                        <th>Keywords</th>
                        <th>Status</th>
                        <th style={{ width: 110, textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#CBD5E1', fontSize: 13 }}>No projects yet.</td></tr>
                      ) : campaigns.map((p: any) => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 600, color: '#0F172A' }}>{p.name}</td>
                          <td style={{ fontSize: 12.5, color: '#475569' }}>{p.category || <span style={{ color: '#CBD5E1' }}>—</span>}</td>
                          <td style={{ fontSize: 12.5, color: '#475569' }}>{p.sub_category || <span style={{ color: '#CBD5E1' }}>—</span>}</td>
                          <td style={{ fontSize: 12.5 }}>{p.keyword_count ?? 0}</td>
                          <td><span className={`badge ${p.status === 'active' ? 'badge-green' : 'badge-gray'}`}>{p.status}</span></td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                              <button onClick={() => openEditProject(p)} className="btn btn-xs btn-ghost" style={{ padding: '3px 7px', fontSize: 10 }} title="Edit">
                                <SettingsIcon size={11} />
                              </button>
                              <button onClick={() => setDeleteProjectTarget(p)} className="btn btn-xs btn-danger" style={{ padding: '3px 7px', fontSize: 10 }} title="Delete">
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Edit Project Modal */}
              {editingProject && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
                  <div className="card" style={{ maxWidth: 520, width: '100%', padding: 24, position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #F58220, #FF9F43, transparent)', borderRadius: '14px 14px 0 0' }} />
                    <button onClick={() => setEditingProject(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(26,115,232,0.04)', border: '1.5px solid rgba(26,115,232,0.08)', borderRadius: 8, cursor: 'pointer', color: '#94A3B8', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} /></button>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: '0 0 16px' }}>Edit Project</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <label style={labelStyle}>Project Name</label>
                        <input className="input" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} style={{ height: 38, fontSize: 13 }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={labelStyle}>Category</label>
                          <select value={editCatId} onChange={e => { setEditCatId(e.target.value); setEditSubCatId('') }} style={{ height: 38, fontSize: 13, padding: '6px 12px', border: '1.5px solid rgba(26,115,232,0.12)', borderRadius: 9, background: '#FFF', fontFamily: 'inherit', color: '#0F172A', cursor: 'pointer', width: '100%' }}>
                            <option value="">— None —</option>
                            {AMAZON_INDIA_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>Subcategory</label>
                          <select value={editSubCatId} onChange={e => setEditSubCatId(e.target.value)} style={{ height: 38, fontSize: 13, padding: '6px 12px', border: '1.5px solid rgba(26,115,232,0.12)', borderRadius: 9, background: '#FFF', fontFamily: 'inherit', color: '#0F172A', cursor: 'pointer', width: '100%' }} disabled={!editCatId}>
                            <option value="">— None —</option>
                            {AMAZON_INDIA_CATEGORIES.find(c => c.id === editCatId)?.subCategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>Description</label>
                        <textarea className="input" value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} rows={2} style={{ resize: 'none', fontSize: 13 }} />
                      </div>
                      <div>
                        <label style={labelStyle}>Status</label>
                        <select value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))} style={{ height: 38, fontSize: 13, padding: '6px 12px', border: '1.5px solid rgba(26,115,232,0.12)', borderRadius: 9, background: '#FFF', fontFamily: 'inherit', color: '#0F172A', cursor: 'pointer', width: '100%' }}>
                          <option value="active">Active</option>
                          <option value="paused">Paused</option>
                          <option value="archived">Archived</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                      <button className="btn btn-blue btn-sm" onClick={saveProject} disabled={savingProject} style={{ flex: 1 }}>
                        {savingProject ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />} Save Changes
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingProject(null)} style={{ flex: 1 }}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Delete Project Confirmation */}
              {deleteProjectTarget && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
                  <div className="card" style={{ maxWidth: 420, width: '100%', padding: 24, position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,45,85,0.08)', color: '#FF2D55', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertTriangle size={18} /></div>
                      <div><h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: 0 }}>Delete Project</h3><p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>This permanently removes all data including keywords and scrape results</p></div>
                    </div>
                    <p style={{ fontSize: 12.5, color: '#475569', marginBottom: 14, lineHeight: 1.5 }}>
                      Type <strong style={{ color: '#EF4444' }}>{deleteProjectTarget.name}</strong> below to confirm.
                    </p>
                    <input className="input" value={deleteProjectConfirm} onChange={e => setDeleteProjectConfirm(e.target.value)} placeholder={deleteProjectTarget.name} style={{ height: 38, fontSize: 13, marginBottom: 12 }} />
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button className="btn btn-danger btn-sm" onClick={confirmDeleteProject} disabled={deleteProjectConfirm !== deleteProjectTarget.name || deletingProject} style={{ flex: 1, opacity: deleteProjectConfirm !== deleteProjectTarget.name ? 0.5 : 1 }}>
                        {deletingProject ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={13} />} Delete Permanently
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setDeleteProjectTarget(null); setDeleteProjectConfirm('') }} style={{ flex: 1 }}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════
              ALERTS
          ═══════════════════════════════════════ */}
          {tab === 'alerts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1.5px solid rgba(26,115,232,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Alert Rules</span>
                    <span style={{ fontSize: 11, color: '#64748B', marginLeft: 8, fontWeight: 500 }}>Get notified when metrics cross thresholds</span>
                  </div>
                  <button className="btn btn-blue btn-sm" onClick={() => setShowAddAlert(true)}><Plus size={12} /> New Alert</button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Campaign</th>
                        <th>Brand</th>
                        <th>Metric</th>
                        <th>Condition</th>
                        <th>Notify</th>
                        <th>Status</th>
                        <th style={{ width: 80, textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alertRules.length === 0 ? (
                        <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#CBD5E1', fontSize: 13 }}>No alert rules configured.</td></tr>
                      ) : alertRules.map(rule => (
                        <tr key={rule.id}>
                          <td style={{ fontWeight: 600 }}>{rule.campaign_name || rule.campaign_id.slice(0, 8)}</td>
                          <td style={{ fontSize: 12 }}>{rule.brand_name || 'All'}</td>
                          <td><span className="badge badge-blue">{METRIC_LABELS[rule.metric] || rule.metric}</span></td>
                          <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                            {rule.direction === 'above' ? '>' : '<'} {rule.threshold}{rule.metric === 'sov_percent' ? '%' : ''}
                          </td>
                          <td style={{ fontSize: 12 }}>
                            {rule.email && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Mail size={10} /> {rule.email}</span>}
                            {rule.webhook_url && <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#94A3B8', fontSize: 10, marginTop: 2 }}><Webhook size={10} /> Webhook</span>}
                          </td>
                          <td>
                            <button onClick={() => toggleAlert(rule.id, rule.is_active)} className={`badge ${rule.is_active ? 'badge-green' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', fontFamily: 'inherit', fontSize: 10 }}>
                              {rule.is_active ? 'Active' : 'Disabled'}
                            </button>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button onClick={() => deleteAlert(rule.id)} className="btn btn-xs btn-danger" style={{ padding: '3px 7px' }}><Trash2 size={11} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add Alert Modal */}
              {showAddAlert && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
                  <div className="card" style={{ maxWidth: 480, width: '100%', padding: 24, position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #F58220, #FF9F43, transparent)', borderRadius: '14px 14px 0 0' }} />
                    <button onClick={() => setShowAddAlert(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(26,115,232,0.04)', border: '1.5px solid rgba(26,115,232,0.08)', borderRadius: 8, cursor: 'pointer', color: '#94A3B8', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} /></button>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: '0 0 16px' }}>New Alert Rule</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <label style={labelStyle}>Campaign</label>
                        <select className="input" value={newAlert.campaign_id} onChange={e => setNewAlert(p => ({ ...p, campaign_id: e.target.value }))} style={{ height: 38, fontSize: 13 }}>
                          <option value="">-- Select Campaign --</option>
                          {campaigns.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={labelStyle}>Metric</label>
                          <select className="input" value={newAlert.metric} onChange={e => setNewAlert(p => ({ ...p, metric: e.target.value as AlertRule['metric'] }))} style={{ height: 38, fontSize: 13 }}>
                            <option value="sov_percent">SOV %</option>
                            <option value="view_growth">View Growth</option>
                            <option value="frequency_growth">Frequency Growth</option>
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>Direction</label>
                          <select className="input" value={newAlert.direction} onChange={e => setNewAlert(p => ({ ...p, direction: e.target.value as 'above' | 'below' }))} style={{ height: 38, fontSize: 13 }}>
                            <option value="above">Above threshold</option>
                            <option value="below">Below threshold</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={labelStyle}>Threshold</label>
                          <input className="input" type="number" value={newAlert.threshold} onChange={e => setNewAlert(p => ({ ...p, threshold: e.target.value }))} style={{ height: 38, fontSize: 13 }} />
                        </div>
                        <div>
                          <label style={labelStyle}>Brand (optional)</label>
                          <input className="input" value={newAlert.brand_name} onChange={e => setNewAlert(p => ({ ...p, brand_name: e.target.value }))} placeholder="e.g. Atomberg" style={{ height: 38, fontSize: 13 }} />
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>Email Notification</label>
                        <input className="input" type="email" value={newAlert.email} onChange={e => setNewAlert(p => ({ ...p, email: e.target.value }))} placeholder="you@company.com" style={{ height: 38, fontSize: 13 }} />
                      </div>
                      <div>
                        <label style={labelStyle}>Webhook URL (optional)</label>
                        <input className="input" value={newAlert.webhook_url} onChange={e => setNewAlert(p => ({ ...p, webhook_url: e.target.value }))} placeholder="https://hooks.slack.com/..." style={{ height: 38, fontSize: 13 }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                      <button className="btn btn-blue btn-sm" onClick={addAlert} style={{ flex: 1 }}><Bell size={13} /> Create Alert</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setShowAddAlert(false)} style={{ flex: 1 }}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
