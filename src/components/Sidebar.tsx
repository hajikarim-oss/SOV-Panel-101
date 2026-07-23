'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useCampaignStore } from '@/lib/store'
import { Play } from 'lucide-react'

const NAV = [
  {
    section: 'WORKSPACE',
    items: [
      { href: '/workspace', label: 'Project Hub', dot: 'blue' },
      { href: '/control', label: 'Campaign Control', dot: 'blue' },
    ]
  },
  {
    section: 'ANALYTICS',
    items: [
      { href: '/',              label: 'Overview',          dot: 'blue' },
      { href: '/leaderboard',   label: 'Top Videos',        dot: 'green' },
      { href: '/brand-growth',  label: 'Brand Growth',      dot: 'green' },
      { href: '/sov-trend',     label: 'SOV Trend',         dot: 'violet' },
      { href: '/keyword-sov',   label: 'Keyword SOV',       dot: 'orange' },
      { href: '/brands',        label: 'All Brands',        dot: 'blue' },
      { href: '/dropped',       label: 'Dropped Rankings',  dot: 'red' },
      { href: '/multi-keyword', label: 'Multi-Keyword',     dot: 'violet' },
      { href: '/analytic-calendar', label: 'Calendar',      dot: 'blue' },
      { href: '/brands-products', label: 'Brands & Products', dot: 'orange' },
    ]
  },
  {
    section: 'SYSTEM',
    items: [
      { href: '/settings', label: 'Settings', dot: 'orange' },
    ]
  },
  {
    section: 'LEGAL',
    items: [
      { href: '/privacy-policy', label: 'Privacy Policy', dot: 'gray' },
    ]
  }
]

const DOT_COLORS: Record<string, string> = {
  blue:   '#1A73E8',
  green:  '#00C853',
  violet: '#7C3AED',
  orange: '#FF6D00',
  red:    '#FF2D55',
  gray:   '#94A3B8',
}

