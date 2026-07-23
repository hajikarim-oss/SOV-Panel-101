'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCampaignStore, ProjectWithRole } from '@/lib/store'
import { CATEGORIES } from '@/lib/categories'
import {
  FolderKanban, Plus, Loader2, LogOut, Hash, Tag,
  Shield, ShieldCheck, ShieldAlert, Eye,
  X, Check, ExternalLink, Users, BarChart3,
  Clock, Target, Rocket, ArrowRight, Activity,
} from 'lucide-react'

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  owner: {
    label: 'Owner',
    color: '#00C853',
    bg: 'rgba(0,200,83,0.1)',
    border: 'rgba(0,200,83,0.25)',
    icon: <ShieldCheck size={11} />,
  },
  admin: {
    label: 'Admin',
    color: '#1A73E8',
    bg: 'rgba(26,115,232,0.1)',
    border: 'rgba(26,115,232,0.25)',
    icon: <Shield size={11} />,
  },
  editor: {
    label: 'Editor',
    color: '#7C3AED',
    bg: 'rgba(124,58,237,0.1)',
    border: 'rgba(124,58,237,0.25)',
    icon: <ShieldAlert size={11} />,
  },
  viewer: {
    label: 'Viewer',
    color: '#64748B',
    bg: 'rgba(100,116,139,0.1)',
    border: 'rgba(100,116,139,0.25)',
    icon: <Eye size={11} />,
  },
}

function LogoSm() {
  return (
    <img
      src="/tbm-logo.png"
      alt="The Bored Monkey"
      style={{ height: 22, width: 'auto', display: 'block' }}
    />
  )
}

