'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Rocket, MousePointerClick, Search, Tag, BarChart3,
  TrendingUp, Eye, CheckCircle2, ChevronRight, ChevronLeft,
  X, Play, Sparkles, ArrowRight, Zap, Target, Award,
  Video, Hash, Users, Calendar
} from 'lucide-react'

// ── Tutorial Steps Definition ────────────────────────────────────────
interface TutorialStep {
  id: string
  title: string
  subtitle: string
  description: string
  icon: React.ElementType
  color: string
  gradient: string
  highlight?: string       // CSS selector to spotlight
  highlightRoute?: string  // Navigate to this route before showing step
  metrics?: Array<{ label: string; value: string; icon: React.ElementType; color: string }>
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to SOV Panel',
    subtitle: 'Your YouTube Share of Voice Intelligence Platform',
    description: 'Track brand visibility, competitor rankings, and market share across YouTube. Let us show you how to get started in under 2 minutes.',
    icon: Rocket,
    color: '#4C78A8',
    gradient: 'linear-gradient(135deg, #4C78A8 0%, #72B7B2 100%)',
    metrics: [
      { label: 'Track Brands', value: 'Unlimited', icon: Target, color: '#4C78A8' },
      { label: 'YouTube Keywords', value: 'Real-time', icon: Search, color: '#54A24B' },
      { label: 'SOV Analytics', value: 'Automated', icon: BarChart3, color: '#E45756' },
    ],
  },
  {
    id: 'create-campaign',
    title: 'Create Your Campaign',
    subtitle: 'Step 1 — Set up a tracking project',
    description: 'Start by creating a campaign for the product or market you want to analyze. Each campaign tracks keywords, videos, and brands independently.',
    icon: Rocket,
    color: '#4C78A8',
    gradient: 'linear-gradient(135deg, #4C78A8 0%, #79B8FF 100%)',
    highlightRoute: '/control',
    highlight: '[data-tutorial="create-campaign"]',
    metrics: [
      { label: 'Campaigns', value: 'Unlimited', icon: Rocket, color: '#4C78A8' },
      { label: 'Setup Time', value: '< 1 min', icon: Zap, color: '#F59E0B' },
    ],
  },
  {
    id: 'add-keywords',
    title: 'Add Keywords',
    subtitle: 'Step 2 — Define what to track',
    description: 'Add the YouTube search keywords your audience uses. We\'ll track the top 10 results for each keyword and monitor ranking changes daily.',
    icon: Search,
    color: '#54A24B',
    gradient: 'linear-gradient(135deg, #54A24B 0%, #A8D8B9 100%)',
    highlightRoute: '/control',
    highlight: '[data-tutorial="add-keywords"]',
    metrics: [
      { label: 'Keywords', value: 'Per campaign', icon: Hash, color: '#54A24B' },
      { label: 'Tracking', value: 'Top 10 ranks', icon: TrendingUp, color: '#4C78A8' },
    ],
  },
  {
    id: 'tag-brands',
    title: 'Tag Brands',
    subtitle: 'Step 3 — Identify brand mentions',
    description: 'Tag videos with brand names to measure Share of Voice. Use AI-powered brand detection or tag manually for precise control.',
    icon: Tag,
    color: '#B279A2',
    gradient: 'linear-gradient(135deg, #B279A2 0%, #D67195 100%)',
    highlightRoute: '/pending-tagging',
    highlight: '[data-tutorial="tag-brands"]',
    metrics: [
      { label: 'AI Detection', value: 'Gemini powered', icon: Sparkles, color: '#B279A2' },
      { label: 'Manual Tag', value: 'Full control', icon: Tag, color: '#E45756' },
    ],
  },
  {
    id: 'run-scrape',
    title: 'Run a Scrape',
    subtitle: 'Step 4 — Fetch fresh data',
    description: 'Trigger a scrape to discover new videos and update rankings. Data is fetched from YouTube\'s API and stored in your database.',
    icon: Zap,
    color: '#F59E0B',
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #EECA3B 100%)',
    highlightRoute: '/control',
    highlight: '[data-tutorial="run-scrape"]',
    metrics: [
      { label: 'Speed', value: '~30 sec/keyword', icon: Zap, color: '#F59E0B' },
      { label: 'Data Source', value: 'YouTube API', icon: Video, color: '#E45756' },
    ],
  },
  {
    id: 'overview',
    title: 'Your Dashboard',
    subtitle: 'Step 5 — See the big picture',
    description: 'The Overview dashboard shows total viewership, brand SOV pie charts, top videos, channel rankings, and daily trends — all in one place.',
    icon: BarChart3,
    color: '#4C78A8',
    gradient: 'linear-gradient(135deg, #4C78A8 0%, #72B7B2 100%)',
    highlightRoute: '/',
    metrics: [
      { label: 'Real-time', value: 'Live data', icon: Eye, color: '#4C78A8' },
      { label: 'Charts', value: '10+ types', icon: BarChart3, color: '#54A24B' },
    ],
  },
  {
    id: 'sov-trend',
    title: 'SOV Trend Analysis',
    subtitle: 'Track market share over time',
    description: 'Monitor how brand share of voice shifts daily. Spot trends, correlate with campaigns, and measure competitive impact.',
    icon: TrendingUp,
    color: '#72B7B2',
    gradient: 'linear-gradient(135deg, #72B7B2 0%, #A8D8B9 100%)',
    highlightRoute: '/sov-trend',
    metrics: [
      { label: 'Time Range', value: '1 day — 1 year', icon: Calendar, color: '#72B7B2' },
      { label: 'Granularity', value: 'Daily data', icon: TrendingUp, color: '#4C78A8' },
    ],
  },
  {
    id: 'brand-growth',
    title: 'Brand Growth Tracker',
    subtitle: 'Velocity and momentum metrics',
    description: 'Compare brand performance across periods. Identify top gainers, declining brands, and track keyword ranking movements.',
    icon: Award,
    color: '#E45756',
    gradient: 'linear-gradient(135deg, #E45756 0%, #FF9DA6 100%)',
    highlightRoute: '/brand-growth',
    metrics: [
      { label: 'Growth Rate', value: 'Period vs period', icon: TrendingUp, color: '#E45756' },
      { label: 'Rankings', value: 'Weekly tracked', icon: Award, color: '#EECA3B' },
    ],
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    subtitle: 'Start building your intelligence',
    description: 'You now know the essentials. Create your first campaign, add keywords, and watch your market come to life. Our team is here if you need help.',
    icon: CheckCircle2,
    color: '#54A24B',
    gradient: 'linear-gradient(135deg, #54A24B 0%, #72B7B2 100%)',
    metrics: [
      { label: 'Support', value: '24/7 available', icon: Users, color: '#4C78A8' },
      { label: 'Docs', value: 'Full guide', icon: Target, color: '#54A24B' },
    ],
  },
]

