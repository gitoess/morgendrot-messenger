'use client'

/**
 * Delayed Upload (LoRa → IOTA): lokale Warteschlange spiegeln, Drain bei Verbindung.
 * Aus use-chat-view-core ausgelagert (Phase A, kleine Schritte).
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchStatus, sendEncryptedMessageWithTimeout } from '@/frontend/lib/api'
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
} from '@/frontend/lib/api/offline-queue'

export type UseChatViewMirrorDelayParams = {
  loadMessages: (mode?: 'reset' | 'append', packageIdOverride?: string) => Promise<void>
  setStatus: (s: 'idle' | 'success' | 'error') => void
  setStatusMsg: (msg: string) => void
}

export function useChatViewMirrorDelay(p: UseChatViewMirrorDelayParams) {
  const { loadMessages, setStatus, setStatusMsg } = p

  const mirrorDedupRef = useRef(new Set<string>())
  const mirrorDrainInFlightRef = useRef(false)
  const offlineMailboxDrainInFlightRef = useRef(false)
  const [mirrorQueuePending, setMirrorQueuePending] = useState(0)
  const [offlineMailboxQueuePending, setOfflineMailboxQueuePending] = useState(0)

  useEffect(() => {
    try {
      setMirrorQueuePending(getMirrorQueueCount())
      setOfflineMailboxQueuePending(getOfflineMailboxQueueCount())
    } catch {
      /* ignore */
    }
  }, [])

  const runMirrorDrain = useCallback(async () => {
    if (mirrorDrainInFlightRef.current) return
    const s = await fetchStatus()
    if (!('pollClockHint' in s) || s.backendRunning === false || s.locked) return
    if (getMirrorQueueCount() === 0) return
    mirrorDrainInFlightRef.current = true
    try {
      const r = await drainMirrorQueue(
        async (payload) => {
          const res = await sendEncryptedMessageWithTimeout(payload)
          const err = res.error || (res as { message?: string }).message
          return { ok: res.ok === true, error: typeof err === 'string' ? err : undefined }
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
  }, [loadMessages, setStatus, setStatusMsg])

  const runOfflineMailboxDrain = useCallback(async () => {
    if (offlineMailboxDrainInFlightRef.current) return
    const s = await fetchStatus()
    if (!('pollClockHint' in s) || s.backendRunning === false || s.locked) return
    if (getOfflineMailboxQueueCount() === 0) return
    offlineMailboxDrainInFlightRef.current = true
    try {
      const r = await drainOfflineMailboxQueue()
      setOfflineMailboxQueuePending(r.remaining)
      if (r.sent > 0) {
        setStatus('success')
        setStatusMsg(
          r.sent === 1
            ? 'Mailbox-Warteschlange: 1 Eintrag übertragen.'
            : `Mailbox-Warteschlange: ${r.sent} Einträge übertragen.`
        )
        setTimeout(() => setStatus('idle'), 6000)
        void loadMessages()
      }
    } finally {
      offlineMailboxDrainInFlightRef.current = false
    }
  }, [loadMessages, setStatus, setStatusMsg])

  const onDelayMirrorPlaintext = useCallback(
    async (body: string, fromAddress: string) => {
      const dedup = mirrorQueueDedupKey(fromAddress, body)
      if (mirrorDedupRef.current.has(dedup)) return
      if (hasMirrorQueuePending(fromAddress, body)) return
      try {
        const r = await sendEncryptedMessageWithTimeout(mirrorPayloadFromWireBody(body))
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
            lastError: r.error || (r as { message?: string }).message,
          })
          setMirrorQueuePending(getMirrorQueueCount())
          setStatus('error')
          setStatusMsg(
            en.queued
              ? `Delayed Upload: zwischengespeichert (${getMirrorQueueCount()} in Warteschlange). Wird bei Verbindung nachgeliefert.`
              : en.reason || r.error || (r as { message?: string }).message || 'Mirror fehlgeschlagen.'
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
    [loadMessages, runMirrorDrain, setStatus, setStatusMsg]
  )

  return {
    mirrorQueuePending,
    offlineMailboxQueuePending,
    runMirrorDrain,
    runOfflineMailboxDrain,
    onDelayMirrorPlaintext,
  }
}
