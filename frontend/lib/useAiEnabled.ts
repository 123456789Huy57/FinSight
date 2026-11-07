'use client'

import { useEffect, useState } from 'react'
import { getDataSources } from '@/lib/api'

let cached: boolean | null = null
let pending: Promise<boolean> | null = null

function load(): Promise<boolean> {
  if (!pending) {
    pending = getDataSources()
      .then((d) => (cached = Boolean(d.ai_enabled)))
      .catch(() => (cached = false))
  }
  return pending
}

export function useAiEnabled(): boolean {
  const [enabled, setEnabled] = useState<boolean>(cached ?? false)
  useEffect(() => {
    let alive = true
    load().then((v) => alive && setEnabled(v))
    return () => { alive = false }
  }, [])
  return enabled
}