export default function WorkspacePage() {
  const router = useRouter()
  const { setActiveCampaignId } = useCampaignStore()

  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<ProjectWithRole[]>([])
  const [userEmail, setUserEmail] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  const [projectName, setProjectName] = useState('')
  const [selectedCatId, setSelectedCatId] = useState('')
  const [selectedSubCatId, setSelectedSubCatId] = useState('')
  const [projectDesc, setProjectDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/workspace')
      .then(r => r.json())
      .then(d => { setProjects(d.projects ?? []) })
      .catch(() => {})
      .finally(() => setLoading(false))

    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => { if (d.email) setUserEmail(d.email) })
      .catch(() => {})
  }, [])

  const totalKeywords = projects.reduce((s, p) => s + p.keyword_count, 0)
  const totalBrands = projects.reduce((s, p) => s + p.brand_count, 0)
  const activeProjects = projects.filter(p => p.status === 'active').length

  const handleEnterProject = (project: ProjectWithRole) => {
    setActiveCampaignId(project.id)
    if (project.role === 'viewer') {
      router.push('/client')
    } else {
      router.push('/')
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  const handleCreateProject = async () => {
    if (!projectName.trim()) { setError('Project name is required'); return }
    if (!selectedCatId) { setError('Category is required'); return }

    setCreating(true)
    setError(null)
    try {
      const cat = CATEGORIES.find(c => c.id === selectedCatId)?.name || ''
      const subCat = CATEGORIES.find(c => c.id === selectedCatId)?.subCategories.find(s => s.id === selectedSubCatId)?.name || ''

      const r = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName.trim(), category: cat, sub_category: subCat, description: projectDesc.trim() }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'Failed to create project'); return }

      setShowCreateModal(false)
      setProjectName(''); setSelectedCatId(''); setSelectedSubCatId(''); setProjectDesc('')

      const r2 = await fetch('/api/workspace')
      const d2 = await r2.json()
      setProjects(d2.projects ?? [])

      if (d.campaign?.id) {
        setActiveCampaignId(d.campaign.id)
        router.push('/')
      }
    } catch {
      setError('Connection error')
    } finally {
      setCreating(false)
    }
  }

  const activeCat = CATEGORIES.find(c => c.id === selectedCatId)
  const subCategories = activeCat?.subCategories || []

  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-base)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(245,130,32,0.1), rgba(255,159,67,0.1))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', border: '1.5px solid rgba(245,130,32,0.15)',
          }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: '#F58220' }} />
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Loading workspace...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* ── Top Bar ── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 32px', background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1.5px solid rgba(26,115,232,0.06)',
        boxShadow: '0 1px 12px rgba(0,0,0,0.02)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <LogoSm />
          <div style={{ width: 1, height: 22, background: 'rgba(26,115,232,0.1)' }} />
          <div style={{
            fontSize: 12, fontWeight: 700, color: '#64748B', letterSpacing: '0.3px',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Activity size={13} /> Workspace
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            padding: '5px 12px', background: 'linear-gradient(135deg, rgba(245,130,32,0.08), rgba(255,159,67,0.05))',
            borderRadius: 8, border: '1.5px solid rgba(245,130,32,0.1)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Users size={12} color="#F58220" />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>{userEmail || 'Loading...'}</span>
          </div>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 13px', borderRadius: 8,
              background: 'transparent', border: '1.5px solid rgba(26,115,232,0.08)',
              color: '#64748B', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748B'; e.currentTarget.style.borderColor = 'rgba(26,115,232,0.08)' }}
          >
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 32px 60px' }}>

        {/* ── Welcome + CTA ── */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          marginBottom: 24, gap: 16,
        }}>
          <div>
            <h1 style={{
              fontSize: 26, fontWeight: 800, color: 'var(--text-bright)',
              letterSpacing: '-0.5px', margin: 0,
              background: 'linear-gradient(135deg, #0F172A 0%, #334155 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              Welcome back{userEmail ? `, ${userEmail.split('@')[0].split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}` : ''}
            </h1>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 4, fontWeight: 500 }}>
              {projects.length} project{projects.length !== 1 ? 's' : ''} · {totalKeywords} keyword{totalKeywords !== 1 ? 's' : ''} · {totalBrands} brand{totalBrands !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '10px 22px', fontSize: 13.5, flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'linear-gradient(135deg, #F58220 0%, #FF9F43 100%)',
              color: '#FFFFFF', fontWeight: 700, border: 'none', borderRadius: 10,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 4px 14px rgba(245,130,32,0.25)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(245,130,32,0.35)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(245,130,32,0.25)'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            <Plus size={16} /> New Project
          </button>
        </div>

        {/* ── KPI Strip ── */}
        {projects.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 12, marginBottom: 28,
          }}>
            {[
              { label: 'Total Projects', value: projects.length, icon: <FolderKanban size={16} />, color: '#1A73E8' },
              { label: 'Active', value: activeProjects, icon: <BarChart3 size={16} />, color: '#00C853' },
              { label: 'Keywords', value: totalKeywords, icon: <Hash size={16} />, color: '#7C3AED' },
              { label: 'Brands', value: totalBrands, icon: <Tag size={16} />, color: '#FF6D00' },
            ].map(stat => (
              <div key={stat.label} className="card" style={{
                padding: '16px 18px',
                position: 'relative', overflow: 'hidden',
              }}>
                {/* Accent bar */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                  background: `linear-gradient(90deg, ${stat.color}, ${stat.color}88, transparent)`,
                  opacity: 0.5,
                }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: `${stat.color}0D`,
                    color: stat.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    border: `1.5px solid ${stat.color}15`,
                  }}>
                    {stat.icon}
                  </div>
                  <div>
                    <div style={{
                      fontSize: 22, fontWeight: 800, color: 'var(--text-bright)',
                      lineHeight: 1.1, letterSpacing: '-0.5px',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {stat.value}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginTop: 1 }}>{stat.label}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Project Grid / Empty State ── */}
        {projects.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '64px 40px',
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(16px)',
            borderRadius: 'var(--border-radius)',
            border: '2px dashed rgba(26,115,232,0.1)',
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: 18,
              background: 'linear-gradient(135deg, rgba(245,130,32,0.1), rgba(255,159,67,0.05))',
              color: '#F58220',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              border: '1.5px solid rgba(245,130,32,0.15)',
            }}>
              <Rocket size={34} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-bright)', margin: '0 0 10px', letterSpacing: '-0.3px' }}>
              Your analytics journey starts here
            </h2>
            <p style={{ fontSize: 13.5, color: 'var(--text-muted)', maxWidth: 440, margin: '0 auto 28px', lineHeight: 1.7 }}>
              Create your first project to start tracking Share of Voice across YouTube keywords.
              Monitor your brand, analyze competitors, and uncover growth opportunities.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  padding: '11px 28px', fontSize: 13.5, fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'linear-gradient(135deg, #F58220 0%, #FF9F43 100%)',
                  color: '#FFFFFF', border: 'none', borderRadius: 10,
                  cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: '0 4px 14px rgba(245,130,32,0.25)',
                  transition: 'all 0.15s',
                }}
              >
                <Plus size={16} /> Create Your First Project
              </button>
              <button
                style={{
                  padding: '11px 24px', fontSize: 13.5, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: '#FFFFFF', color: '#475569',
                  border: '1.5px solid rgba(26,115,232,0.1)',
                  borderRadius: 10, cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(26,115,232,0.25)'; e.currentTarget.style.color = '#0F172A' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(26,115,232,0.1)'; e.currentTarget.style.color = '#475569' }}
              >
                <ExternalLink size={14} /> Learn More
              </button>
            </div>

            <div style={{
              display: 'flex', justifyContent: 'center', gap: 48, marginTop: 44,
              paddingTop: 36, borderTop: '1.5px solid rgba(26,115,232,0.06)',
            }}>
              {[
                { icon: <Target size={20} />, title: 'Track Keywords', desc: 'Monitor YouTube rankings for your target terms' },
                { icon: <BarChart3 size={20} />, title: 'Share of Voice', desc: 'See your brand vs competitors in real time' },
                { icon: <Clock size={20} />, title: 'Daily Snapshots', desc: 'Automatic daily view count tracking' },
              ].map(item => (
                <div key={item.title} style={{ textAlign: 'center', maxWidth: 190 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: 'linear-gradient(135deg, rgba(245,130,32,0.08), rgba(255,159,67,0.04))',
                    color: '#F58220',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 12px',
                    border: '1.5px solid rgba(245,130,32,0.1)',
                  }}>
                    {item.icon}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{
                fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <FolderKanban size={15} /> All Projects
              </h2>
              <span style={{
                fontSize: 12, color: 'var(--text-muted)', fontWeight: 600,
                padding: '2px 10px', background: 'rgba(26,115,232,0.04)',
                borderRadius: 6, border: '1.5px solid rgba(26,115,232,0.06)',
              }}>
                {projects.length} total
              </span>
            </div>

            {/* Project cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: 14,
            }}>
              {projects.map(project => {
                const roleCfg = ROLE_CONFIG[project.role] || ROLE_CONFIG.viewer
                return (
                  <div
                    key={project.id}
                    className="card-interactive"
                    onClick={() => handleEnterProject(project)}
                    style={{ padding: 22, display: 'flex', flexDirection: 'column', position: 'relative' }}
                  >
                    {/* Top accent */}
                    <div style={{
                      position: 'absolute', top: 0, left: 20, right: 20, height: 2,
                      background: `linear-gradient(90deg, ${roleCfg.color}, ${roleCfg.color}66, transparent)`,
                      borderRadius: '0 0 2px 2px', opacity: 0.4,
                    }} />

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{
                        fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.7px',
                        background: 'rgba(26,115,232,0.03)', padding: '2px 8px',
                        borderRadius: 4,
                      }}>
                        {project.category || 'Uncategorized'}
                        {project.sub_category ? <span style={{ opacity: 0.4 }}> › {project.sub_category}</span> : ''}
                      </div>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 9px', borderRadius: 6,
                        background: roleCfg.bg, border: `1.5px solid ${roleCfg.border}`,
                        color: roleCfg.color, fontSize: 10, fontWeight: 700,
                      }}>
                        {roleCfg.icon}
                        {roleCfg.label}
                      </div>
                    </div>

                    <h3 style={{
                      fontSize: 17, fontWeight: 800, color: 'var(--text-bright)',
                      margin: '0 0 6px', lineHeight: 1.2, letterSpacing: '-0.2px',
                    }}>
                      {project.name}
                    </h3>

                    {project.description && (
                      <p style={{
                        fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5,
                        margin: '0 0 14px', display: '-webkit-box',
                        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {project.description}
                      </p>
                    )}

                    <div style={{ flex: 1 }} />

                    <div style={{
                      display: 'flex', gap: 14, paddingTop: 12,
                      borderTop: '1.5px solid rgba(26,115,232,0.06)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Hash size={12} color="var(--text-muted)" />
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{project.keyword_count}</span>
                        <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 500 }}>kw</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Tag size={12} color="var(--text-muted)" />
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{project.brand_count}</span>
                        <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 500 }}>brands</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto' }}>
                        <Clock size={11} color="var(--text-muted)" />
                        <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600 }}>
                          {formatTimeAgo(project.last_scraped)}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: project.status === 'active' ? '#00C853'
                          : project.status === 'paused' ? '#FF6D00' : '#94A3B8',
                        boxShadow: project.status === 'active' ? '0 0 8px rgba(0,200,83,0.5)' : 'none',
                      }} />
                      <span style={{
                        fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)',
                        textTransform: 'capitalize',
                      }}>
                        {project.status || 'active'}
                      </span>
                      <span style={{
                        marginLeft: 'auto', fontSize: 11.5, color: '#F58220',
                        fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5,
                      }}>
                        Open Dashboard <ArrowRight size={11} />
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          CREATE PROJECT MODAL
      ════════════════════════════════════════════════════════════════ */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000, animation: 'fadeIn 0.2s ease',
        }}>
          <div className="card" style={{
            width: '100%', maxWidth: 520, padding: 28,
            border: '1.5px solid rgba(26,115,232,0.08)', position: 'relative',
            animation: 'fadeUp 0.25s ease',
          }}>
            {/* Top accent */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 3,
              background: 'linear-gradient(90deg, #F58220, #FF9F43, transparent)',
              borderRadius: '14px 14px 0 0',
            }} />

            <button
              onClick={() => { setShowCreateModal(false); setError(null) }}
              style={{
                position: 'absolute', top: 20, right: 20,
                background: 'rgba(26,115,232,0.04)', border: '1.5px solid rgba(26,115,232,0.08)',
                borderRadius: 8, cursor: 'pointer', color: '#94A3B8',
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(26,115,232,0.1)'; e.currentTarget.style.color = '#475569' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(26,115,232,0.04)'; e.currentTarget.style.color = '#94A3B8' }}
            >
              <X size={16} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'linear-gradient(135deg, rgba(245,130,32,0.1), rgba(255,159,67,0.05))',
                color: '#F58220', border: '1.5px solid rgba(245,130,32,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Plus size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-bright)', margin: 0 }}>Create Analytics Project</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  Set up a new project to start tracking Share of Voice
                </p>
              </div>
            </div>

            {error && (
              <div style={{
                display: 'flex', gap: 8, padding: '10px 14px', borderRadius: 8,
                background: 'linear-gradient(135deg, #FEF2F2, #FFF5F5)',
                border: '1.5px solid rgba(255,45,85,0.15)', color: '#B91C1C',
                fontSize: 12.5, fontWeight: 500, marginBottom: 18, alignItems: 'center',
              }}>
                <X size={14} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#475569', display: 'block', marginBottom: 6 }}>Project Name *</label>
              <input className="input" type="text" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g. Q3 Mobile Launch, Tech Brands India" style={{ height: 40, fontSize: 13.5 }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#475569', display: 'block', marginBottom: 6 }}>Category *</label>
                <select className="input" value={selectedCatId} onChange={e => { setSelectedCatId(e.target.value); setSelectedSubCatId('') }} style={{ height: 40, fontSize: 13 }}>
                  <option value="">Select Category</option>
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#475569', display: 'block', marginBottom: 6 }}>Sub-category</label>
                <select className="input" value={selectedSubCatId} onChange={e => setSelectedSubCatId(e.target.value)} disabled={!selectedCatId} style={{ height: 40, fontSize: 13 }}>
                  <option value="">Select Sub-category</option>
                  {subCategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#475569', display: 'block', marginBottom: 6 }}>Description</label>
              <textarea className="input" rows={2} value={projectDesc} onChange={e => setProjectDesc(e.target.value)} placeholder="Briefly describe the campaign target for reference..." style={{ resize: 'none', fontSize: 13 }} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleCreateProject} disabled={creating}
                style={{
                  flex: 1, height: 42, fontSize: 13.5, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: 'linear-gradient(135deg, #F58220 0%, #FF9F43 100%)',
                  color: '#FFFFFF', border: 'none', borderRadius: 10,
                  cursor: creating ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  opacity: creating ? 0.7 : 1,
                  boxShadow: '0 4px 14px rgba(245,130,32,0.25)',
                  transition: 'all 0.15s',
                }}
              >
                {creating ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={16} />}
                Create Project
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => { setShowCreateModal(false); setError(null) }}
                style={{ flex: 1, height: 42 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
