'use client'

/**
 * Posteingang: Mailbox-Fetch (IOTA/Backend), Merge mit lokalen Mesh-Zeilen, Dedup.
 * Standard: 50 Nachrichten pro Seite; „Weitere laden“ holt ältere Chunks (offset).
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchInbox } from '@/frontend/lib/api'
import { mergeAllMessages, mergeMessageByDedup } from '@/frontend/lib/message-dedup'
import type { InboxApiRow } from '@/frontend/features/inbox/inbox-map-messages'
import { mapInboxApiRowsToMessages as mapRows, pickInboxRawMessages } from '@/frontend/features/inbox/inbox-map-messages'
import type { Message } from '@/frontend/lib/types'

export type UseChatViewInboxParams = {
  role: string
  bossView: boolean
  refreshContactDirectory: () => void
  /** Optional: Posteingang für diese Package-ID (0x…); leer = Backend-Standard. */
  packageId?: string
}

const PAGE_SIZE = 50

export function useChatViewInbox(p: UseChatViewInboxParams) {
  const { role, bossView, refreshContactDirectory, packageId } = p
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [inboxHasMore, setInboxHasMore] = useState(true)
  const mailboxOffsetRef = useRef(0)

  const appendMeshMessage = useCallback((msg: Message) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev
      const merged = mergeMessageByDedup(prev, msg)
      return merged.sort((a, b) => b.timestamp - a.timestamp)
    })
  }, [])

  const loadMessages = useCallback(
    async (mode: 'reset' | 'append' = 'reset', overridePackageId?: unknown) => {
      if (mode === 'append') setLoadingMore(true)
      else setLoading(true)
      setLoadError(null)
      const useBossView = role === 'boss' && bossView
      const trimPkg = (v: unknown): string | undefined =>
        typeof v === 'string' ? v.trim() || undefined : undefined
      const pkg = trimPkg(overridePackageId) ?? trimPkg(packageId)
      const offset = mode === 'reset' ? 0 : mailboxOffsetRef.current
      try {
        const res = await fetchInbox(PAGE_SIZE, undefined, pkg, useBossView, offset)
        const resLoose = res as { data?: unknown; messages?: unknown; ok?: boolean }
        const raw = pickInboxRawMessages(resLoose)
        if (res.ok && raw != null) {
          const mapped: Message[] = mapRows(raw as InboxApiRow[])
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
            const meshLocal = prev.filter((m) => m.transports?.includes('mesh'))
            if (mode === 'reset') {
              return mergeAllMessages([...mapped, ...meshLocal])
            }
            const prevMailbox = prev.filter((m) => !m.transports?.includes('mesh'))
            return mergeAllMessages([...prevMailbox, ...mapped, ...meshLocal])
          })
          refreshContactDirectory()
        } else if (!res.ok) {
          setLoadError(
            (res as { error?: string; message?: string }).error ||
              (res as { message?: string }).message ||
              'Posteingang konnte nicht geladen werden.'
          )
        } else {
          setLoadError('Posteingang: Antwort ohne gültige Nachrichtenliste (data/messages).')
        }
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [role, bossView, refreshContactDirectory, packageId]
  )

  const loadMoreInbox = useCallback(() => {
    if (!inboxHasMore || loading || loadingMore) return
    void loadMessages('append')
  }, [inboxHasMore, loading, loadingMore, loadMessages])

  useEffect(() => {
    mailboxOffsetRef.current = 0
    void loadMessages('reset')
  }, [bossView, loadMessages])

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
