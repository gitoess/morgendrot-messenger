'use client'

/**
 * Posteingang: Shared-Mailbox + alle eigenen privaten Mailboxen (M4d), Merge mit Mesh, Dedup.
 * Standard: 50 Nachrichten pro Seite; „Weitere laden“ holt ältere Chunks (offset).
 * Erster Load / „Aktualisieren“: Reset merged Chain-Zeilen wie Poll (kein Voll-Ersatz),
 * außer bei Wallet-/Package-Scope-Wechsel oder forceLive.
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
import { loadTeamSyncLanInboxMessages } from '@/frontend/lib/load-team-sync-lan-inbox-messages'
import { OFFLINE_CACHE_TTL_MS } from '@/frontend/lib/offline-cache-ttl'
import { enrichInboxMessagesWithChainDigests } from '@/frontend/lib/enrich-inbox-messages-chain-digest'
import {
  getDirectIotaSessionSigner,
  whenDirectIotaTabSessionPersistIdle,
} from '@/frontend/lib/direct-iota-mnemonic-session'
import { isCapacitorNativePlatform } from '@/frontend/lib/capacitor-platform'
import { DIRECT_IOTA_UI_CHANGED } from '@/frontend/lib/direct-iota-ui-events'
import {
  tryAutoRestoreDirectIotaSessionSigner,
  tryAutoRestoreDirectIotaSessionSignerAsync,
} from '@/frontend/lib/direct-iota-vault-unlock-sync'
import type { Message } from '@/frontend/lib/types'
import { buildInboxCacheKey, buildInboxWalletScopeKey } from '@/frontend/lib/inbox-cache-key'
import { resolveEffectiveInboxPackageId } from '@/frontend/lib/package-profile-inbox'
import { scopedKey } from '@/frontend/lib/package-profile-namespace'

export type InboxLoadMode = 'reset' | 'append' | 'poll'

export type InboxLoadMessagesOpts = {
  silent?: boolean
  /** Posteingang-Toolbar „Aktualisieren“: kein Warm-Cache, immer Live-Fetch. */
  forceLive?: boolean
}

