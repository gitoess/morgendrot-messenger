'use client'

/**
 * GET /api/status regelmäßig + Mirror-Drain im gleichen Tick; manuelles Refresh für UI.
 * Aus use-chat-view-core ausgelagert (Phase A).
 */

import { useState, useEffect, useCallback } from 'react'
import { fetchStatus, type ApiStatus } from '@/frontend/lib/api'

export type UseChatViewApiStatusPollParams = {
  runMirrorDrain: () => Promise<void>
  /** Standard 12 s */
  pollIntervalMs?: number
}

export function useChatViewApiStatusPoll(p: UseChatViewApiStatusPollParams) {
  const { runMirrorDrain, pollIntervalMs = 12000 } = p
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null)

  const refreshApiStatus = useCallback(async () => {
    const s = await fetchStatus()
    if (!s.error) setApiStatus(s)
  }, [])

  useEffect(() => {
    let alive = true
    const tick = async () => {
      const s = await fetchStatus()
      if (!alive || s.error) return
      setApiStatus(s)
      await runMirrorDrain()
    }
    void tick()
    const id = setInterval(() => void tick(), pollIntervalMs)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [runMirrorDrain, pollIntervalMs])

  return { apiStatus, refreshApiStatus }
}
