'use client'

/**
 * Delayed Upload (LoRa → IOTA): lokale Warteschlange spiegeln, Drain bei Verbindung.
 * Aus use-chat-view-core ausgelagert (Phase A, kleine Schritte).
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchStatus, parseMailboxOutNonceMarker } from '@/frontend/lib/api'
import { sendEncryptedMailboxHybrid } from '@/frontend/lib/mailbox-send-hybrid'
import {
  isForensicImageMailboxAttestationEnabled,
  prependMailboxNonceIfMissingForEncryptedWire,
  runForensicMailboxAttestationAfterSend,
} from '@/frontend/lib/forensic-mailbox-attestation'
import { formatTxDigestStatusSuffix } from '@/frontend/lib/iota-tx-explorer-hint'
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
  clearOfflineMailboxQueue,
  getOfflineMailboxQueueCount,
  loadOfflineMailboxQueue,
  saveOfflineMailboxQueue,
  backoffMsForDrainAttempt,
  shouldDeferDrainAttempt,
} from '@/frontend/lib/api/offline-queue'
import { EINSATZ_NETWORK_PROFILES_CHANGED } from '@/frontend/lib/einsatz-network-profiles'
import {
  applyDirectChainSnapshotFromStatusOrNetworkProfile,
  isWrongNetworkPackageError,
  purgeStaleOfflineMailboxQueue,
  syncActiveNetworkChainSnapshot,
} from '@/frontend/lib/active-network-chain-sync'
import { drainAttestationQueue, loadAttestationQueue } from '@/frontend/lib/attestation-queue'
import {
  syncDirectMailboxFlagsFromApiStatus,
  getDirectMailboxChainSnapshot,
} from '@/frontend/lib/direct-iota-chain-context'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import { getDirectIotaSessionSigner } from '@/frontend/lib/direct-iota-mnemonic-session'
import { isDirectMailboxDrainEnabled, isIotaRelayOnlyMode } from '@/frontend/lib/direct-iota-plain-submit'

export type UseChatViewMirrorDelayParams = {
  loadMessages: (
    mode?: 'reset' | 'append' | 'poll',
    packageIdOverride?: unknown,
    opts?: { silent?: boolean }
  ) => Promise<void>
  setStatus: (s: 'idle' | 'success' | 'error') => void
  setStatusMsg: (msg: string) => void
  /** Privater Chat: Peer-Adresse für Direct-Mailbox vor `/send` (Hybrid). */
  mailboxRecipient: string
  /** Eigene Wallet-Adresse — für Forensic-`canonical_msg_ref` nach Delayed-Mirror. */
  senderAddress: string
}

