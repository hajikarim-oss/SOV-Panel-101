'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Mail, Loader2, AlertCircle, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import Image from 'next/image'

function Logo({ h }: { h: number }) {
  return (
    <Image
      src="/tbm-logo.png"
      alt="The Bored Monkey"
      width={h * 4.5}
      height={h}
      style={{ height: h, width: 'auto', display: 'block' }}
      priority
    />
  )
}

function AnimatedBackground() {
  return (
    <div style={{
      position: 'fixed', inset: 0, overflow: 'hidden', zIndex: 0,
      background: '#F4F7FC',
    }}>
      {/* Base mesh */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `
          radial-gradient(at 20% 20%, rgba(245,130,32,0.06) 0px, transparent 50%),
          radial-gradient(at 80% 10%, rgba(26,115,232,0.07) 0px, transparent 50%),
          radial-gradient(at 50% 80%, rgba(124,58,237,0.05) 0px, transparent 50%),
          radial-gradient(at 90% 60%, rgba(0,200,83,0.04) 0px, transparent 50%),
          radial-gradient(at 10% 90%, rgba(245,130,32,0.04) 0px, transparent 50%)
        `,
      }} />

      {/* Animated floating orbs */}
      <div className="login-orb" style={{
        position: 'absolute', top: '10%', left: '15%', width: 300, height: 300,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,130,32,0.08) 0%, transparent 70%)',
        animation: 'loginDrift 20s ease-in-out infinite',
      }} />
      <div className="login-orb" style={{
        position: 'absolute', bottom: '15%', right: '20%', width: 250, height: 250,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(26,115,232,0.06) 0%, transparent 70%)',
        animation: 'loginDrift2 25s ease-in-out infinite',
      }} />
      <div className="login-orb" style={{
        position: 'absolute', top: '50%', left: '60%', width: 200, height: 200,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.05) 0%, transparent 70%)',
        animation: 'loginDrift3 18s ease-in-out infinite',
      }} />

      {/* Subtle grid pattern */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `
          linear-gradient(rgba(26,115,232,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(26,115,232,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
      }} />

      {/* Transparent brand logo watermarks */}
      {[
        { text: 'atomberg', top: '6%', left: '3%', rotate: '-12deg', w: 200, color: '#1A1A2E', delay: '0s', dur: '22s' },
        { text: 'boAt', top: '18%', left: '72%', rotate: '8deg', w: 140, color: '#1A1A2E', delay: '2s', dur: '25s', underline: '#E53935' },
        { text: 'wakefit', top: '28%', left: '8%', rotate: '-5deg', w: 160, color: '#1A1A2E', delay: '4s', dur: '20s', underline: '#F58220' },
        { text: 'Belong', top: '68%', left: '65%', rotate: '12deg', w: 150, color: '#1A1A2E', delay: '1s', dur: '28s' },
        { text: 'Shoonya', top: '42%', left: '78%', rotate: '-8deg', w: 170, color: '#1A1A2E', delay: '3s', dur: '24s' },
        { text: 'GoPlanet', top: '78%', left: '5%', rotate: '6deg', w: 180, color: '#1A1A2E', delay: '5s', dur: '26s' },
        { text: 'Lotte', top: '5%', left: '55%', rotate: '-3deg', w: 130, color: '#1A1A2E', delay: '2.5s', dur: '21s', underline: '#E53935' },
        { text: 'Noise', top: '55%', left: '3%', rotate: '10deg', w: 130, color: '#1A1A2E', delay: '1.5s', dur: '23s', underline: '#F58220' },
        { text: 'One', top: '85%', left: '40%', rotate: '-10deg', w: 100, color: '#1A1A2E', delay: '6s', dur: '27s' },
        { text: 'Setu', top: '35%', left: '40%', rotate: '4deg', w: 110, color: '#1A1A2E', delay: '3.5s', dur: '19s' },
        { text: 'PhonePe', top: '12%', left: '28%', rotate: '-6deg', w: 180, color: '#1A1A2E', delay: '4.5s', dur: '30s', underline: '#5F259F' },
        { text: 'Zepto', top: '62%', left: '82%', rotate: '7deg', w: 130, color: '#8B5CF6', delay: '2s', dur: '22s' },
        { text: 'AJIO', top: '88%', left: '72%', rotate: '-4deg', w: 110, color: '#E53935', delay: '7s', dur: '25s' },
      ].map((w, i) => (
        <div
          key={i}
          className="brand-watermark"
          style={{
            position: 'absolute',
            top: w.top,
            left: w.left,
            transform: `rotate(${w.rotate})`,
            opacity: 0.1,
            pointerEvents: 'auto',
            userSelect: 'none',
            transition: 'opacity 0.5s ease, transform 0.5s ease',
            animation: `watermarkFloat ${w.dur} ease-in-out ${w.delay} infinite`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.3'
            e.currentTarget.style.transform = `rotate(${w.rotate}) scale(1.08)`
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.1'
            e.currentTarget.style.transform = `rotate(${w.rotate}) scale(1)`
          }}
        >
          <div style={{
            fontSize: Math.round(w.w / 4),
            fontWeight: 900,
            fontFamily: 'Arial Black, Arial, Helvetica, sans-serif',
            color: w.color,
            letterSpacing: '-1px',
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}>
            {w.text}
          </div>
          {w.underline && (
            <div style={{
              height: 3,
              width: '60%',
              borderRadius: 2,
              background: w.underline,
              marginTop: 2,
              opacity: 0.7,
            }} />
          )}
        </div>
      ))}

      <style>{`
        @keyframes loginDrift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, -30px) scale(1.05); }
          66% { transform: translate(-20px, 40px) scale(0.95); }
        }
        @keyframes loginDrift2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-30px, 20px) scale(1.08); }
          66% { transform: translate(30px, -40px) scale(0.92); }
        }
        @keyframes loginDrift3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(20px, 30px) scale(1.03); }
        }
        @keyframes watermarkFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        .brand-watermark { cursor: default; }
      `}</style>
    </div>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null)

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
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to authenticate')
      router.push('/workspace')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = (field: 'email' | 'password') => ({
    width: '100%', height: 44,
    paddingLeft: 40, paddingRight: 14,
    fontSize: 13.5, boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
    border: '1.5px solid',
    borderColor: focusedField === field ? '#F58220' : 'rgba(26,115,232,0.12)',
    borderRadius: 10,
    background: focusedField === field ? '#FFF' : '#FAFBFC',
    outline: 'none',
    transition: 'all 0.2s ease',
    boxShadow: focusedField === field ? '0 0 0 4px rgba(245,130,32,0.1)' : 'none',
    color: '#0F172A',
  })

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      overflow: 'hidden',
    }}>
      <AnimatedBackground />

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'relative', zIndex: 1,
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: 22,
          padding: '40px 36px 32px',
          width: '100%', maxWidth: 400,
          border: '1.5px solid rgba(255,255,255,0.7)',
          boxShadow: [
            '0 4px 24px -2px rgba(0,0,0,0.04)',
            '0 12px 48px -12px rgba(0,0,0,0.06)',
            'inset 0 1px 0 rgba(255,255,255,0.8)',
          ].join(', '),
        }}
      >
        {/* Top decorative accent line */}
        <div style={{
          position: 'absolute', top: 0, left: '20%', right: '20%', height: 3,
          background: 'linear-gradient(90deg, transparent, #F58220, transparent)',
          borderRadius: '0 0 3px 3px',
        }} />

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          style={{ textAlign: 'center', marginBottom: 28 }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <Logo h={52} />
          </div>
          <h1 style={{
            fontSize: 20, fontWeight: 800, color: '#0F172A',
            margin: '0 0 4px', letterSpacing: '-0.3px',
            background: 'linear-gradient(135deg, #0F172A 0%, #334155 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            SOV Panel
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', margin: 0, fontWeight: 500 }}>
            Sign in to your analytics workspace
          </p>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              display: 'flex', gap: 10, padding: '10px 14px', borderRadius: 10,
              background: 'linear-gradient(135deg, #FEF2F2, #FFF5F5)',
              border: '1.5px solid rgba(255,45,85,0.15)',
              color: '#B91C1C', fontSize: 12.5, fontWeight: 500, marginBottom: 20,
              alignItems: 'flex-start',
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </motion.div>
        )}

        <motion.form
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <div>
            <label style={{
              display: 'block', fontSize: 10.5, fontWeight: 700, color: '#475569',
              textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6,
            }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} style={{
                position: 'absolute', left: 13, top: '50%',
                transform: 'translateY(-50%)',
                color: focusedField === 'email' ? '#F58220' : '#94A3B8',
                pointerEvents: 'none', transition: 'color 0.2s ease', zIndex: 1,
              }} />
              <input
                type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                placeholder="you@company.com"
                style={inputStyle('email')}
              />
            </div>
          </div>

          <div>
            <label style={{
              display: 'block', fontSize: 10.5, fontWeight: 700, color: '#475569',
              textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6,
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{
                position: 'absolute', left: 13, top: '50%',
                transform: 'translateY(-50%)',
                color: focusedField === 'password' ? '#F58220' : '#94A3B8',
                pointerEvents: 'none', transition: 'color 0.2s ease', zIndex: 1,
              }} />
              <input
                type="password" required value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                placeholder="••••••••"
                style={inputStyle('password')}
              />
            </div>
          </div>

          <motion.button
            type="submit" disabled={loading}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            style={{
              width: '100%', height: 44, fontSize: 13.5, marginTop: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, fontFamily: 'inherit',
              background: 'linear-gradient(135deg, #F58220 0%, #FF9F43 100%)',
              color: '#FFFFFF', fontWeight: 700,
              border: 'none', borderRadius: 10,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              boxShadow: '0 4px 14px rgba(245,130,32,0.3)',
              transition: 'all 0.2s ease',
              position: 'relative', overflow: 'hidden',
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Signing in...
              </>
            ) : (
              <>
                Sign In
                <ArrowRight size={15} />
                {/* Shine effect */}
                <div style={{
                  position: 'absolute', top: 0, left: '-100%', width: '60%', height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
                  animation: 'loginShine 3s ease-in-out infinite',
                }} />
              </>
            )}
          </motion.button>
        </motion.form>

        <div style={{
          marginTop: 20, textAlign: 'center', fontSize: 11.5,
          color: '#94A3B8', fontWeight: 500, lineHeight: 1.5,
        }}>
          Powered by{' '}
          <span style={{ fontWeight: 700, color: '#F58220' }}>TheBoredMonkey</span>
        </div>
      </motion.div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes loginShine {
          0%, 100% { left: -100%; }
          50% { left: 200%; }
        }
      `}</style>
    </div>
  )
}
