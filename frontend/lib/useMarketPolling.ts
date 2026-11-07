'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { getMarketStatus } from '@/lib/api'
import type { MarketStatus } from '@/lib/api'

const STATUS_REFRESH_MS = 60_000 // re-check open/closed once a minute

/**
 * Computes Vietnam market session client-side as a fallback so polling can
 * gate itself even before the first /market/status response arrives.
 */
function localVnStatusIsOpen(): boolean {
  // Convert "now" to Asia/Ho_Chi_Minh (UTC+7) wall clock.
  const now = new Date()
  const vn = new Date(now.getTime() + (now.getTimezoneOffset() + 7 * 60) * 60_000)
  const day = vn.getDay() // 0=Sun .. 6=Sat
  if (day === 0 || day === 6) return false
  const mins = vn.getHours() * 60 + vn.getMinutes()
  const morning = mins >= 9 * 60 && mins <= 11 * 60 + 30
  const afternoon = mins >= 13 * 60 && mins <= 15 * 60
  return morning || afternoon
}

/**
 * Auto-polls `callback` every `intervalMs` while the market is open and the
 * browser tab is visible. Returns the latest known market status.
 *
 * - Pauses when the tab is hidden (saves API calls / avoids rate limit).
 * - Pauses when the market is closed; resumes automatically when it reopens.
 * - Always runs the callback once on mount regardless of session.
 */
export function useMarketPolling(
  callback: () => void | Promise<void>,
  intervalMs = 10_000,
): MarketStatus | null {
  const [status, setStatus] = useState<MarketStatus | null>(null)
  const savedCallback = useRef(callback)
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await getMarketStatus())
    } catch {
      // Fall back to client-side computation if the endpoint is unreachable.
      setStatus({
        is_open: localVnStatusIsOpen(),
        session: localVnStatusIsOpen() ? 'morning' : 'closed',
        server_time: new Date().toISOString(),
        weekday: new Date().getDay(),
      })
    }
  }, [])

  // Track market status independently of the data poll.
  useEffect(() => {
    void refreshStatus()
    const id = setInterval(() => void refreshStatus(), STATUS_REFRESH_MS)
    return () => clearInterval(id)
  }, [refreshStatus])

  const isOpen = status?.is_open ?? localVnStatusIsOpen()

  // Data polling loop, gated by market-open + tab visibility.
  useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    const tick = () => {
      if (document.visibilityState === 'visible' && !cancelled) {
        void savedCallback.current()
      }
    }

    const id = setInterval(tick, intervalMs)

    // Refresh immediately when the tab regains focus.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void savedCallback.current()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [isOpen, intervalMs])

  return status
}
