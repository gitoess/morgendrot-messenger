'use client'

/**
 * Posteingang: Shared-Mailbox + alle eigenen privaten Mailboxen (M4d), Merge mit Mesh, Dedup.
 * Standard: 50 Nachrichten pro Seite; „Weitere laden“ holt ältere Chunks (offset).
 * Erster Load / „Aktualisieren“: 200 Zeilen — verschlüsselte liegen oft älter als Klartext-Tests.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchInboxFromAllOwnedMailboxes } from '@/frontend/lib/inbox-multi-mailbox-fetch'
import {
  ACTIVE_MAILBOX_CHANGED_EVENT,
  readActiveMailboxSelection,
  readCachedServerMailboxObjectId,
} from '@/frontend/lib/my-private-mailbox-store'
import {
  inboxMessageListSignature,
  mergeAllMessages,
  mergeJournalIntoInboxIfChanged,
  mergeMessageByDedup,
} from '@/frontend/lib/message-dedup'
import {
  appendMeshToLocalArchive,
  pickLocalOverlayRowsForInboxMerge,
} from '@/frontend/lib/mesh-local-archive'
import { clearInboxBrowserViewFilters } from '@/frontend/lib/inbox-browser-view-state'
import { mapTelegramJournalToMessages } from '@/frontend/features/inbox/map-telegram-journal-messages'
import { fetchTelegramJournal } from '@/frontend/lib/api/telegram-journal'
import type { Message } from '@/frontend/lib/types'

export type InboxLoadMode = 'reset' | 'append' | 'poll'

export type UseChatViewInboxParams = {
  refreshContactDirectory: () => void
  /** Optional: Posteingang für diese Package-ID (0x…); leer = Backend-Standard. */
  packageId?: string
  myAddress?: string
}

async function loadTelegramJournalMessages(myAddress: string): Promise<Message[]> {
  if (!myAddress.trim()) return []
  const j = await fetchTelegramJournal({ limit: 300 })
  if (!j.ok || !j.entries?.length) return []
  return mapTelegramJournalToMessages(j.entries, myAddress)
}

const PAGE_SIZE = 50
/** Erster Load / Aktualisieren: verschlüsselte liegen oft älter als Klartext-Event-Tests. */
const RESET_PAGE_SIZE = 300
/** Auto-Poll (Status-Tick): klein — volle Union nur bei Aktualisieren. */
const POLL_PAGE_SIZE = 80

export function useChatViewInbox(p: UseChatViewInboxParams) {
  const { refreshContactDirectory, packageId, myAddress = '' } = p
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [inboxHasMore, setInboxHasMore] = useState(true)
  const mailboxOffsetRef = useRef(0)
  /** Nach „Cache leeren“: kein Auto-Poll bis „Aktualisieren“ (voller Reload). */
  const awaitingManualRefreshRef = useRef(false)
  /** Erhöht bei clearInboxRam — verworfene async Loads (Poll/Telegram) landen nicht mehr im State. */
  const inboxLoadEpochRef = useRef(0)
  const inboxLoadInFlightRef = useRef(false)

  const clearInboxRam = useCallback(() => {
    awaitingManualRefreshRef.current = true
    inboxLoadEpochRef.current += 1
    mailboxOffsetRef.current = 0
    setInboxHasMore(true)
    setLoadError(null)
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
      /** Shared-Posteingang: immer Backend-MAILBOX_ID — kein Manifest-Override (sonst leer/falsch). */
      const pageSize =
        mode === 'reset' ? RESET_PAGE_SIZE : mode === 'poll' ? POLL_PAGE_SIZE : PAGE_SIZE
      const offset = mode === 'append' ? mailboxOffsetRef.current : 0
      if (mode === 'reset') {
        awaitingManualRefreshRef.current = false
        clearInboxBrowserViewFilters()
      }
      const applyLocalOverlayFallback = () => {
        setMessages((prev) => mergeAllMessages(pickLocalOverlayRowsForInboxMerge(prev)))
      }
      try {
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
              const localOverlay = pickLocalOverlayRowsForInboxMerge(prev)
              const next = mergeAllMessages([...prev, ...novel, ...localOverlay])
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
          } else if (mode !== 'poll') {
            setInboxHasMore(
              chainHasMore || stride >= pageSize || (mode === 'reset' && mapped.length >= pageSize)
            )
          }
          setMessages((prev) => {
            const localOverlay = pickLocalOverlayRowsForInboxMerge(prev)
            const next =
              mode === 'reset'
                ? mergeAllMessages([...mapped, ...localOverlay])
                : mergeAllMessages([
                    ...prev.filter(
                      (m) =>
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

        /** Shared + alle eigenen privaten Mailboxen (M4d); sonst fehlen verschlüsselte Sendungen aus privater Mailbox. */
        const mergeLocal = false
        const serverMb = readCachedServerMailboxObjectId().trim()
        const sel = readActiveMailboxSelection()
        const pollAlso: string[] = []
        if (mode === 'poll' && sel.kind === 'private') pollAlso.push(sel.objectId)
        if (
          mode === 'poll' &&
          /^0x[a-fA-F0-9]{64}$/i.test(serverMb) &&
          !pollAlso.some((x) => x.toLowerCase() === serverMb.toLowerCase())
        ) {
          pollAlso.push(serverMb)
        }
        const res = await fetchInboxFromAllOwnedMailboxes({
          limit: pageSize,
          offset,
          packageId: pkg,
          mergeLocalInbox: mergeLocal,
          includePrivateMailboxes: true,
          alsoMailboxIds: pollAlso.length ? pollAlso : undefined,
          silent,
        })
        const raw = res.ok ? res.messages : null
        const mappedLength = res.stride
        if (loadEpoch !== inboxLoadEpochRef.current) return
        if (res.ok && raw != null) {
          const mapped: Message[] = raw
          const tgJournal = mode === 'poll' ? [] : await loadTelegramJournalMessages(myAddress)
          const page = mergeAllMessages([...mapped, ...tgJournal])
          applyMappedToState(page, mappedLength, res.hasMore === true)
        } else if (!res.ok) {
          if (!silent) {
            setLoadError(
              res.error || 'Posteingang konnte nicht geladen werden.'
            )
          }
          if (mode === 'append') applyLocalOverlayFallback()
        } else {
          if (!silent) setLoadError('Posteingang: Antwort ohne gültige Nachrichtenliste (data/messages).')
          if (mode === 'append') applyLocalOverlayFallback()
        }
      } finally {
        inboxLoadInFlightRef.current = false
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [packageId, myAddress]
  )

  const loadMessagesRef = useRef(loadMessages)
  loadMessagesRef.current = loadMessages

  const loadMoreInbox = useCallback(() => {
    if (!inboxHasMore || loading || loadingMore) return
    void loadMessages('append')
  }, [inboxHasMore, loading, loadingMore, loadMessages])

  useEffect(() => {
    mailboxOffsetRef.current = 0
    void loadMessagesRef.current('reset')
  }, [packageId, myAddress])

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

  return {
    messages,
    setMessages,
    loading,
    loadingMore,
    loadError,
    loadMessages,
    loadMoreInbox,
    inboxHasMore,
    appendMeshMessage,
    clearInboxRam,
  }
}
