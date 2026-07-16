'use client'

import Link from 'next/link'
import { LogOut, Tag, TrendingUp, Video } from 'lucide-react'

export default function ClientSidebar({ brandName, campaignName }: { brandName: string; campaignName: string }) {
  return (
    <aside style={{
      position: 'fixed',
      top: 0, left: 0, height: '100%',
      width: 'var(--sidebar-w)',
      background: '#FFFFFF',
      borderRight: '1.5px solid rgba(0,0,0,0.06)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 50,
      boxShadow: '4px 0 24px rgba(0,0,0,0.02)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '18px 20px',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        display: 'flex', alignItems: 'center', gap: 10,
        minHeight: 64,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 7,
          background: 'linear-gradient(135deg, #1A73E8 0%, #4285F4 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(26,115,232,0.3)',
        }}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <rect x="1" y="8" width="3" height="6" rx="1" fill="white" opacity="0.8"/>
            <rect x="6" y="4" width="3" height="10" rx="1" fill="white" opacity="0.9"/>
            <rect x="11" y="1" width="3" height="13" rx="1" fill="white"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
            SOV Panel
          </div>
          <div style={{ fontSize: 9.5, color: '#64748B', fontWeight: 700, letterSpacing: '0.8px', marginTop: 1, textTransform: 'uppercase' }}>
            Brand Dashboard
          </div>
        </div>
      </div>

      {/* Active Project & Brand */}
      <div style={{ margin: '14px 12px', padding: '10px 12px', background: 'rgba(26,115,232,0.04)', border: '1px solid rgba(26,115,232,0.12)', borderRadius: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#94A3B8', marginBottom: 2 }}>
          Project Campaign
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {campaignName}
        </div>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#94A3B8', marginTop: 8, marginBottom: 2 }}>
          Your Assigned Brand
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1A73E8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {brandName}
        </div>
      </div>

      {/* Quick Navigation Info Links */}
      <nav style={{ flex: 1, padding: '10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 7, background: 'rgba(26,115,232,0.08)', color: '#1A73E8', fontSize: 12.5, fontWeight: 700 }}>
          <TrendingUp size={14} />
          <span>Master Overview</span>
        </div>
      </nav>

      {/* User Actions & Sign Out */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(0,0,0,0.06)', background: '#FAFBFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Client Access
          </div>
          <div style={{ fontSize: 9.5, color: '#94A3B8' }}>{brandName}</div>
        </div>
        <button
          onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' })
            window.location.href = '/login'
          }}
          style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <LogOut size={12} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}
