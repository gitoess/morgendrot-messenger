'use client'

/**
 * Posteingang: Shared-Mailbox + alle eigenen privaten Mailboxen (M4d), Merge mit Mesh, Dedup.
 * Standard: 50 Nachrichten pro Seite; „Weitere laden“ holt ältere Chunks (offset).
 * Erster Load / „Aktualisieren“: 200 Zeilen — verschlüsselte liegen oft älter als Klartext-Tests.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchInboxFromAllOwnedMailboxes } from '@/frontend/lib/inbox-multi-mailbox-fetch'
import { collectInboxAlsoMailboxIds } from '@/frontend/lib/inbox-also-mailbox-ids'
import { readActiveSendMailboxObjectId } from '@/frontend/lib/my-mailbox-active'
import {
  ACTIVE_MAILBOX_CHANGED_EVENT,
} from '@/frontend/lib/my-private-mailbox-store'
import {
  inboxMessageListSignature,
  mergeAllMessages,
  mergeJournalIntoInboxIfChanged,
  mergeMessageByDedup,
} from '@/frontend/lib/message-dedup'
import { appendMeshToLocalArchive } from '@/frontend/lib/mesh-local-archive'
import {
  isPendingMailboxOptimisticRow,
  pickInboxOverlayRowsForMerge,
} from '@/frontend/lib/group-inbox-optimistic'
import { clearInboxBrowserViewFilters } from '@/frontend/lib/inbox-browser-view-state'
import { EINSATZ_END_CACHE_WIPED_EVENT } from '@/frontend/lib/einsatz-end-cache-wipe'
import { mapTelegramJournalToMessages } from '@/frontend/features/inbox/map-telegram-journal-messages'
import { fetchTelegramJournal } from '@/frontend/lib/api/telegram-journal'
import { OFFLINE_CACHE_TTL_MS } from '@/frontend/lib/offline-cache-ttl'
import { enrichInboxMessagesWithChainDigests } from '@/frontend/lib/enrich-inbox-messages-chain-digest'
import {
  getDirectIotaSessionSigner,
  whenDirectIotaTabSessionPersistIdle,
} from '@/frontend/lib/direct-iota-mnemonic-session'
import { DIRECT_IOTA_UI_CHANGED } from '@/frontend/lib/direct-iota-ui-events'
import { tryAutoRestoreDirectIotaSessionSignerAsync } from '@/frontend/lib/direct-iota-vault-unlock-sync'
import type { Message } from '@/frontend/lib/types'

export type InboxLoadMode = 'reset' | 'append' | 'poll'

export type UseChatViewInboxParams = {
  refreshContactDirectory: () => void
  /** Optional: Posteingang für diese Package-ID (0x…); leer = Backend-Standard. */
  packageId?: string
  myAddress?: string
  /** Zusätzliche Mailbox-IDs (z. B. Team-Mailbox der aktiven Gruppe). */
  alsoMailboxIds?: string[]
}

async function loadTelegramJournalMessages(myAddress: string): Promise<Message[]> {
  if (!myAddress.trim()) return []
  const j = await fetchTelegramJournal({ limit: 300 })
  if (!j.ok || !j.entries?.length) return []
  return mapTelegramJournalToMessages(j.entries, myAddress)
}

const PAGE_SIZE = 50
/** Erster Load / Aktualisieren: bis zu 300 Zeilen; ältere über „Weitere laden“ (50er-Chunks, unbegrenzt solange hasMore). */
const RESET_PAGE_SIZE = 300
/** Auto-Poll (Status-Tick): klein — volle Union nur bei Aktualisieren. */
const POLL_PAGE_SIZE = 80
const INBOX_CACHE_KEY_PREFIX = 'morgendrot.inbox.cache.v1:'

type InboxLiveSource = 'rpc' | 'api'

type InboxCacheEnvelope = {
  savedAtMs: number
  messageCount: number
  unreadCountEstimate: number
  messages: Message[]
  /** Letzter erfolgreicher Live-Ladepfad (§ H.15 B.1). */
  liveSource?: InboxLiveSource
}

function inboxCacheKey(packageId?: string, activeMailboxId?: string): string {
  const pkg = (packageId || '__default__').trim().toLowerCase() || '__default__'
  const mb = (activeMailboxId || '__server__').trim().toLowerCase() || '__server__'
  return `${INBOX_CACHE_KEY_PREFIX}${pkg}:${mb}`
}

