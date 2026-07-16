import type { Metadata } from 'next'
import './globals.css'
import AppShell from '@/components/AppShell'
import PreWarm from '@/components/PreWarm'

export const metadata: Metadata = {
  title: 'SOV Panel — YouTube Share-of-Voice | TheBoredMonkey',
  description: 'Enterprise YouTube analytics platform tracking brand Share-of-Voice, keyword rankings, video growth, and competitor intelligence — built by TheBoredMonkey.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PreWarm />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
