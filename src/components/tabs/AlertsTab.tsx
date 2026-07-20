'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, Plus, Trash2, Loader2, TrendingUp, TrendingDown, X, Mail, Webhook } from 'lucide-react'
import { useCampaignStore } from '@/lib/store'

interface AlertRule { id: string; campaign_id: string; brand_name: string; metric: string; threshold: number; direction: string; webhook_url: string | null; email: string | null; is_active: boolean; last_triggered_at: string | null; created_at: string }

const METRICS = [{ value: 'sov_percent', label: 'SOV %' }, { value: 'view_growth', label: 'View Growth' }, { value: 'frequency_growth', label: 'Frequency Growth' }]
const DIRECTIONS = [{ value: 'above', label: 'Goes above' }, { value: 'below', label: 'Goes below' }]

export default function AlertsTab() {
  const { activeCampaignId } = useCampaignStore()
  const [alerts, setAlerts] = useState<AlertRule[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ brand_name: '', metric: 'sov_percent', threshold: '', direction: 'above', webhook_url: '', email: '' })

  const fetchAlerts = useCallback(async (campId: string) => {
    if (!campId) return
    setLoading(true)
    try { const res = await fetch(`/api/alerts?campaign_id=${campId}`); const d = await res.json(); setAlerts(d.data ?? []) }
    catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (activeCampaignId) fetchAlerts(activeCampaignId) }, [activeCampaignId, fetchAlerts])

  const addAlert = async () => {
    if (!activeCampaignId || !form.brand_name || !form.threshold) return
    setSaving(true)
    try {
      await fetch('/api/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaign_id: activeCampaignId, ...form, threshold: parseFloat(form.threshold), webhook_url: form.webhook_url || null, email: form.email || null }) })
      setForm({ brand_name: '', metric: 'sov_percent', threshold: '', direction: 'above', webhook_url: '', email: '' }); setShowAdd(false); fetchAlerts(activeCampaignId)
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  const toggleAlert = async (id: string, currentActive: boolean) => {
    try { await fetch('/api/alerts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_active: !currentActive }) }); if (activeCampaignId) fetchAlerts(activeCampaignId) } catch { /* ignore */ }
  }

  const deleteAlert = async (id: string) => {
    if (!confirm('Delete this alert rule?')) return
    try { await fetch('/api/alerts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); if (activeCampaignId) fetchAlerts(activeCampaignId) } catch { /* ignore */ }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
          Alert Rules <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({alerts.length} · {alerts.filter(a => a.is_active).length} active)</span>
        </div>
        <button onClick={() => setShowAdd(v => !v)} className="btn btn-sm" style={{ background: 'var(--red-gradient)', border: 'none', color: '#fff' }}>
          <Plus size={13} /> New Alert
        </button>
      </div>

      {showAdd && (
        <div className="card" style={{ border: '1.5px solid var(--border-orange)', background: 'var(--red-dim)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)', marginBottom: 12 }}>Create Alert Rule</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><div className="section-title" style={{ marginBottom: 5 }}>Brand</div><input className="input" placeholder="e.g. Aquaguard" value={form.brand_name} onChange={e => setForm(p => ({ ...p, brand_name: e.target.value }))} /></div>
            <div><div className="section-title" style={{ marginBottom: 5 }}>Metric</div><select className="input" value={form.metric} onChange={e => setForm(p => ({ ...p, metric: e.target.value }))}>{METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><div className="section-title" style={{ marginBottom: 5 }}>Threshold (%)</div><input className="input" type="number" placeholder="e.g. 25" value={form.threshold} onChange={e => setForm(p => ({ ...p, threshold: e.target.value }))} /></div>
            <div><div className="section-title" style={{ marginBottom: 5 }}>Direction</div><select className="input" value={form.direction} onChange={e => setForm(p => ({ ...p, direction: e.target.value }))}>{DIRECTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}</select></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div><div className="section-title" style={{ marginBottom: 5 }}><Mail size={10} style={{ verticalAlign: -1 }} /> Email</div><input className="input" type="email" placeholder="alert@example.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
            <div><div className="section-title" style={{ marginBottom: 5 }}><Webhook size={10} style={{ verticalAlign: -1 }} /> Webhook</div><input className="input" placeholder="https://hooks.example.com/..." value={form.webhook_url} onChange={e => setForm(p => ({ ...p, webhook_url: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={addAlert} disabled={saving || !form.brand_name || !form.threshold} style={{ background: 'var(--red)', color: '#fff', border: 'none' }}>
              {saving ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={12} />} Create
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}><X size={12} /> Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160, color: 'var(--text-muted)' }}><Loader2 size={18} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} /> Loading…</div>
      ) : alerts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}><Bell size={28} style={{ marginBottom: 8, opacity: 0.4 }} /><div>No alert rules configured.</div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {alerts.map(alert => (
            <div key={alert.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', opacity: alert.is_active ? 1 : 0.6 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: alert.is_active ? 'var(--red-dim)' : 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {alert.direction === 'above' ? <TrendingUp size={16} style={{ color: alert.is_active ? 'var(--red)' : 'var(--text-muted)' }} /> : <TrendingDown size={16} style={{ color: alert.is_active ? 'var(--blue)' : 'var(--text-muted)' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{alert.brand_name} <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{METRICS.find(m => m.value === alert.metric)?.label}</span></div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {alert.direction === 'above' ? 'Alert when above' : 'Alert when below'} <strong style={{ color: 'var(--text-secondary)' }}>{alert.threshold}%</strong>
                  {alert.email && <span> · {alert.email}</span>}{alert.webhook_url && <span> · Webhook</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <button onClick={() => toggleAlert(alert.id, alert.is_active)} style={{ width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', background: alert.is_active ? 'var(--green)' : 'var(--border-2)', position: 'relative' }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: alert.is_active ? 18 : 2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
                </button>
                <button onClick={() => deleteAlert(alert.id)} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#DC2626'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
