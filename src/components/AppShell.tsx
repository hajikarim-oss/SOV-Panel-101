'use client'

import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import TutorialOverlay from '@/components/TutorialOverlay'

const PUBLIC_PATHS = ['/login', '/privacy-policy']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))

  if (isPublic) {
    return <>{children}</>
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content" id="main-content">
        <Header />
        <div className="page-wrapper">
          {children}
        </div>
      </main>
      <TutorialOverlay />
    </div>
  )
}
