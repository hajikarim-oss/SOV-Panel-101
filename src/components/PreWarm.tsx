'use client'

import { useEffect } from 'react'

// Pre-warms serverless functions on first page load
// Prevents cold start delay on subsequent API calls
export default function PreWarm() {
  useEffect(() => {
    try {
      fetch('/api/warm').catch(() => {})
    } catch {}
  }, [])
  return null
}
