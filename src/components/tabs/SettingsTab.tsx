'use client'

import { useState, useEffect, useCallback } from 'react'
import { Settings, Save, Loader2, AlertTriangle, Trash2, Power, PowerOff } from 'lucide-react'
import { useCampaignStore } from '@/lib/store'

export default function SettingsTab() {
  const { campaigns, activeCampaignId, fetchCampaigns } = useCampaignStore()
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [form, setForm] = useState({ name: '', category: '', sub_category: '', description: '', status: 'active' as string })

  const campaign = campaigns.find(c => c.id === activeCampaignId)

  useEffect(() => {
    if (campaign) setForm({ name: campaign.name || '', category: campaign.category || '', sub_category: (campaign as any).sub_category || '', description: campaign.description || '', status: campaign.status || 'active' })
  }, [campaign])

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }, [])

  const saveChanges = async () => {
    if (!activeCampaignId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/campaigns/${activeCampaignId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (res.ok) { showToast('Campaign updated'); fetchCampaigns() } else showToast('Failed to update', 'error')
    } catch { showToast('Failed', 'error') } finally { setSaving(false) }
  }

  const toggleStatus = async () => {
    if (!activeCampaignId) return
    const newStatus = form.status === 'active' ? 'paused' : 'active'
    setForm(p => ({ ...p, status: newStatus }))
    try { await fetch(`/api/campaigns/${activeCampaignId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) }); fetchCampaigns(); showToast(`Campaign ${newStatus}`) }
    catch { showToast('Failed', 'error') }
  }

  const deleteCampaign = async () => {
    if (!activeCampaignId) return
    if (!confirm('Delete this campaign? This cannot be undone.')) return
    setDeleting(true)
    try { const res = await fetch(`/api/campaigns/${activeCampaignId}`, { method: 'DELETE' }); if (res.ok) { showToast('Deleted'); fetchCampaigns() } else showToast('Failed', 'error') }
    catch { showToast('Failed', 'error') } finally { setDeleting(false) }
  }

  if (!campaign) return <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}><Settings size={28} style={{ marginBottom: 8, opacity: 0.4 }} /><div>Select a campaign to manage settings.</div></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 560 }}>
      {toast && <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 9999, padding: '12px 18px', borderRadius: 10, background: toast.type === 'success' ? '#059669' : '#DC2626', color: '#fff', fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>{toast.msg}</div>}

      <div className="card">
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-bright)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Settings size={16} style={{ color: 'var(--blue)' }} /> General Settings</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><div className="section-title" style={{ marginBottom: 5 }}>Campaign Name</div><input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><div className="section-title" style={{ marginBottom: 5 }}>Category</div><input className="input" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} /></div>
            <div><div className="section-title" style={{ marginBottom: 5 }}>Sub-Category</div><input className="input" value={form.sub_category} onChange={e => setForm(p => ({ ...p, sub_category: e.target.value }))} /></div>
          </div>
          <div><div className="section-title" style={{ marginBottom: 5 }}>Description</div><textarea className="input" rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={{ resize: 'vertical' }} /></div>
          <button className="btn btn-blue" onClick={saveChanges} disabled={saving} style={{ alignSelf: 'flex-start' }}>
            {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />} Save Changes
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-bright)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><Power size={16} style={{ color: 'var(--green)' }} /> Campaign Status</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Currently: <span style={{ color: form.status === 'active' ? 'var(--green)' : 'var(--red)', fontWeight: 700, textTransform: 'uppercase', fontSize: 11, background: form.status === 'active' ? 'var(--green-dim)' : 'var(--red-dim)', padding: '2px 8px', borderRadius: 4 }}>{form.status}</span></div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{form.status === 'active' ? 'Campaign is being tracked.' : 'Campaign is paused.'}</div>
          </div>
          <button onClick={toggleStatus} className="btn btn-ghost btn-sm" style={{ borderColor: form.status === 'active' ? 'rgba(255,45,85,0.25)' : 'rgba(0,200,83,0.25)', color: form.status === 'active' ? 'var(--red)' : 'var(--green)' }}>
            {form.status === 'active' ? <><PowerOff size={13} /> Pause</> : <><Power size={13} /> Activate</>}
          </button>
        </div>
      </div>

      <div className="card" style={{ border: '1.5px solid var(--border-orange)' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--red)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={16} /> Danger Zone</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>Deleting this campaign will permanently remove all keywords, videos, and analytics data.</div>
        <button onClick={deleteCampaign} disabled={deleting} className="btn btn-ghost btn-sm" style={{ borderColor: 'rgba(255,45,85,0.25)', color: 'var(--red)' }}>
          {deleting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={13} />} Delete Campaign
        </button>
      </div>
    </div>
  )
}