// ── Storage Key ──────────────────────────────────────────────────────
const TUTORIAL_KEY = 'sov_tutorial_completed'
const TUTORIAL_STEP_KEY = 'sov_tutorial_step'

function isTutorialCompleted(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(TUTORIAL_KEY) === 'true'
}

function markTutorialCompleted() {
  localStorage.setItem(TUTORIAL_KEY, 'true')
  localStorage.removeItem(TUTORIAL_STEP_KEY)
}

function getSavedStep(): number {
  if (typeof window === 'undefined') return 0
  const saved = localStorage.getItem(TUTORIAL_STEP_KEY)
  return saved ? parseInt(saved, 10) : 0
}

function saveStep(step: number) {
  localStorage.setItem(TUTORIAL_STEP_KEY, String(step))
}

// ── Typewriter Hook ──────────────────────────────────────────────────
function useTypewriter(text: string, speed = 18, enabled = true) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!enabled) { setDisplayed(text); setDone(true); return }
    setDisplayed('')
    setDone(false)
    let i = 0
    const timer = setInterval(() => {
      if (i < text.length) { setDisplayed(text.slice(0, i + 1)); i++ }
      else { setDone(true); clearInterval(timer) }
    }, speed)
    return () => clearInterval(timer)
  }, [text, speed, enabled])

  return { displayed, done }
}

// ── Particle Canvas ──────────────────────────────────────────────────
function ParticleCanvas({ color }: { color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width = canvas.offsetWidth * 2
    const h = canvas.height = canvas.offsetHeight * 2
    ctx.scale(2, 2)

    interface Particle {
      x: number; y: number; vx: number; vy: number
      size: number; alpha: number; color: string; life: number
    }

    const particles: Particle[] = []
    const cw = canvas.offsetWidth
    const ch = canvas.offsetHeight

    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * cw, y: Math.random() * ch,
        vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 3 + 1, alpha: Math.random() * 0.3 + 0.1,
        color, life: Math.random() * 100,
      })
    }

    let raf: number
    function draw() {
      if (!ctx) return
      ctx.clearRect(0, 0, cw, ch)
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy; p.life += 0.5
        if (p.x < 0) p.x = cw; if (p.x > cw) p.x = 0
        if (p.y < 0) p.y = ch; if (p.y > ch) p.y = 0
        const pulse = Math.sin(p.life * 0.05) * 0.15 + 0.85
        ctx.globalAlpha = p.alpha * pulse
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [color])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  )
}

