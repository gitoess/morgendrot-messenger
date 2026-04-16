'use client'

/**
 * Delayed Upload (LoRa → IOTA): lokale Warteschlange spiegeln, Drain bei Verbindung.
 * Aus use-chat-view-core ausgelagert (Phase A, kleine Schritte).
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchStatus } from '@/frontend/lib/api'
import { sendEncryptedMailboxHybrid } from '@/frontend/lib/mailbox-send-hybrid'
import {
  drainMirrorQueue,
  enqueueMirrorFailure,
  getMirrorQueueCount,
  hasMirrorQueuePending,
  mirrorPayloadFromWireBody,
  mirrorQueueDedupKey,
} from '@/frontend/lib/delayed-mirror-queue'
import {
  drainOfflineMailboxQueue,
  getOfflineMailboxQueueCount,
  loadOfflineMailboxQueue,
  shouldDeferDrainAttempt,
} from '@/frontend/lib/api/offline-queue'
import { drainAttestationQueue } from '@/frontend/lib/attestation-queue'
import {
  applyDirectMailboxChainSnapshotFromNetworkIds,
  syncDirectMailboxFlagsFromApiStatus,
  getDirectMailboxChainSnapshot,
} from '@/frontend/lib/direct-iota-chain-context'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import { getDirectIotaSessionSigner } from '@/frontend/lib/direct-iota-mnemonic-session'
import { isDirectMailboxDrainEnabled, isIotaRelayOnlyMode } from '@/frontend/lib/direct-iota-plain-submit'

export type UseChatViewMirrorDelayParams = {
  loadMessages: (mode?: 'reset' | 'append', packageIdOverride?: string) => Promise<void>
  setStatus: (s: 'idle' | 'success' | 'error') => void
  setStatusMsg: (msg: string) => void
  /** Privater Chat: Peer-Adresse für Direct-Mailbox vor `/send` (Hybrid). */
  mailboxRecipient: string
}

