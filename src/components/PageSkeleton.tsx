'use client'

const shimmer = `@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`

function Bar({ width = '100%', height = 12, radius = 6, style = {} }: { width?: string | number; height?: string | number; radius?: number; style?: React.CSSProperties }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      ...style,
    }} />
  )
}

export function PageSkeleton({ rows = 3, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ padding: '0 0 40px' }}>
      <style>{shimmer}</style>
      {/* Header skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Bar width={220} height={24} radius={6} style={{ marginBottom: 8 }} />
          <Bar width={320} height={12} radius={4} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Bar width={80} height={32} radius={8} />
          <Bar width={80} height={32} radius={8} />
        </div>
      </div>

      {/* KPI cards skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12, marginBottom: 24 }}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', border: '1px solid #F1F5F9' }}>
            <Bar width={60} height={10} radius={4} style={{ marginBottom: 10 }} />
            <Bar width={100} height={22} radius={6} style={{ marginBottom: 6 }} />
            <Bar width={70} height={10} radius={4} />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', border: '1px solid #F1F5F9', marginBottom: 20 }}>
        <Bar width={180} height={14} radius={4} style={{ marginBottom: 6 }} />
        <Bar width={280} height={10} radius={4} style={{ marginBottom: 20 }} />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 200 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <Bar key={i} width="100%" height={`${30 + Math.random() * 70}%`} radius={4} />
          ))}
        </div>
      </div>

      {/* Table skeleton */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #F1F5F9', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9' }}>
          <Bar width={160} height={14} radius={4} />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px', borderBottom: i < rows - 1 ? '1px solid #F8FAFC' : 'none' }}>
            <Bar width={32} height={32} radius={8} />
            <Bar width={`${40 + Math.random() * 30}%`} height={12} radius={4} />
            <div style={{ flex: 1 }} />
            <Bar width={60} height={12} radius={4} />
            <Bar width={50} height={12} radius={4} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', border: '1px solid #F1F5F9' }}>
      <style>{shimmer}</style>
      <Bar width={200} height={14} radius={4} style={{ marginBottom: 6 }} />
      <Bar width={300} height={10} radius={4} style={{ marginBottom: 20 }} />
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 240 }}>
        {Array.from({ length: 20 }).map((_, i) => (
          <Bar key={i} width="100%" height={`${20 + Math.random() * 80}%`} radius={4} />
        ))}
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #F1F5F9', overflow: 'hidden' }}>
      <style>{shimmer}</style>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', borderBottom: i < rows - 1 ? '1px solid #F8FAFC' : 'none' }}>
          <Bar width={36} height={36} radius={8} />
          <div style={{ flex: 1 }}>
            <Bar width={`${50 + Math.random() * 30}%`} height={12} radius={4} style={{ marginBottom: 6 }} />
            <Bar width={`${30 + Math.random() * 20}%`} height={10} radius={4} />
          </div>
          <Bar width={60} height={12} radius={4} />
          <Bar width={50} height={24} radius={12} />
        </div>
      ))}
    </div>
  )
}