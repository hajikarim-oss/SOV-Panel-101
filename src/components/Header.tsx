'use client'

import { useState, useEffect } from 'react'
import { useCampaignStore } from '@/lib/store'
import { CATEGORIES } from '@/lib/categories'
import { Plus, Search, HelpCircle, Globe, Tag, X, Check, Loader2, Sparkles } from 'lucide-react'

export default function Header() {
  const { campaigns, activeCampaignId, setActiveCampaignId, fetchCampaigns } = useCampaignStore()

  // Modal States
  const [showKwModal, setShowKwModal] = useState(false)
  const [showProjModal, setShowProjModal] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [loading, setLoading] = useState(false)

  // Keyword Modal Form States
  const [keywordText, setKeywordText] = useState('')
  const [selectedLang, setSelectedLang] = useState('en')
  const [selectedType, setSelectedType] = useState('generic')

  // Project Modal Form States
  const [projectName, setProjectName] = useState('')
  const [selectedCatId, setSelectedCatId] = useState('')
  const [selectedSubCatId, setSelectedSubCatId] = useState('')
  const [projectDesc, setProjectDesc] = useState('')

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Handle Project Creation
  const handleCreateProject = async () => {
    if (!projectName.trim()) return showToast('Project Name is required', 'error')
    if (!selectedCatId) return showToast('Category is required', 'error')
    
    setLoading(true)
    try {
      const cat = CATEGORIES.find(c => c.id === selectedCatId)?.name || ''
      const subCat = CATEGORIES.find(c => c.id === selectedCatId)?.subCategories.find(s => s.id === selectedSubCatId)?.name || ''
      
      const r = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName.trim(),
          category: cat,
          sub_category: subCat,
          description: projectDesc.trim(),
        }),
      })
      const d = await r.json()
      if (!r.ok) return showToast(d.error || 'Failed to create project', 'error')
      
      showToast(`Project "${projectName}" created successfully!`)
      setProjectName('')
      setSelectedCatId('')
      setSelectedSubCatId('')
      setProjectDesc('')
      setShowProjModal(false)
      
      await fetchCampaigns()
      if (d.campaign?.id) {
        setActiveCampaignId(d.campaign.id)
      }
    } catch {
      showToast('Connection error', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Handle Add Keywords
  const handleAddKeywords = async () => {
    if (!activeCampaignId) return showToast('Please select a project first', 'error')
    if (!keywordText.trim()) return showToast('Enter at least one keyword', 'error')
    
    setLoading(true)
    try {
      const lines = keywordText.split('\n').map(l => l.trim()).filter(Boolean)
      const list = lines.map(text => ({
        text,
        language: selectedLang,
        type: selectedType
      }))

      const r = await fetch('/api/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: activeCampaignId,
          keywords: list,
        }),
      })
      const d = await r.json()
      if (!r.ok) return showToast(d.error || 'Failed to add keywords', 'error')

      showToast(`Added ${d.added} keyword(s) successfully!`)
      setKeywordText('')
      setShowKwModal(false)
      
      // Refresh current page if needed
      window.dispatchEvent(new CustomEvent('keyword-added'))
    } catch {
      showToast('Connection error', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Selected Category's Sub-categories
  const subCategories = CATEGORIES.find(c => c.id === selectedCatId)?.subCategories || []

  // Language Lists
  const LANGUAGES = [
    { code: 'hi', label: 'Hinglish' },
    { code: 'kn', label: 'Kannada' },
    { code: 'te', label: 'Telugu' },
    { code: 'ta', label: 'Tamil' },
    { code: 'ml', label: 'Malayalam' },
    { code: 'en', label: 'English' }
  ]

  // Keyword Types
  const TYPES = [
    { code: 'generic', label: 'Generic' },
    { code: 'branded', label: 'Branded' },
    { code: 'comparison', label: 'Comparison' }
  ]

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 32px',
      background: '#FFFFFF',
      borderBottom: '1px solid var(--border-1)',
      position: 'sticky',
      top: 0,
      zIndex: 999,
      boxShadow: '0 4px 20px rgba(0,0,0,0.01)',
      flexWrap: 'wrap',
      gap: 12,
    }}>
      {/* Left side: Branding / Title context */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>Workspace</span>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: -2 }}>
            The Bored Monkey Analytics
          </div>
        </div>
      </div>

      {/* Right side controls: Project Selector & Keyword Intake */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <select
            className="input"
            value={activeCampaignId}
            onChange={e => setActiveCampaignId(e.target.value)}
            style={{ width: 220, height: 36, fontSize: 12.5, fontWeight: 600, padding: '0 12px', backgroundPosition: 'right 10px center' }}
          >
            {campaigns.length === 0 && <option value="">No Active Projects</option>}
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>🎯 {c.name}</option>
            ))}
          </select>
          <button
            onClick={() => setShowProjModal(true)}
            title="Create New Project"
            style={{
              height: 36, width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1.5px dashed var(--blue)', color: 'var(--blue)', background: 'var(--blue-dim)',
              borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(26,115,232,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--blue-dim)'}
          >
            <Plus size={16} />
          </button>
        </div>

        {activeCampaignId && (
          <button
            onClick={() => setShowKwModal(true)}
            className="btn btn-blue"
            style={{ padding: '0 16px', height: 36, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Search size={14} /> Add Keywords
          </button>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: ADD KEYWORDS
      ══════════════════════════════════════════════════════════════════ */}
      {showKwModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.3)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000,
          animation: 'fadeIn 0.2s ease',
        }}>
          <div className="card anim-fade-up" style={{ width: '100%', maxWidth: 500, padding: 24, border: '1px solid var(--border-2)', position: 'relative' }}>
            <button
              onClick={() => setShowKwModal(false)}
              style={{ position: 'absolute', top: 18, right: 18, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <X size={18} />
            </button>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-bright)', marginBottom: 4 }}>Add Keyword Target</h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>Insert terms to scrape first 10 long-form and first 10 short-form YouTube videos</p>

            {/* Keyword Input */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Keywords (One per line for bulk)
              </label>
              <textarea
                className="input"
                rows={4}
                value={keywordText}
                onChange={e => setKeywordText(e.target.value)}
                placeholder="e.g. best smartphone under 30k&#10;samsung galaxy s24 ultra review"
                style={{ resize: 'none', fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}
              />
            </div>

            {/* Section 1: Language */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
                Language
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {LANGUAGES.map(lang => {
                  const active = selectedLang === lang.code
                  return (
                    <button
                      key={lang.code}
                      onClick={() => setSelectedLang(lang.code)}
                      style={{
                        padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        border: '1.5px solid', cursor: 'pointer', transition: 'all 0.15s',
                        borderColor: active ? '#0F172A' : 'var(--border-1)',
                        background: active ? '#0F172A' : '#FFFFFF',
                        color: active ? '#FFFFFF' : 'var(--text-secondary)',
                      }}
                    >
                      {lang.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Section 2: Keyword Type */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
                Keyword Classification Type
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {TYPES.map(t => {
                  const active = selectedType === t.code
                  return (
                    <button
                      key={t.code}
                      onClick={() => setSelectedType(t.code)}
                      style={{
                        flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        border: '1.5px solid', cursor: 'pointer', transition: 'all 0.15s',
                        borderColor: active ? '#0F172A' : 'var(--border-1)',
                        background: active ? '#0F172A' : '#FFFFFF',
                        color: active ? '#FFFFFF' : 'var(--text-secondary)',
                      }}
                    >
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-blue"
                onClick={handleAddKeywords}
                disabled={loading}
                style={{ flex: 1, height: 40 }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Add Target
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setShowKwModal(false)}
                style={{ flex: 1, height: 40 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: CREATE CAMPAIGN/PROJECT
      ══════════════════════════════════════════════════════════════════ */}
      {showProjModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.3)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000,
          animation: 'fadeIn 0.2s ease',
        }}>
          <div className="card anim-fade-up" style={{ width: '100%', maxWidth: 500, padding: 24, border: '1px solid var(--border-2)', position: 'relative' }}>
            <button
              onClick={() => setShowProjModal(false)}
              style={{ position: 'absolute', top: 18, right: 18, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <X size={18} />
            </button>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-bright)', marginBottom: 4 }}>Create Analytics Project</h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>Categorize your target keywords to benchmark Share-of-Voice correctly</p>

            {/* Project Name */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Project Name *
              </label>
              <input
                className="input"
                type="text"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                placeholder="e.g. Q3 Mobile Launch, Tech Brands India"
                style={{ height: 38 }}
              />
            </div>

            {/* Category selection */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Category *
                </label>
                <select
                  className="input"
                  value={selectedCatId}
                  onChange={e => {
                    setSelectedCatId(e.target.value)
                    setSelectedSubCatId('')
                  }}
                  style={{ height: 38 }}
                >
                  <option value="">Select Category</option>
                  {CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Sub-category
                </label>
                <select
                  className="input"
                  value={selectedSubCatId}
                  onChange={e => setSelectedSubCatId(e.target.value)}
                  disabled={!selectedCatId}
                  style={{ height: 38 }}
                >
                  <option value="">Select Sub-category</option>
                  {subCategories.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Project description */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Description / Benchmark Goal
              </label>
              <textarea
                className="input"
                rows={3}
                value={projectDesc}
                onChange={e => setProjectDesc(e.target.value)}
                placeholder="Briefly describe the campaign target for reference..."
                style={{ resize: 'none', fontSize: 13 }}
              />
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-blue"
                onClick={handleCreateProject}
                disabled={loading}
                style={{ flex: 1, height: 40 }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Create Project
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setShowProjModal(false)}
                style={{ flex: 1, height: 40 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Message System ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 10005,
          padding: '12px 20px', borderRadius: 10, background: toast.type === 'success' ? '#00C853' : '#FF2D55',
          color: '#FFFFFF', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)', animation: 'fadeUp 0.25s ease'
        }}>
          {toast.msg}
        </div>
      )}
    </header>
  )
}