function writeInboxCache(key: string, messages: Message[], liveSource?: InboxLiveSource): void {
  if (typeof window === 'undefined') return
  try {
    const unreadCountEstimate = 0
    const payload: InboxCacheEnvelope = {
      savedAtMs: Date.now(),
      messageCount: messages.length,
      unreadCountEstimate,
      messages,
      liveSource,
    }
    window.localStorage.setItem(key, JSON.stringify(payload))
  } catch {
    // Cache ist best-effort; kein UI-Abbruch bei Storage-Problemen.
  }
}

function readInboxCache(
  key: string
): { messages: Message[]; cacheAgeMinutes: number; savedAtMs: number; liveSource?: InboxLiveSource } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<InboxCacheEnvelope>
    const savedAtMs = Number(parsed.savedAtMs ?? 0)
    const ageMs = Date.now() - savedAtMs
    if (!Number.isFinite(savedAtMs) || savedAtMs <= 0) return null
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > OFFLINE_CACHE_TTL_MS) return null
    const messages = Array.isArray(parsed.messages) ? (parsed.messages as Message[]) : []
    const cacheAgeMinutes = Math.floor(ageMs / 60_000)
    const liveSource =
      parsed.liveSource === 'rpc' || parsed.liveSource === 'api' ? parsed.liveSource : undefined
    return { messages, cacheAgeMinutes, savedAtMs, liveSource }
  } catch {
    return null
  }
}

