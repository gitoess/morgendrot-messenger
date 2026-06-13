'use client'

import { useEffect, useRef, useState } from 'react'
import type { ApiStatus } from '@/frontend/lib/api'
import {
  FORENSIC_BATCH_CHANGED,
  readForensicBatchAutoArchiveEnabled,
  readForensicBatchAutoIntervalMin,
  readForensicBatchArchiveMode,
} from '@/frontend/lib/forensic-batch-config'
import { runForensicBatchArchiveFromInbox } from '@/frontend/lib/einsatz-forensic-batch-flow'
import { canTryLivePlaintextDirectMailbox } from '@/frontend/lib/direct-iota-plain-submit'
import { canTryLiveEncryptedDirectMailbox } from '@/frontend/lib/direct-iota-encrypted-submit'
import { fetchForensicBatchConfig } from '@/frontend/lib/api/forensic-batch-api'
import { isBossApiLikelyOnline } from '@/frontend/lib/api/boss-api-status'
import { useForensicBatchRegistrySync } from '@/frontend/hooks/use-forensic-batch-registry-sync'

function canRunForensicAutoBatch(recipient: string, mode: ReturnType<typeof readForensicBatchArchiveMode>): boolean {
  if (mode === 'encrypted') return canTryLiveEncryptedDirectMailbox(recipient)
  return canTryLivePlaintextDirectMailbox()
}

/**
 * Periodisches Batch-Archiv: Boss-Scheduler wenn API online, sonst PWA-Timer.
 */
export function useForensicBatchAutoArchive(p: {
  apiStatus?: ApiStatus | null
  enabled?: boolean
}): {
  lastRunAt: number | null
  lastStatus: string
  bossSchedulerActive: boolean
  bossSchedulerHint: string
  useBossPath: boolean
} {
  const [lastRunAt, setLastRunAt] = useState<number | null>(null)
  const [lastStatus, setLastStatus] = useState('')
  const [bossSchedulerActive, setBossSchedulerActive] = useState(false)
  const [bossSchedulerHint, setBossSchedulerHint] = useState('')
  const runningRef = useRef(false)

  const myAddress = (p.apiStatus?.myAddress ?? '').trim().toLowerCase()
  const autoOn = p.enabled ?? readForensicBatchAutoArchiveEnabled()
  const intervalMin = readForensicBatchAutoIntervalMin()
  const useBossPath = isBossApiLikelyOnline(p.apiStatus)

  useForensicBatchRegistrySync(p.apiStatus)

  useEffect(() => {
    if (!autoOn || !useBossPath) {
      setBossSchedulerActive(false)
      setBossSchedulerHint('')
      return
    }
    let cancelled = false
    const refreshConfig = () =>
      fetchForensicBatchConfig().then((cfg) => {
        if (cancelled || !cfg.ok) return
        setBossSchedulerActive(cfg.config.autoEnabled)
        if (cfg.config.autoEnabled) {
          setBossSchedulerHint(
            `Boss-PC Scheduler aktiv (${cfg.config.autoIntervalMin} Min, Modus ${cfg.config.mode}).` +
              (cfg.config.lastStatus ? ` ${cfg.config.lastStatus}` : '')
          )
          if (cfg.config.lastRunAt) setLastRunAt(cfg.config.lastRunAt)
        } else {
          setBossSchedulerHint(
            'Boss-API online — Auto-Batch aus. Checkbox im Panel steuert den Boss-Scheduler.'
          )
        }
      })
    void refreshConfig()
    const poll = window.setInterval(() => void refreshConfig(), 60_000)
    return () => {
      cancelled = true
      window.clearInterval(poll)
    }
  }, [autoOn, useBossPath])

  useEffect(() => {
    if (!autoOn || !/^0x[a-f0-9]{64}$/.test(myAddress) || useBossPath) return
    const ms = intervalMin * 60_000
    const id = window.setInterval(() => {
      if (runningRef.current) return
      if (!canRunForensicAutoBatch(myAddress, readForensicBatchArchiveMode())) return
      runningRef.current = true
      void runForensicBatchArchiveFromInbox({
        archiveRecipient: myAddress,
        onlyNew: true,
        mode: readForensicBatchArchiveMode(),
        preferBossApi: false,
      })
        .then((out) => {
          setLastRunAt(Date.now())
          if (out.ok) {
            setLastStatus(
              out.messageCount > 0
                ? `Auto-Batch (PWA): ${out.messageCount} Nachricht(en) in ${out.txCount} TX (${out.mode}).`
                : 'Auto-Batch (PWA): nichts Neues.'
            )
          } else if (!out.error.includes('Keine neuen') && !out.error.includes('läuft bereits')) {
            setLastStatus(`Auto-Batch (PWA): ${out.error}`)
          }
        })
        .finally(() => {
          runningRef.current = false
        })
    }, ms)
    return () => window.clearInterval(id)
  }, [autoOn, intervalMin, myAddress, useBossPath])

  useEffect(() => {
    const refresh = () => setLastRunAt((t) => t)
    window.addEventListener(FORENSIC_BATCH_CHANGED, refresh)
    return () => window.removeEventListener(FORENSIC_BATCH_CHANGED, refresh)
  }, [])

  return { lastRunAt, lastStatus, bossSchedulerActive, bossSchedulerHint, useBossPath }
}
