'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Lock, Mail, Loader2, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.includes('application/json')) {
        throw new Error(
          res.status === 404
            ? 'Login service unavailable. Restart the dev server with npm run dev.'
            : 'Server returned an unexpected response. Please try again.'
        )
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to authenticate')
      }

      // Success redirect
      if (data.role === 'admin') {
        router.push('/')
      } else {
        router.push('/client')
      }
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex', minHeight: '100vh', width: '100vw', background: '#F8FAFC',
      alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{
        background: '#FFFFFF', borderRadius: 16, padding: '40px 32px',
        width: '100%', maxWidth: 400, border: '1px solid #E2E8F0',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', width: 48, height: 48, borderRadius: 12,
            background: 'rgba(26,115,232,0.1)', color: '#1A73E8',
            alignItems: 'center', justifyContent: 'center', marginBottom: 16
          }}>
            <Shield size={24} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0' }}>Welcome to SOV Panel</h1>
          <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>Sign in to access your intelligence dashboard</p>
        </div>

        {error && (
          <div style={{
            display: 'flex', gap: 10, padding: 12, borderRadius: 8,
            background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C',
            fontSize: 12.5, fontWeight: 500, marginBottom: 20, alignItems: 'center'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              <input
                type="email"
                required
                className="input"
                style={{ width: '100%', paddingLeft: 38, boxSizing: 'border-box' }}
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              <input
                type="password"
                required
                className="input"
                style={{ width: '100%', paddingLeft: 38, boxSizing: 'border-box' }}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn"
            style={{
              background: '#1A73E8', color: '#FFFFFF', padding: '10px 16px',
              borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13.5,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, marginTop: 8
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Signing in...
              </>
            ) : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 11.5, color: '#94A3B8' }}>
          If no accounts exist, the first login attempt auto-creates an admin account.
        </div>
      </div>
      <style>{`
        .input {
          height: 40px;
          border: 1px solid #CBD5E1;
          border-radius: 8px;
          outline: none;
          font-size: 13.5px;
          transition: border-color 0.2s;
        }
        .input:focus {
          border-color: #1A73E8;
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
