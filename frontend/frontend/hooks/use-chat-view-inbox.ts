'use client'

/**
 * Posteingang: Mailbox-Fetch (IOTA/Backend), Merge mit lokalen Mesh-Zeilen, Dedup.
 * Standard: 50 Nachrichten pro Seite; „Weitere laden“ holt ältere Chunks (offset).
 *
 * **RPC + API (§6.B.4):** Direkt-Fullnode und `/inbox` parallel; gleiche `dedupKey` → API gewinnt
 * (Backend-Entschlüsselung mit Wallet), RPC-Platzhalter `[Verschlüsselt]…` wird verworfen.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchInbox } from '@/frontend/lib/api'
import { tryFetchDirectMailboxInboxViaIota } from '@/frontend/lib/direct-iota-inbox-fetch'
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
import type { InboxApiRow } from '@/frontend/features/inbox/inbox-map-messages'
import { mapInboxApiRowsToMessages as mapRows, pickInboxRawMessages } from '@/frontend/features/inbox/inbox-map-messages'
import { mapTelegramJournalToMessages } from '@/frontend/features/inbox/map-telegram-journal-messages'
import { fetchTelegramJournal } from '@/frontend/lib/api/telegram-journal'
import { clearInboxBrowserViewFilters } from '@/frontend/lib/inbox-browser-view-state'
import { lookupMailboxIdForPackage } from '@/frontend/lib/package-profile-mailbox'
import type { Message } from '@/frontend/lib/types'

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

export function useChatViewInbox(p: UseChatViewInboxParams) {
  const { refreshContactDirectory, packageId, myAddress = '' } = p
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [inboxHasMore, setInboxHasMore] = useState(true)
  const mailboxOffsetRef = useRef(0)

  const appendMeshMessage = useCallback((msg: Message) => {
    appendMeshToLocalArchive(msg)
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev
      const merged = mergeMessageByDedup(prev, msg)
      return merged.sort((a, b) => b.timestamp - a.timestamp)
    })
  }, [])

  const loadMessages = useCallback(
    async (
      mode: 'reset' | 'append' = 'reset',
      overridePackageId?: unknown,
      opts?: { silent?: boolean }
    ) => {
      const silent = opts?.silent === true
      if (!silent) {
        if (mode === 'append') setLoadingMore(true)
        else setLoading(true)
        setLoadError(null)
      }
      const useBossView = false
      const trimPkg = (v: unknown): string | undefined =>
        typeof v === 'string' ? v.trim() || undefined : undefined
      const pkg = trimPkg(overridePackageId) ?? trimPkg(packageId)
      const mailboxForFetch = pkg ? await lookupMailboxIdForPackage(pkg) : undefined
      const offset = mode === 'reset' ? 0 : mailboxOffsetRef.current
      if (mode === 'reset') {
        clearInboxBrowserViewFilters()
      }
      const applyLocalOverlayFallback = () => {
        setMessages((prev) => mergeAllMessages(pickLocalOverlayRowsForInboxMerge(prev)))
      }
      try {
        if (!useBossView) {
          const direct = await tryFetchDirectMailboxInboxViaIota({
            limit: PAGE_SIZE,
            offset,
            packageIdOverride: pkg,
          })
          // Kette zuerst (Wahrheit); Basis `/inbox` nur ergänzend — gleiche Seite parallel.
          if (direct.ok) {
            const res = await fetchInbox(PAGE_SIZE, undefined, pkg, useBossView, offset, false, mailboxForFetch)
            const resLoose = res as { data?: unknown; messages?: unknown; ok?: boolean }
            const rawApi = pickInboxRawMessages(resLoose)
            const rpcMapped = mapRows(direct.rows as InboxApiRow[])
            const apiMapped =
              res.ok && rawApi != null ? mapRows(rawApi as InboxApiRow[]) : ([] as Message[])
            if (!silent && !res.ok && direct.rows.length === 0) {
              setLoadError(
                (res as { error?: string; message?: string }).error ||
                  (res as { message?: string }).message ||
                  'Posteingang konnte nicht geladen werden.'
              )
            }
            const tgJournal = await loadTelegramJournalMessages(myAddress)
            const mergedPage = mergeAllMessages([...rpcMapped, ...apiMapped, ...tgJournal])
            if (mergedPage.length > 0) {
              const rpcN = direct.rows.length
              const apiN = apiMapped.length
              const stride = Math.max(rpcN, apiN)
              if (mode === 'reset') {
                mailboxOffsetRef.current = offset + stride
              } else {
                mailboxOffsetRef.current += stride
              }
              if (mode === 'append' && stride === 0) {
                setInboxHasMore(false)
              } else {
                setInboxHasMore(stride >= PAGE_SIZE)
              }
              setMessages((prev) => {
                const localOverlay = pickLocalOverlayRowsForInboxMerge(prev)
                const next =
                  mode === 'reset'
                    ? mergeAllMessages([...mergedPage, ...localOverlay])
                    : mergeAllMessages([
                        ...prev.filter(
                          (m) =>
                            !m.transports?.includes('mesh') &&
                            m.source !== 'telegram' &&
                            !m.transports?.includes('telegram')
                          ),
                        ...mergedPage,
                        ...localOverlay,
                      ])
                if (inboxMessageListSignature(prev) === inboxMessageListSignature(next)) return prev
                return next
              })
              return
            }
          }
        }

        const res = await fetchInbox(PAGE_SIZE, undefined, pkg, useBossView, offset, false, mailboxForFetch)
        const resLoose = res as { data?: unknown; messages?: unknown; ok?: boolean }
        const raw = pickInboxRawMessages(resLoose)
        if (res.ok && raw != null) {
          const mapped: Message[] = mapRows(raw as InboxApiRow[])
          const tgJournal = await loadTelegramJournalMessages(myAddress)
          if (mode === 'reset') {
            mailboxOffsetRef.current = mapped.length
          } else {
            mailboxOffsetRef.current += mapped.length
          }
          if (mode === 'append' && mapped.length === 0) {
            setInboxHasMore(false)
          } else {
            setInboxHasMore(mapped.length >= PAGE_SIZE)
          }
          setMessages((prev) => {
            const localOverlay = pickLocalOverlayRowsForInboxMerge(prev)
            const next =
              mode === 'reset'
                ? mergeAllMessages([...mapped, ...tgJournal, ...localOverlay])
                : mergeAllMessages([
                    ...prev.filter(
                      (m) =>
                        !m.transports?.includes('mesh') &&
                        m.source !== 'telegram' &&
                        !m.transports?.includes('telegram')
                    ),
                    ...mapped,
                    ...tgJournal,
                    ...localOverlay,
                  ])
            if (inboxMessageListSignature(prev) === inboxMessageListSignature(next)) return prev
            return next
          })
        } else if (!res.ok) {
          if (!silent) {
            setLoadError(
              (res as { error?: string; message?: string }).error ||
                (res as { message?: string }).message ||
                'Posteingang konnte nicht geladen werden.'
            )
          }
          if (mode === 'append') applyLocalOverlayFallback()
        } else {
          if (!silent) setLoadError('Posteingang: Antwort ohne gültige Nachrichtenliste (data/messages).')
          if (mode === 'append') applyLocalOverlayFallback()
        }
      } finally {
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

  /** Telegram Long Polling: Journal periodisch in den Posteingang mergen (ohne Full-Inbox-Reload). */
  useEffect(() => {
    if (!myAddress.trim()) return
    const refreshTg = async () => {
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
  }
}