export function useChatViewMirrorDelay(p: UseChatViewMirrorDelayParams) {
  const { loadMessages, setStatus, setStatusMsg, mailboxRecipient, senderAddress } = p

  const mirrorDedupRef = useRef(new Set<string>())
  const mirrorDrainInFlightRef = useRef(false)
  const offlineMailboxDrainInFlightRef = useRef(false)
  const [mirrorQueuePending, setMirrorQueuePending] = useState(0)
  const [offlineMailboxQueuePending, setOfflineMailboxQueuePending] = useState(0)
  const [offlineMailboxQueueUntrustedTimeCount, setOfflineMailboxQueueUntrustedTimeCount] = useState(0)
  const [offlineMailboxQueueBackoffCount, setOfflineMailboxQueueBackoffCount] = useState(0)
  const [offlineMailboxQueueErrorHint, setOfflineMailboxQueueErrorHint] = useState('')
  const [offlineMailboxQueueItems, setOfflineMailboxQueueItems] = useState<
    {
      id: string
      recipient: string
      createdAt: number
      attempts: number
      lastAttemptAt?: number
      deferUntilMs?: number
      statusLabel?: 'queued' | 'backoff' | 'retrying'
      lastError?: string
    }[]
  >([])

  const refreshOfflineMailboxQueueCount = useCallback(() => {
    try {
      const items = loadOfflineMailboxQueue()
      const now = Date.now()
      setOfflineMailboxQueuePending(items.length)
      setOfflineMailboxQueueItems(
        items.map((q) => {
          const defer = shouldDeferDrainAttempt(q, now)
          const waitMs = defer ? backoffMsForDrainAttempt(q.attempts) : 0
          return {
            id: q.id,
            recipient: q.recipient,
            createdAt: q.createdAt,
            attempts: q.attempts,
            lastAttemptAt: q.lastAttemptAt,
            deferUntilMs: defer ? q.lastAttemptAt + waitMs : undefined,
            statusLabel: defer ? 'backoff' : q.attempts > 0 ? 'retrying' : 'queued',
            lastError: q.lastError,
          }
        })
      )
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
      syncActiveNetworkChainSnapshot(senderAddress)
      const cleared = purgeStaleOfflineMailboxQueue()
      if (cleared > 0) refreshOfflineMailboxQueueCount()
    } catch {
      /* ignore */
    }
  }, [refreshOfflineMailboxQueueCount, senderAddress])

  useEffect(() => {
    const onNet = () => {
      syncActiveNetworkChainSnapshot(senderAddress)
      const cleared = purgeStaleOfflineMailboxQueue()
      if (cleared > 0) refreshOfflineMailboxQueueCount()
    }
    window.addEventListener(EINSATZ_NETWORK_PROFILES_CHANGED, onNet)
    return () => window.removeEventListener(EINSATZ_NETWORK_PROFILES_CHANGED, onNet)
  }, [refreshOfflineMailboxQueueCount, senderAddress])

  const runMirrorDrain = useCallback(async () => {
    if (mirrorDrainInFlightRef.current) return
    const s = await fetchStatus()
    if (!('pollClockHint' in s) || s.backendRunning === false || s.locked) return
    if (getMirrorQueueCount() === 0) return
    mirrorDrainInFlightRef.current = true
    try {
      let lastDigest: string | undefined
      const mirrorSuccesses: { wire: string; txDigest?: string }[] = []
      const r = await drainMirrorQueue(
        async (payload) => {
          const wire = prependMailboxNonceIfMissingForEncryptedWire(payload)
          const res = await sendEncryptedMailboxHybrid(mailboxRecipient.trim(), wire)
          if (res.ok) {
            lastDigest = res.txDigest ?? lastDigest
            mirrorSuccesses.push({ wire, txDigest: res.txDigest })
            return { ok: true as const, txDigest: res.txDigest }
          }
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
        const base =
          r.sent === 1
            ? 'Delayed Upload: 1 Eintrag aus Warteschlange nach IOTA übertragen.'
            : `Delayed Upload: ${r.sent} Einträge aus Warteschlange nach IOTA übertragen.`
        let msg = base + formatTxDigestStatusSuffix(lastDigest)
        const snd = senderAddress.trim()
        if (snd && isForensicImageMailboxAttestationEnabled() && mirrorSuccesses.length > 0) {
          for (let i = 0; i < mirrorSuccesses.length; i++) {
            const row = mirrorSuccesses[i]!
            const parsed = parseMailboxOutNonceMarker(row.wire)
            if (!parsed) continue
            const last = i === mirrorSuccesses.length - 1
            await runForensicMailboxAttestationAfterSend({
              recipient: mailboxRecipient.trim(),
              senderAddress: snd,
              primary: { payloadUtf8: row.wire, messageNonceU64: parsed.nonce },
              imageContentSha256Hex: null,
              deviceTimeTrustWarn: false,
              baseSuccessMsg: msg,
              setStatusMsg: last
                ? (m) => {
                    msg = m
                  }
                : () => {},
              silent: !last,
              mailboxTxDigest: row.txDigest,
              mirrorMailboxTxDigest: row.txDigest ?? null,
            })
          }
        }
        setStatusMsg(msg)
        setTimeout(() => setStatus('idle'), 6000)
        void loadMessages('poll', undefined, { silent: true })
      }
    } finally {
      mirrorDrainInFlightRef.current = false
    }
  }, [loadMessages, mailboxRecipient, senderAddress, setStatus, setStatusMsg])

  const runOfflineMailboxDrain = useCallback(async () => {
    if (offlineMailboxDrainInFlightRef.current) return
    if (getOfflineMailboxQueueCount() === 0 && loadAttestationQueue().length === 0) return
    offlineMailboxDrainInFlightRef.current = true
    try {
      syncActiveNetworkChainSnapshot(senderAddress)
      const purged = purgeStaleOfflineMailboxQueue()
      if (purged > 0) {
        refreshOfflineMailboxQueueCount()
        setStatus('success')
        setStatusMsg(
          `${purged} veraltete Warteschlangen-Einträge verworfen (falsche Testnet-Package-ID). Bitte Nachricht neu senden.`
        )
        setTimeout(() => setStatus('idle'), 8000)
        if (getOfflineMailboxQueueCount() === 0) return
      }
      const s = await fetchStatus()
      const backendOk = 'pollClockHint' in s && s.backendRunning !== false && !s.locked
      if (backendOk) {
        syncDirectMailboxFlagsFromApiStatus(s)
        applyDirectChainSnapshotFromStatusOrNetworkProfile({
          packageId: s.packageId,
          mailboxId: s.mailboxId,
          myAddress: s.myAddress,
          myAddressFull: s.myAddressFull,
        })
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
        void loadMessages('poll', undefined, { silent: true })
      } else if (r.sent > 0 && r.failed > 0) {
        setStatus('error')
        setStatusMsg(
          r.failed === 1
            ? `Mailbox-Warteschlange: ${r.sent} übertragen, 1 Eintrag erneut fehlgeschlagen (Backoff § H.12 / SYNC §8.1).`
            : `Mailbox-Warteschlange: ${r.sent} übertragen, ${r.failed} erneut fehlgeschlagen (Backoff).`
        )
        setTimeout(() => setStatus('idle'), 9000)
        void loadMessages('poll', undefined, { silent: true })
      } else if (r.failed > 0) {
        const items = loadOfflineMailboxQueue()
        const hint = items
          .map((q) => q.lastError)
          .find((e) => e && e.trim())
        if (hint && isWrongNetworkPackageError(hint)) {
          const n = clearOfflineMailboxQueue()
          refreshOfflineMailboxQueueCount()
          setStatus('error')
          setStatusMsg(
            n > 0
              ? `Warteschlange geleert (${n}) — alte Testnet-Einträge. Header: „Produktion · Mainnet“ prüfen, dann neu senden.`
              : 'Package existiert auf dieser Kette nicht — Netzwerk in Einstellungen prüfen (Mainnet vs. Testnet).'
          )
          setTimeout(() => setStatus('idle'), 12000)
          return
        }
        setStatus('error')
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
  }, [loadMessages, refreshOfflineMailboxQueueCount, senderAddress, setStatus, setStatusMsg])

  const removeOfflineMailboxQueueItems = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    try {
      const drop = new Set(ids)
      const keep = loadOfflineMailboxQueue().filter((q) => !drop.has(q.id))
      saveOfflineMailboxQueue(keep)
      refreshOfflineMailboxQueueCount()
    } catch {
      /* ignore */
    }
  }, [refreshOfflineMailboxQueueCount])

  const onDelayMirrorPlaintext = useCallback(
    async (body: string, fromAddress: string) => {
      const dedup = mirrorQueueDedupKey(fromAddress, body)
      if (mirrorDedupRef.current.has(dedup)) return
      if (hasMirrorQueuePending(fromAddress, body)) return
      try {
        const raw = mirrorPayloadFromWireBody(body)
        const wire = prependMailboxNonceIfMissingForEncryptedWire(raw)
        const r = await sendEncryptedMailboxHybrid(mailboxRecipient.trim(), wire)
        if (r.ok) {
          mirrorDedupRef.current.add(dedup)
          setStatus('success')
          const baseOk = 'Delayed Upload: Inhalt zusätzlich per IOTA gespeichert.'
          const snd = senderAddress.trim()
          if (snd && isForensicImageMailboxAttestationEnabled()) {
            const parsed = parseMailboxOutNonceMarker(wire)
            if (parsed) {
              await runForensicMailboxAttestationAfterSend({
                recipient: mailboxRecipient.trim(),
                senderAddress: snd,
                primary: { payloadUtf8: wire, messageNonceU64: parsed.nonce },
                imageContentSha256Hex: null,
                deviceTimeTrustWarn: false,
                baseSuccessMsg: baseOk,
                setStatusMsg,
                mailboxTxDigest: r.txDigest,
                mirrorMailboxTxDigest: r.txDigest ?? null,
              })
            } else {
              setStatusMsg(baseOk + formatTxDigestStatusSuffix(r.txDigest))
            }
          } else {
            setStatusMsg(baseOk + formatTxDigestStatusSuffix(r.txDigest))
          }
          setTimeout(() => setStatus('idle'), 6000)
          void loadMessages('poll', undefined, { silent: true })
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
    [loadMessages, mailboxRecipient, runMirrorDrain, senderAddress, setStatus, setStatusMsg]
  )

  return {
    mirrorQueuePending,
    offlineMailboxQueuePending,
    offlineMailboxQueueUntrustedTimeCount,
    offlineMailboxQueueBackoffCount,
    offlineMailboxQueueErrorHint,
    offlineMailboxQueueItems,
    refreshOfflineMailboxQueueCount,
    removeOfflineMailboxQueueItems,
    runMirrorDrain,
    runOfflineMailboxDrain,
    onDelayMirrorPlaintext,
  }
}