// ── Main Component ───────────────────────────────────────────────────
export default function TutorialOverlay({ forceShow = false }: { forceShow?: boolean }) {
  const [visible, setVisible] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [animDir, setAnimDir] = useState<'next' | 'back'>('next')
  const [isAnimating, setIsAnimating] = useState(false)
  const [showContent, setShowContent] = useState(false)

  const step = TUTORIAL_STEPS[currentStep]
  const progress = ((currentStep + 1) / TUTORIAL_STEPS.length) * 100
  const isLast = currentStep === TUTORIAL_STEPS.length - 1
  const isFirst = currentStep === 0

  const { displayed: titleText, done: titleDone } = useTypewriter(step.title, 22, showContent)
  const { displayed: descText } = useTypewriter(step.description, 12, showContent && titleDone)

  // Show on first visit or if forced
  useEffect(() => {
    if (forceShow) { setVisible(true); return }
    if (!isTutorialCompleted()) {
      const saved = getSavedStep()
      setCurrentStep(saved)
      setTimeout(() => setVisible(true), 800)
    }
  }, [forceShow])

  // Lock body scroll when visible
  useEffect(() => {
    if (visible) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [visible])

  const goToStep = useCallback((idx: number) => {
    if (isAnimating || idx < 0 || idx >= TUTORIAL_STEPS.length) return
    setAnimDir(idx > currentStep ? 'next' : 'back')
    setIsAnimating(true)
    setShowContent(false)
    setTimeout(() => {
      setCurrentStep(idx)
      saveStep(idx)
      setTimeout(() => { setIsAnimating(false); setShowContent(true) }, 50)
    }, 200)
  }, [currentStep, isAnimating])

  const handleNext = useCallback(() => {
    if (isLast) {
      markTutorialCompleted()
      setVisible(false)
      return
    }
    goToStep(currentStep + 1)
  }, [currentStep, isLast, goToStep])

  const handleBack = useCallback(() => {
    goToStep(currentStep - 1)
  }, [currentStep, goToStep])

  const handleSkip = useCallback(() => {
    markTutorialCompleted()
    setVisible(false)
  }, [])

  const handleReplay = useCallback(() => {
    localStorage.removeItem(TUTORIAL_KEY)
    setCurrentStep(0)
    setVisible(true)
    saveStep(0)
  }, [])

  // Expose replay globally
  useEffect(() => {
    ;(window as any).__replayTutorial = handleReplay
    return () => { delete (window as any).__replayTutorial }
  }, [handleReplay])

  if (!visible) return null

  const Icon = step.icon

  return (
    <>
      <style>{`
        @keyframes tutorialFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes tutorialSlideUp { from { opacity: 0; transform: translateY(30px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes tutorialSlideLeft { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes tutorialSlideRight { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes tutorialPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes tutorialGlow { 0%, 100% { box-shadow: 0 0 20px rgba(76,120,168,0.15); } 50% { box-shadow: 0 0 40px rgba(76,120,168,0.25); } }
        @keyframes tutorialBounce { 0%, 20%, 50%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-8px); } 60% { transform: translateY(-4px); } }
        @keyframes tutorialProgress { from { width: 0; } }
        @keyframes tutorialIconFloat { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-8px) rotate(3deg); } }
        @keyframes tutorialCheckPop { 0% { transform: scale(0); opacity: 0; } 50% { transform: scale(1.2); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes tutorialDots { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }
        .tutorial-backdrop { animation: tutorialFadeIn 0.3s ease; }
        .tutorial-card { animation: tutorialSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .tutorial-card.slide-next { animation: tutorialSlideLeft 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
        .tutorial-card.slide-back { animation: tutorialSlideRight 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
        .tutorial-icon-float { animation: tutorialIconFloat 3s ease-in-out infinite; }
        .tutorial-glow { animation: tutorialGlow 3s ease-in-out infinite; }
        .tutorial-bounce { animation: tutorialBounce 1s ease; }
        .tutorial-metric-card { transition: all 0.2s ease; }
        .tutorial-metric-card:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
        .tutorial-btn { transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
        .tutorial-btn:hover { transform: translateY(-1px); }
        .tutorial-btn:active { transform: translateY(0) scale(0.98); }
        .tutorial-dot { transition: all 0.3s ease; }
        .tutorial-dot.active { width: 24px; border-radius: 6px; }
        .tutorial-check { animation: tutorialCheckPop 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .tutorial-typing-cursor { animation: tutorialDots 1.4s infinite; }
        .tutorial-complete-ring { animation: tutorialPulse 2s ease-in-out infinite; }
      `}</style>

      {/* Backdrop */}
      <div
        className="tutorial-backdrop"
        onClick={handleSkip}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      />

      {/* Main Card */}
      <div
        className={`tutorial-card ${isAnimating ? (animDir === 'next' ? 'slide-next' : 'slide-back') : ''}`}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 680, margin: '0 20px',
            background: '#FFFFFF', borderRadius: 24,
            boxShadow: '0 25px 80px rgba(0,0,0,0.25), 0 8px 32px rgba(0,0,0,0.1)',
            overflow: 'hidden', pointerEvents: 'all',
            position: 'relative',
          }}
        >
          {/* Progress Bar */}
          <div style={{ height: 3, background: '#F1F5F9', position: 'relative', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4,
              background: step.gradient,
              width: `${progress}%`,
              transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
            }} />
          </div>

          {/* Top Controls */}
          <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8, zIndex: 10 }}>
            <button
              onClick={handleSkip}
              style={{
                padding: '6px 14px', borderRadius: 8, border: 'none',
                background: 'rgba(0,0,0,0.04)', color: '#94A3B8',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.08)'; e.currentTarget.style.color = '#64748B' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; e.currentTarget.style.color = '#94A3B8' }}
            >
              Skip Tour
            </button>
            <button
              onClick={handleSkip}
              style={{
                width: 28, height: 28, borderRadius: 8, border: 'none',
                background: 'rgba(0,0,0,0.04)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
            >
              <X size={14} style={{ color: '#94A3B8' }} />
            </button>
          </div>

          <div style={{ padding: '32px 36px 28px' }}>
            {/* Step Counter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, color: step.color,
                textTransform: 'uppercase', letterSpacing: '1px',
                background: `${step.color}10`, padding: '3px 10px',
                borderRadius: 6,
              }}>
                Step {currentStep + 1} of {TUTORIAL_STEPS.length}
              </span>
              {step.subtitle && (
                <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>
                  {step.subtitle}
                </span>
              )}
            </div>

            {/* Icon + Title Area */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 20, alignItems: 'flex-start' }}>
              {/* Icon */}
              <div className="tutorial-icon-float tutorial-glow" style={{
                width: 64, height: 64, borderRadius: 18,
                background: step.gradient,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, boxShadow: `0 8px 24px ${step.color}30`,
                position: 'relative',
              }}>
                <ParticleCanvas color={`${step.color}40`} />
                <Icon size={28} style={{ color: '#FFF', position: 'relative', zIndex: 1 }} />
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{
                  fontSize: 22, fontWeight: 800, color: '#0F172A',
                  margin: 0, lineHeight: 1.2, minHeight: 30,
                }}>
                  {titleText}
                  {!titleDone && <span className="tutorial-typing-cursor" style={{ color: step.color, marginLeft: 2 }}>|</span>}
                </h2>
                <p style={{
                  fontSize: 13.5, color: '#64748B', margin: '8px 0 0',
                  lineHeight: 1.6, minHeight: 44,
                }}>
                  {descText}
                </p>
              </div>
            </div>

            {/* Metrics Row */}
            {step.metrics && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
                {step.metrics.map((m, i) => (
                  <div
                    key={i}
                    className="tutorial-metric-card"
                    style={{
                      flex: 1, padding: '12px 14px', borderRadius: 12,
                      background: '#F8FAFC', border: '1px solid #F1F5F9',
                      animationDelay: `${i * 80}ms`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 6,
                        background: `${m.color}12`, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <m.icon size={11} style={{ color: m.color }} />
                      </div>
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {m.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Complete State */}
            {step.id === 'complete' && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '16px 0', marginBottom: 8,
              }}>
                <div className="tutorial-complete-ring" style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #54A24B, #72B7B2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 0 6px rgba(84,162,75,0.1), 0 0 0 12px rgba(84,162,75,0.05)',
                }}>
                  <CheckCircle2 size={32} style={{ color: '#FFF' }} />
                </div>
              </div>
            )}

            {/* Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Back */}
              <div>
                {!isFirst ? (
                  <button
                    className="tutorial-btn"
                    onClick={handleBack}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '10px 18px', borderRadius: 10,
                      border: '1.5px solid #E2E8F0', background: '#FFF',
                      color: '#64748B', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <ChevronLeft size={15} /> Back
                  </button>
                ) : <div />}
              </div>

              {/* Dots */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {TUTORIAL_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`tutorial-dot ${i === currentStep ? 'active' : ''}`}
                    onClick={() => goToStep(i)}
                    style={{
                      width: i === currentStep ? 24 : 7,
                      height: 7,
                      borderRadius: i === currentStep ? 6 : '50%',
                      background: i === currentStep ? step.color : i < currentStep ? `${step.color}40` : '#E2E8F0',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>

              {/* Next / Finish */}
              <button
                className="tutorial-btn"
                onClick={handleNext}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 22px', borderRadius: 10,
                  border: 'none', background: step.gradient,
                  color: '#FFF', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: `0 4px 14px ${step.color}35`,
                }}
              >
                {isLast ? (
                  <><Play size={14} /> Get Started</>
                ) : (
                  <>{currentStep === 0 ? 'Start Tour' : 'Next'} <ChevronRight size={15} /></>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