export function useChatViewInbox(p: UseChatViewInboxParams) {
  const { refreshContactDirectory, packageId, myAddress = '', alsoMailboxIds = [] } = p
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [inboxFromCache, setInboxFromCache] = useState(false)
  const [inboxCacheAgeMinutes, setInboxCacheAgeMinutes] = useState<number | null>(null)
  const [inboxLiveSource, setInboxLiveSource] = useState<InboxLiveSource | null>(null)
  const [inboxHasMore, setInboxHasMore] = useState(true)
  const mailboxOffsetRef = useRef(0)
  /** Nach „Cache leeren“: kein Auto-Poll bis „Aktualisieren“ (voller Reload). */
  const awaitingManualRefreshRef = useRef(false)
  /** Erhöht bei clearInboxRam — verworfene async Loads (Poll/Telegram) landen nicht mehr im State. */
  const inboxLoadEpochRef = useRef(0)
  const inboxLoadInFlightRef = useRef(false)
  const inboxLiveSourceRef = useRef<InboxLiveSource | null>(null)
  inboxLiveSourceRef.current = inboxLiveSource

  const clearInboxRam = useCallback(() => {
    awaitingManualRefreshRef.current = true
    inboxLoadEpochRef.current += 1
    mailboxOffsetRef.current = 0
    setInboxHasMore(true)
    setLoadError(null)
    setInboxFromCache(false)
    setInboxCacheAgeMinutes(null)
    setInboxLiveSource(null)
    setMessages([])
  }, [])

  const appendMeshMessage = useCallback((msg: Message) => {
    if (awaitingManualRefreshRef.current) return
    appendMeshToLocalArchive(msg)
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev
      const merged = mergeMessageByDedup(prev, msg)
      return merged.sort((a, b) => b.timestamp - a.timestamp)
    })
  }, [])

  const loadMessages = useCallback(
    async (
      mode: InboxLoadMode = 'reset',
      overridePackageId?: unknown,
      opts?: { silent?: boolean }
    ) => {
      if (awaitingManualRefreshRef.current && mode !== 'reset') return
      const silent = opts?.silent === true || mode === 'poll'
      if (inboxLoadInFlightRef.current && (mode === 'poll' || silent)) return
      const loadEpoch = inboxLoadEpochRef.current
      inboxLoadInFlightRef.current = true
      if (!silent) {
        if (mode === 'append') setLoadingMore(true)
        else setLoading(true)
        setLoadError(null)
      }
      const trimPkg = (v: unknown): string | undefined =>
        typeof v === 'string' ? v.trim() || undefined : undefined
      const pkg = trimPkg(overridePackageId) ?? trimPkg(packageId)
      const cacheKey = inboxCacheKey(pkg, readActiveSendMailboxObjectId())
      /** Shared-Posteingang: immer Backend-MAILBOX_ID — kein Manifest-Override (sonst leer/falsch). */
      const pageSize =
        mode === 'reset' ? RESET_PAGE_SIZE : mode === 'poll' ? POLL_PAGE_SIZE : PAGE_SIZE
      const offset = mode === 'append' ? mailboxOffsetRef.current : 0
      if (mode === 'reset') {
        awaitingManualRefreshRef.current = false
        clearInboxBrowserViewFilters()
      }
      const applyLocalOverlayFallback = () => {
        setMessages((prev) => mergeAllMessages(pickInboxOverlayRowsForMerge(prev)))
      }
      try {
        if (mode === 'reset') {
          await whenDirectIotaTabSessionPersistIdle()
          await tryAutoRestoreDirectIotaSessionSignerAsync()
        }
        const applyMappedToState = (mapped: Message[], stride: number, chainHasMore: boolean) => {
          if (loadEpoch !== inboxLoadEpochRef.current) return
          if (awaitingManualRefreshRef.current && mode !== 'reset') return
          if (mode === 'poll') {
            setMessages((prev) => {
              const prevIds = new Set(prev.map((m) => m.id))
              const prevDedup = new Set(prev.map((m) => m.dedupKey).filter((k): k is string => Boolean(k)))
              const novel = mapped.filter(
                (m) => !prevIds.has(m.id) && (!m.dedupKey || !prevDedup.has(m.dedupKey))
              )
              if (novel.length === 0) return prev
              const localOverlay = pickInboxOverlayRowsForMerge(prev, mapped)
              const next = mergeAllMessages([
                ...prev.filter((m) => !isPendingMailboxOptimisticRow(m)),
                ...novel,
                ...localOverlay,
              ])
              if (inboxMessageListSignature(prev) === inboxMessageListSignature(next)) return prev
              return next
            })
            return
          }
          if (mode === 'reset') {
            mailboxOffsetRef.current = stride
          } else {
            mailboxOffsetRef.current += stride
          }
          if (mode === 'append' && stride === 0) {
            setInboxHasMore(false)
          } else {
            setInboxHasMore(
              chainHasMore || stride >= pageSize || (mode === 'reset' && mapped.length >= pageSize)
            )
          }
          setMessages((prev) => {
            const localOverlay = pickInboxOverlayRowsForMerge(prev, mapped)
            const next =
              mode === 'reset'
                ? mergeAllMessages([...mapped, ...localOverlay])
                : mergeAllMessages([
                    ...prev.filter(
                      (m) =>
                        !isPendingMailboxOptimisticRow(m) &&
                        !m.transports?.includes('mesh') &&
                        m.source !== 'telegram' &&
                        !m.transports?.includes('telegram')
                    ),
                    ...mapped,
                    ...localOverlay,
                  ])
            if (inboxMessageListSignature(prev) === inboxMessageListSignature(next)) return prev
            return next
          })
        }

        /** Shared (immer) + Team-Postfächer + aktive private Mailbox (M4d), falls gesetzt. */
        const mergeLocal = false
        const teamMailboxIds = collectInboxAlsoMailboxIds()
        const alsoMbMerged = [...new Set([...(alsoMailboxIds ?? []), ...teamMailboxIds].map((id) => id.trim().toLowerCase()))].filter(
          (id) => /^0x[a-f0-9]{64}$/.test(id)
        )
        const res = await fetchInboxFromAllOwnedMailboxes({
          limit: pageSize,
          offset,
          packageId: pkg,
          mergeLocalInbox: mergeLocal,
          includePrivateMailboxes: true,
          alsoMailboxIds: alsoMbMerged,
          silent,
        })
        const raw = res.ok ? res.messages : null
        const mappedLength = res.stride
        if (loadEpoch !== inboxLoadEpochRef.current) return
        if (res.ok && raw != null) {
          const mapped: Message[] = raw
          const tgJournal = mode === 'poll' ? [] : await loadTelegramJournalMessages(myAddress)
          const page = enrichInboxMessagesWithChainDigests(
            mergeAllMessages([...mapped, ...tgJournal])
          )
          const liveSource: InboxLiveSource = res.loadedViaRpc === true ? 'rpc' : 'api'
          writeInboxCache(cacheKey, page, liveSource)
          setInboxFromCache(false)
          setInboxCacheAgeMinutes(null)
          setInboxLiveSource(liveSource)
          applyMappedToState(page, mappedLength, res.hasMore === true)
        } else if (!res.ok) {
          const cached = readInboxCache(cacheKey)
          if (cached && mode !== 'append') {
            if (!silent) {
              setLoadError('Offline: letzte bekannte Nachrichten aktiv. Aktuell sind nur LoRa/Queue-Aktionen moeglich.')
            }
            console.info('[inbox] Live-Fetch fehlgeschlagen, nutze Cache-Fallback.', {
              error: res.error,
              ageMinutes: cached.cacheAgeMinutes,
            })
            setInboxFromCache(true)
            setInboxCacheAgeMinutes(cached.cacheAgeMinutes)
            setInboxLiveSource(cached.liveSource ?? null)
            applyMappedToState(cached.messages, Math.min(cached.messages.length, pageSize), false)
            return
          }
          if (!silent) {
            setLoadError(
              res.error || 'Posteingang konnte nicht geladen werden.'
            )
          }
          if (mode === 'append') applyLocalOverlayFallback()
        } else {
          const cached = readInboxCache(cacheKey)
          if (cached && mode !== 'append') {
            if (!silent) {
              setLoadError('Offline: letzte bekannte Nachrichten aktiv. Aktuell sind nur LoRa/Queue-Aktionen moeglich.')
            }
            console.info('[inbox] Live-Fetch ohne gueltige Liste, nutze Cache-Fallback.', {
              ageMinutes: cached.cacheAgeMinutes,
            })
            setInboxFromCache(true)
            setInboxCacheAgeMinutes(cached.cacheAgeMinutes)
            setInboxLiveSource(cached.liveSource ?? null)
            applyMappedToState(cached.messages, Math.min(cached.messages.length, pageSize), false)
            return
          }
          if (!silent) setLoadError('Posteingang: Antwort ohne gültige Nachrichtenliste (data/messages).')
          if (mode === 'append') applyLocalOverlayFallback()
        }
      } finally {
        inboxLoadInFlightRef.current = false
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [packageId, myAddress, alsoMailboxIds]
  )

  const loadMessagesRef = useRef(loadMessages)
  loadMessagesRef.current = loadMessages

  const loadMoreInbox = useCallback(() => {
    if (!inboxHasMore || loading || loadingMore) return
    void loadMessages('append')
  }, [inboxHasMore, loading, loadingMore, loadMessages])

  const alsoMailboxIdsKey = (alsoMailboxIds ?? []).map((id) => id.trim().toLowerCase()).join('|')

  useEffect(() => {
    mailboxOffsetRef.current = 0
    void loadMessagesRef.current('reset')
  }, [packageId, myAddress, alsoMailboxIdsKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onMailboxChanged = () => {
      mailboxOffsetRef.current = 0
      void loadMessagesRef.current('reset')
    }
    window.addEventListener(ACTIVE_MAILBOX_CHANGED_EVENT, onMailboxChanged)
    return () => window.removeEventListener(ACTIVE_MAILBOX_CHANGED_EVENT, onMailboxChanged)
  }, [])

  /** Telegram Long Polling: Journal periodisch in den Posteingang mergen (ohne Full-Inbox-Reload). */
  useEffect(() => {
    if (!myAddress.trim()) return
    const refreshTg = async () => {
      if (awaitingManualRefreshRef.current) return
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      const tg = await loadTelegramJournalMessages(myAddress)
      if (tg.length === 0) return
      setMessages((prev) => mergeJournalIntoInboxIfChanged(prev, tg))
    }
    const iv = window.setInterval(() => void refreshTg(), 30_000)
    return () => window.clearInterval(iv)
  }, [myAddress])

  useEffect(() => {
    const onEinsatzEnd = () => clearInboxRam()
    window.addEventListener(EINSATZ_END_CACHE_WIPED_EVENT, onEinsatzEnd)
    return () => window.removeEventListener(EINSATZ_END_CACHE_WIPED_EVENT, onEinsatzEnd)
  }, [clearInboxRam])

  /** Nach Session-Signer-Wiederherstellung: Direct-RPC-Merge nachladen (mehr Nachrichten als nur API). */
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onDirectIotaUiChanged = () => {
      if (!getDirectIotaSessionSigner()) return
      if (inboxLiveSourceRef.current === 'rpc') return
      if (inboxLoadInFlightRef.current) return
      void loadMessagesRef.current('reset')
    }
    window.addEventListener(DIRECT_IOTA_UI_CHANGED, onDirectIotaUiChanged)
    return () => window.removeEventListener(DIRECT_IOTA_UI_CHANGED, onDirectIotaUiChanged)
  }, [])

  return {
    messages,
    setMessages,
    loading,
    loadingMore,
    loadError,
    inboxFromCache,
    inboxCacheAgeMinutes,
    inboxLiveSource,
    loadMessages,
    loadMoreInbox,
    inboxHasMore,
    appendMeshMessage,
    clearInboxRam,
  }
}