function LogoSmall() {
  return (
    <img
      src="/tbm-logo.png"
      alt="The Bored Monkey"
      style={{ width: '100%', height: 'auto', display: 'block' }}
    />
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [quota, setQuota] = useState<{ used: number; total: number } | null>(null)
  const { campaigns, activeCampaignId, fetchCampaigns } = useCampaignStore()

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  useEffect(() => {
    fetch('/api/api-keys')
      .then(r => r.json())
      .then(d => {
        const s = d.stats
        if (s) setQuota({ used: s.total_used ?? 0, total: s.total_capacity ?? 1 })
      })
      .catch(() => {})
  }, [])

  const quotaPct = quota ? Math.min(100, Math.round((quota.used / quota.total) * 100)) : 62
  const quotaColor = quotaPct > 80 ? '#FF2D55' : quotaPct > 60 ? '#FF6D00' : '#1A73E8'

  const activeCampaign = campaigns.find(c => c.id === activeCampaignId)

  return (
    <aside style={{
      position: 'fixed',
      top: 0, left: 0, height: '100%',
      width: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-w)',
      background: 'rgba(255,255,255,0.96)',
      borderRight: '1.5px solid rgba(26,115,232,0.05)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 50,
      transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
      overflow: 'hidden',
      boxShadow: '2px 0 20px rgba(0,0,0,0.02)',
    }}>

      {/* ── Logo / Brand ── */}
      <div style={{
        padding: collapsed ? '14px 10px' : '14px 14px 10px',
        borderBottom: '1.5px solid rgba(26,115,232,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
        minHeight: 52,
      }}>
        {collapsed ? (
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'linear-gradient(135deg, #F58220 0%, #FF9F43 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(245,130,32,0.25)',
          }}>
            <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
              <rect x="1" y="8" width="3" height="6" rx="1" fill="white" opacity="0.8"/>
              <rect x="6" y="4" width="3" height="10" rx="1" fill="white" opacity="0.9"/>
              <rect x="11" y="1" width="3" height="13" rx="1" fill="white"/>
            </svg>
          </div>
        ) : (
          <LogoSmall />
        )}
      </div>

      {/* ── Active Project Chip ── */}
      {!collapsed && activeCampaign && (
        <div style={{
          margin: '10px 12px',
          padding: '8px 12px',
          background: 'linear-gradient(135deg, rgba(245,130,32,0.04), rgba(255,159,67,0.02))',
          border: '1.5px solid rgba(245,130,32,0.1)',
          borderRadius: 8,
          cursor: 'default',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#94A3B8', marginBottom: 2 }}>
            Active Project
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#F58220', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeCampaign.name}
          </div>
          {activeCampaign.category && (
            <div style={{ fontSize: 10, color: '#64748B', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeCampaign.category}{activeCampaign.sub_category ? ` › ${activeCampaign.sub_category}` : ''}
            </div>
          )}
        </div>
      )}

      {/* ── Navigation ── */}
      <nav style={{
        flex: 1,
        padding: collapsed ? '8px 6px' : '6px 10px',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}>
        {NAV.map(group => (
          <div key={group.section} style={{ marginBottom: 8 }}>
            {!collapsed && (
              <div style={{
                fontSize: 9.5, fontWeight: 700, letterSpacing: '1px',
                color: '#94A3B8', padding: '8px 8px 4px',
                textTransform: 'uppercase',
              }}>
                {group.section}
              </div>
            )}
            {group.items.map(item => {
              const active = pathname === item.href
              const dotColor = DOT_COLORS[item.dot] || '#94A3B8'
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: collapsed ? 0 : 9,
                    padding: collapsed ? '10px' : '7px 10px',
                    borderRadius: 7,
                    marginBottom: 1,
                    background: active
                      ? `${dotColor}0D`
                      : 'transparent',
                    color: active ? dotColor : '#475569',
                    textDecoration: 'none',
                    transition: 'all 0.12s ease',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    position: 'relative',
                    fontWeight: active ? 700 : 500,
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = '#F1F5F9'
                      ;(e.currentTarget as HTMLElement).style.color = '#0F172A'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = 'transparent'
                      ;(e.currentTarget as HTMLElement).style.color = '#475569'
                    }
                  }}
                >
                  {active && !collapsed && (
                    <div style={{
                      position: 'absolute', left: 0, top: 4, bottom: 4,
                      width: 3, borderRadius: '0 3px 3px 0',
                      background: `linear-gradient(180deg, ${dotColor}, ${dotColor}88)`,
                    }} />
                  )}

                  <div style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: active ? dotColor : '#CBD5E1',
                    transition: 'all 0.12s',
                    boxShadow: active ? `0 0 6px ${dotColor}60` : 'none',
                  }} />

                  {!collapsed && (
                    <span style={{
                      fontSize: 13, lineHeight: 1.3,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {item.label}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* ── API Quota bar ── */}
      {!collapsed && (
        <div style={{
          padding: '10px 16px',
          borderTop: '1.5px solid rgba(26,115,232,0.04)',
          background: 'rgba(244,247,252,0.5)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontSize: 10.5, color: '#64748B', fontWeight: 600 }}>API Quota Used</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: quotaColor }}>{quotaPct}%</span>
          </div>
          <div style={{ height: 4, borderRadius: 99, background: '#E2E8F0', overflow: 'hidden' }}>
            <div style={{
              width: `${quotaPct}%`, height: '100%', borderRadius: 99,
              background: `linear-gradient(90deg, ${quotaColor}, ${quotaColor}88)`,
              transition: 'width 0.5s ease',
            }} />
          </div>
          {quota && (
            <div style={{ fontSize: 9.5, color: '#94A3B8', marginTop: 3, fontFamily: "'JetBrains Mono', monospace" }}>
              {quota.used.toLocaleString()} / {quota.total.toLocaleString()} units
            </div>
          )}
        </div>
      )}

      {/* ── User Status & Logout ── */}
      {!collapsed && (
        <div style={{
          padding: '10px 16px',
          borderTop: '1.5px solid rgba(26,115,232,0.04)',
          background: 'rgba(244,247,252,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Admin Panel
            </div>
            <div style={{ fontSize: 9.5, color: '#94A3B8' }}>Logged in</div>
          </div>
          <button
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' })
              window.location.href = '/login'
            }}
            style={{
              background: 'none', border: '1.5px solid rgba(239,68,68,0.1)',
              color: '#EF4444', borderRadius: 6,
              fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
              padding: '4px 10px', fontFamily: 'inherit',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            Logout
          </button>
        </div>
      )}

      {/* ── Replay Tutorial ── */}
      {!collapsed && (
        <button
          onClick={() => (window as any).__replayTutorial?.()}
          style={{
            margin: '0 8px 4px', padding: '7px 10px',
            borderRadius: 7, background: 'transparent',
            border: '1.5px solid rgba(245,130,32,0.1)',
            color: '#F58220', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 7,
            transition: 'all 0.12s', fontFamily: 'inherit',
            fontSize: 11.5, fontWeight: 600,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,130,32,0.04)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <Play size={12} /> Replay Tutorial
        </button>
      )}

      {/* ── Collapse toggle ── */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          margin: '8px',
          padding: '8px',
          borderRadius: 7,
          background: 'transparent',
          border: '1.5px solid rgba(26,115,232,0.06)',
          color: '#94A3B8',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          transition: 'all 0.12s',
          fontFamily: 'inherit',
          fontSize: 11,
          fontWeight: 600,
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = '#F1F5F9'
          ;(e.currentTarget as HTMLElement).style.color = '#475569'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLElement).style.color = '#94A3B8'
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {collapsed
            ? <path d="M5 3l4 4-4 4" />
            : <path d="M9 3L5 7l4 4" />
          }
        </svg>
        {!collapsed && <span>Collapse</span>}
      </button>
    </aside>
  )
}
