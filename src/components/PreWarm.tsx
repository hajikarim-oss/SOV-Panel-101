'use client'

import { useEffect } from 'react'

// Pre-warms serverless functions on first page load
// Prevents cold start delay on subsequent API calls
// Also ensures workers and scheduled jobs are initialized
export default function PreWarm() {
  useEffect(() => {
    try {
      fetch('/api/warm').catch(() => {})
      fetch('/api/init').catch(() => {})
    } catch {}
  }, [])
  return null
}