export function useChatViewMirrorDelay(p: UseChatViewMirrorDelayParams) {
  const { loadMessages, setStatus, setStatusMsg, mailboxRecipient } = p

  const mirrorDedupRef = useRef(new Set<string>())
  const mirrorDrainInFlightRef = useRef(false)
  const offlineMailboxDrainInFlightRef = useRef(false)
  const [mirrorQueuePending, setMirrorQueuePending] = useState(0)
  const [offlineMailboxQueuePending, setOfflineMailboxQueuePending] = useState(0)
  const [offlineMailboxQueueUntrustedTimeCount, setOfflineMailboxQueueUntrustedTimeCount] = useState(0)
  const [offlineMailboxQueueBackoffCount, setOfflineMailboxQueueBackoffCount] = useState(0)
  const [offlineMailboxQueueErrorHint, setOfflineMailboxQueueErrorHint] = useState('')

  const refreshOfflineMailboxQueueCount = useCallback(() => {
    try {
      const items = loadOfflineMailboxQueue()
      const now = Date.now()
      setOfflineMailboxQueuePending(items.length)
      setOfflineMailboxQueueUntrustedTimeCount(items.filter((q) => q.timeIsTrusted !== true).length)
      setOfflineMailboxQueueBackoffCount(items.filter((q) => shouldDeferDrainAttempt(q, now)).length)
      const withErr = items.filter((q) => q.lastError && q.lastError.trim())
      if (withErr.length === 0) {
        setOfflineMailboxQueueErrorHint('')
      } else {
        const top = [...withErr].sort((a, b) => b.attempts - a.attempts || a.createdAt - b.createdAt)[0]
        const msg = (top?.lastError ?? '').replace(/\s+/g, ' ').trim()
        setOfflineMailboxQueueErrorHint(msg.length > 140 ? `${msg.slice(0, 137)}…` : msg)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    try {
      setMirrorQueuePending(getMirrorQueueCount())
      refreshOfflineMailboxQueueCount()
    } catch {
      /* ignore */
    }
  }, [refreshOfflineMailboxQueueCount])

  const runMirrorDrain = useCallback(async () => {
    if (mirrorDrainInFlightRef.current) return
    const s = await fetchStatus()
    if (!('pollClockHint' in s) || s.backendRunning === false || s.locked) return
    if (getMirrorQueueCount() === 0) return
    mirrorDrainInFlightRef.current = true
    try {
      const r = await drainMirrorQueue(
        async (payload) => {
          const res = await sendEncryptedMailboxHybrid(mailboxRecipient.trim(), payload)
          if (res.ok) return { ok: true as const }
          const err = res.error || res.message
          return { ok: false as const, error: typeof err === 'string' ? err : undefined }
        },
        (item) => {
          mirrorDedupRef.current.add(mirrorQueueDedupKey(item.fromAddress, item.wireBody))
        }
      )
      setMirrorQueuePending(r.remaining)
      if (r.sent > 0) {
        setStatus('success')
        setStatusMsg(
          r.sent === 1
            ? 'Delayed Upload: 1 Eintrag aus Warteschlange nach IOTA übertragen.'
            : `Delayed Upload: ${r.sent} Einträge aus Warteschlange nach IOTA übertragen.`
        )
        setTimeout(() => setStatus('idle'), 6000)
        void loadMessages()
      }
    } finally {
      mirrorDrainInFlightRef.current = false
    }
  }, [loadMessages, mailboxRecipient, setStatus, setStatusMsg])

  const runOfflineMailboxDrain = useCallback(async () => {
    if (offlineMailboxDrainInFlightRef.current) return
    if (getOfflineMailboxQueueCount() === 0) return
    offlineMailboxDrainInFlightRef.current = true
    try {
      const s = await fetchStatus()
      const backendOk = 'pollClockHint' in s && s.backendRunning !== false && !s.locked
      if (backendOk) {
        syncDirectMailboxFlagsFromApiStatus(s)
        try {
          const res = await fetch('/api/current-ids')
          const j = (await res.json()) as {
            ok?: boolean
            packageId?: string
            mailboxId?: string
            myAddress?: string
          }
          if (j.ok === true) applyDirectMailboxChainSnapshotFromNetworkIds(j)
        } catch {
          /* ignore */
        }
      }
      const canDrainWithoutBackend =
        !backendOk &&
        !isIotaRelayOnlyMode() &&
        isDirectMailboxDrainEnabled() &&
        Boolean(getConfiguredDirectIotaRpcUrl()) &&
        Boolean(getDirectIotaSessionSigner()) &&
        Boolean(getDirectMailboxChainSnapshot())
      if (!backendOk && !canDrainWithoutBackend) return

      const r = await drainOfflineMailboxQueue()
      refreshOfflineMailboxQueueCount()
      if (r.sent > 0 && r.failed === 0) {
        setStatus('success')
        setStatusMsg(
          r.sent === 1
            ? 'Mailbox-Warteschlange: 1 Eintrag übertragen.'
            : `Mailbox-Warteschlange: ${r.sent} Einträge übertragen.`
        )
        setTimeout(() => setStatus('idle'), 6000)
        void loadMessages()
      } else if (r.sent > 0 && r.failed > 0) {
        setStatus('error')
        setStatusMsg(
          r.failed === 1
            ? `Mailbox-Warteschlange: ${r.sent} übertragen, 1 Eintrag erneut fehlgeschlagen (Backoff § H.12 / SYNC §8.1).`
            : `Mailbox-Warteschlange: ${r.sent} übertragen, ${r.failed} erneut fehlgeschlagen (Backoff).`
        )
        setTimeout(() => setStatus('idle'), 9000)
        void loadMessages()
      } else if (r.failed > 0) {
        setStatus('error')
        const items = loadOfflineMailboxQueue()
        const hint = items
          .map((q) => q.lastError)
          .find((e) => e && e.trim())
        const tail = hint ? ` Letzte Meldung: ${hint.replace(/\s+/g, ' ').trim().slice(0, 120)}` : ''
        setStatusMsg(
          r.failed === 1
            ? `Mailbox-Warteschlange: erneuter Versand für 1 Eintrag fehlgeschlagen.${tail}`
            : `Mailbox-Warteschlange: erneuter Versand für ${r.failed} Einträge fehlgeschlagen.${tail}`
        )
        setTimeout(() => setStatus('idle'), 10000)
      }
      await drainAttestationQueue()
    } finally {
      offlineMailboxDrainInFlightRef.current = false
    }
  }, [loadMessages, refreshOfflineMailboxQueueCount, setStatus, setStatusMsg])

  const onDelayMirrorPlaintext = useCallback(
    async (body: string, fromAddress: string) => {
      const dedup = mirrorQueueDedupKey(fromAddress, body)
      if (mirrorDedupRef.current.has(dedup)) return
      if (hasMirrorQueuePending(fromAddress, body)) return
      try {
        const r = await sendEncryptedMailboxHybrid(mailboxRecipient.trim(), mirrorPayloadFromWireBody(body))
        if (r.ok) {
          mirrorDedupRef.current.add(dedup)
          setStatus('success')
          setStatusMsg('Delayed Upload: Inhalt zusätzlich per IOTA gespeichert.')
          setTimeout(() => setStatus('idle'), 6000)
          void loadMessages()
        } else {
          const en = enqueueMirrorFailure({
            wireBody: body,
            fromAddress,
            lastError: r.error || r.message,
          })
          setMirrorQueuePending(getMirrorQueueCount())
          setStatus('error')
          setStatusMsg(
            en.queued
              ? `Delayed Upload: zwischengespeichert (${getMirrorQueueCount()} in Warteschlange). Wird bei Verbindung nachgeliefert.`
              : en.reason || r.error || r.message || 'Mirror fehlgeschlagen.'
          )
          setTimeout(() => setStatus('idle'), 8000)
          void runMirrorDrain()
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        enqueueMirrorFailure({ wireBody: body, fromAddress, lastError: msg })
        setMirrorQueuePending(getMirrorQueueCount())
        setStatus('error')
        setStatusMsg(`Delayed Upload: zwischengespeichert (${msg.slice(0, 100)})`)
        setTimeout(() => setStatus('idle'), 8000)
        void runMirrorDrain()
      }
    },
    [loadMessages, mailboxRecipient, runMirrorDrain, setStatus, setStatusMsg]
  )

  return {
    mirrorQueuePending,
    offlineMailboxQueuePending,
    offlineMailboxQueueUntrustedTimeCount,
    offlineMailboxQueueBackoffCount,
    offlineMailboxQueueErrorHint,
    refreshOfflineMailboxQueueCount,
    runMirrorDrain,
    runOfflineMailboxDrain,
    onDelayMirrorPlaintext,
  }
}