export type UseChatViewInboxParams = {
  refreshContactDirectory: () => void
  /** Optional: Posteingang für diese Package-ID (0x…); leer = Backend-Standard. */
  packageId?: string
  /** GET /api/status packageId — Abgleich mit aktivem Einsatzprofil. */
  apiPackageId?: string
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

/** Chain-Zeilen aus `prev` behalten (Mesh/Telegram/optimistic separat via Overlay). */
function retainPriorChainRowsForInboxMerge(prev: Message[]): Message[] {
  return prev.filter(
    (m) =>
      !isPendingMailboxOptimisticRow(m) &&
      !m.transports?.includes('mesh') &&
      m.source !== 'telegram' &&
      !m.transports?.includes('telegram')
  )
}

function mergeFetchedInboxPageIntoState(
  prev: Message[],
  mapped: Message[],
  opts: { replaceChainRows: boolean }
): Message[] {
  const overlayBase = opts.replaceChainRows ? [] : prev
  const priorChain = opts.replaceChainRows ? [] : retainPriorChainRowsForInboxMerge(prev)
  const localOverlay = pickInboxOverlayRowsForMerge(overlayBase, mapped)
  return mergeAllMessages([...priorChain, ...mapped, ...localOverlay])
}

const PAGE_SIZE = 50
/** Erster Load / Aktualisieren: ältere über „Weitere laden“ (50er-Chunks, unbegrenzt solange hasMore). */
const RESET_PAGE_SIZE_WEB = 500
const RESET_PAGE_SIZE_NATIVE = 200
function resetPageSize(): number {
  return isCapacitorNativePlatform() ? RESET_PAGE_SIZE_NATIVE : RESET_PAGE_SIZE_WEB
}
/** Auto-Append nach Reset: zusätzliche 50er-Chunks (≈ Ziel ~2500 Web / ~1200 APK beim ersten Laden). */
const AUTO_APPEND_ROUNDS_ON_RESET = 40
/** Auto-Poll (Status-Tick): klein — volle Union nur bei Aktualisieren. */
const POLL_PAGE_SIZE = 80

type InboxLiveSource = 'rpc' | 'api'

type InboxCacheEnvelope = {
  savedAtMs: number
  messageCount: number
  unreadCountEstimate: number
  messages: Message[]
  /** Letzter erfolgreicher Live-Ladepfad (§ H.15 B.1). */
  liveSource?: InboxLiveSource
}

function writeInboxCache(key: string, messages: Message[], liveSource?: InboxLiveSource): void {
  if (typeof window === 'undefined') return
  try {
    const prior = readInboxCache(key)
    const merged = prior ? mergeAllMessages([...prior.messages, ...messages]) : messages
    const unreadCountEstimate = 0
    const payload: InboxCacheEnvelope = {
      savedAtMs: Date.now(),
      messageCount: merged.length,
      unreadCountEstimate,
      messages: merged,
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
  const { refreshContactDirectory, packageId, apiPackageId, myAddress = '', alsoMailboxIds = [] } = p
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
  /** Nach Reset: bis zu 3 Auto-Append-Runden wenn hasMore (ältere Move-Pakete / Events). */
  const autoAppendBudgetRef = useRef(0)
  const lastInboxCacheKeyRef = useRef<string | null>(null)
  const lastInboxWalletScopeRef = useRef<string | null>(null)
  const inboxMessageCountRef = useRef(0)
  inboxLiveSourceRef.current = inboxLiveSource

  useEffect(() => {
    inboxMessageCountRef.current = messages.length
  }, [messages.length])

  const clearInboxRam = useCallback(() => {
    awaitingManualRefreshRef.current = true
    inboxLoadEpochRef.current += 1
    lastInboxCacheKeyRef.current = null
    lastInboxWalletScopeRef.current = null
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
      opts?: InboxLoadMessagesOpts
    ) => {
      if (awaitingManualRefreshRef.current && mode !== 'reset') return
      const silent = opts?.silent === true || mode === 'poll'
      const forceLive = opts?.forceLive === true && mode === 'reset' && !silent
      if (inboxLoadInFlightRef.current) return
      const trimPkg = (v: unknown): string | undefined =>
        typeof v === 'string' ? v.trim() || undefined : undefined
      const pkg =
        trimPkg(overridePackageId) ??
        resolveEffectiveInboxPackageId({
          inboxFilter: trimPkg(packageId),
          apiPackageId: trimPkg(apiPackageId),
        })
      const cacheKey = scopedKey(
        'inbox',
        buildInboxCacheKey({
          packageId: pkg,
          activeMailboxId: readActiveSendMailboxObjectId(),
          myAddress,
        })
      )
      const walletScopeKey = buildInboxWalletScopeKey({ packageId: pkg, myAddress })
      const walletScopeChanged =
        mode === 'reset' &&
        lastInboxWalletScopeRef.current != null &&
        lastInboxWalletScopeRef.current !== walletScopeKey
      if (mode === 'reset') {
        lastInboxCacheKeyRef.current = cacheKey
        lastInboxWalletScopeRef.current = walletScopeKey
      }
      if (walletScopeChanged || forceLive) {
        inboxLoadEpochRef.current += 1
      }
      const loadEpoch = inboxLoadEpochRef.current
      inboxLoadInFlightRef.current = true
      if (!silent) {
        if (mode === 'append') setLoadingMore(true)
        else {
          setLoading(true)
        }
        setLoadError(null)
      }
      /** Shared-Posteingang: immer Backend-MAILBOX_ID — kein Manifest-Override (sonst leer/falsch). */
      const pageSize =
        mode === 'reset' ? resetPageSize() : mode === 'poll' ? POLL_PAGE_SIZE : PAGE_SIZE
      const offset = mode === 'append' ? mailboxOffsetRef.current : 0
      if (mode === 'reset') {
        awaitingManualRefreshRef.current = false
        clearInboxBrowserViewFilters()
        autoAppendBudgetRef.current = 0
      }
      const applyLocalOverlayFallback = () => {
        setMessages((prev) => mergeAllMessages(pickInboxOverlayRowsForMerge(prev)))
      }
      if (!silent && mode === 'reset' && !forceLive && walletScopeChanged) {
        setMessages([])
        setInboxFromCache(false)
        setInboxCacheAgeMinutes(null)
        setInboxLiveSource(null)
      } else if (forceLive && walletScopeChanged) {
        setMessages([])
        setInboxFromCache(false)
        setInboxCacheAgeMinutes(null)
        setInboxLiveSource(null)
      }
      try {
        if (mode === 'reset') {
          tryAutoRestoreDirectIotaSessionSigner()
          if (getDirectIotaSessionSigner()) {
            /* Signer im RAM — Tab-Persist (PBKDF2) nicht abwarten; sonst APK „eingefroren“ nach Unlock. */
          } else if (isCapacitorNativePlatform()) {
            void whenDirectIotaTabSessionPersistIdle().then(() => tryAutoRestoreDirectIotaSessionSignerAsync())
          } else {
            await whenDirectIotaTabSessionPersistIdle()
            await tryAutoRestoreDirectIotaSessionSignerAsync()
          }
        }
        const applyMappedToState = (mapped: Message[], stride: number, chainHasMore: boolean) => {
          if (loadEpoch !== inboxLoadEpochRef.current) return
          if (awaitingManualRefreshRef.current && mode !== 'reset') return
          const replaceOnReset = mode === 'reset' && (forceLive || walletScopeChanged)
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
            const next = mergeFetchedInboxPageIntoState(prev, mapped, {
              replaceChainRows: replaceOnReset,
            })
            if (!replaceOnReset && inboxMessageListSignature(prev) === inboxMessageListSignature(next)) {
              return prev
            }
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
          const lanInbox = await loadTeamSyncLanInboxMessages(myAddress)
          const page = enrichInboxMessagesWithChainDigests(
            mergeAllMessages([...mapped, ...tgJournal, ...lanInbox])
          )
          const liveSource: InboxLiveSource = res.loadedViaRpc === true ? 'rpc' : 'api'
          writeInboxCache(cacheKey, page, liveSource)
          setInboxFromCache(false)
          setInboxCacheAgeMinutes(null)
          setInboxLiveSource(liveSource)
          setLoadError(null)
          applyMappedToState(page, mappedLength, res.hasMore === true)
          const chainHasMore = res.hasMore === true
          if (!silent && chainHasMore) {
            if (mode === 'reset') autoAppendBudgetRef.current = AUTO_APPEND_ROUNDS_ON_RESET
            if ((mode === 'reset' || mode === 'append') && autoAppendBudgetRef.current > 0) {
              autoAppendBudgetRef.current -= 1
              const epoch = loadEpoch
              queueMicrotask(() => {
                if (epoch !== inboxLoadEpochRef.current) return
                void loadMessagesRef.current('append')
              })
            }
          } else if (mode === 'reset') {
            autoAppendBudgetRef.current = 0
          }
        } else if (!res.ok) {
          const cached = readInboxCache(cacheKey)
          if (cached && mode !== 'append') {
            if (!silent && (forceLive || inboxMessageCountRef.current === 0)) {
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
          if (!silent && (forceLive || inboxMessageCountRef.current === 0)) {
            setLoadError(
              res.error || 'Posteingang konnte nicht geladen werden.'
            )
          }
          if (mode === 'append') applyLocalOverlayFallback()
        } else {
          const cached = readInboxCache(cacheKey)
          if (cached && mode !== 'append') {
            if (!silent && (forceLive || inboxMessageCountRef.current === 0)) {
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
          if (!silent && (forceLive || inboxMessageCountRef.current === 0)) {
            setLoadError('Posteingang: Antwort ohne gültige Nachrichtenliste (data/messages).')
          }
          if (mode === 'append') applyLocalOverlayFallback()
        }
      } finally {
        inboxLoadInFlightRef.current = false
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [packageId, apiPackageId, myAddress, alsoMailboxIds]
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
    if (isCapacitorNativePlatform()) {
      const t = window.setTimeout(() => void loadMessagesRef.current('reset'), 0)
      return () => window.clearTimeout(t)
    }
    void loadMessagesRef.current('reset')
  }, [packageId, apiPackageId, myAddress, alsoMailboxIdsKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onMailboxChanged = () => {
      mailboxOffsetRef.current = 0
      void loadMessagesRef.current('reset')
    }
    window.addEventListener(ACTIVE_MAILBOX_CHANGED_EVENT, onMailboxChanged)
    return () => window.removeEventListener(ACTIVE_MAILBOX_CHANGED_EVENT, onMailboxChanged)
  }, [])

  /** Telegram + LAN-Team-Sync: periodisch in den Posteingang mergen (ohne Full-Inbox-Reload). */
  useEffect(() => {
    if (!myAddress.trim()) return
    const refreshOverlay = async () => {
      if (awaitingManualRefreshRef.current) return
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      const [tg, lan] = await Promise.all([
        loadTelegramJournalMessages(myAddress),
        loadTeamSyncLanInboxMessages(myAddress),
      ])
      if (tg.length === 0 && lan.length === 0) return
      setMessages((prev) => mergeJournalIntoInboxIfChanged(prev, [...lan, ...tg]))
    }
    const iv = window.setInterval(() => void refreshOverlay(), 15_000)
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
      void loadMessagesRef.current('reset', undefined, { silent: true })
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
