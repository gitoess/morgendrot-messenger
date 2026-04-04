'use client'

/**
 * Lokaler Posteingang: ausblenden, Protokoll-Stern, Mehrfachauswahl, Chain-Purge (einzeln/bulk).
 * Aus use-chat-view-core ausgelagert (Phase A).
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { purgeMailboxMessage } from '@/frontend/lib/api'
import type { Message } from '@/frontend/lib/types'

export type UseChatViewInboxLocalUiParams = {
  messages: Message[]
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  loadMessages: (mode?: 'reset' | 'append', packageIdOverride?: unknown) => Promise<void>
  setSending: (v: boolean) => void
  setStatus: (s: 'idle' | 'success' | 'error') => void
  setStatusMsg: (msg: string) => void
}

export function useChatViewInboxLocalUi(p: UseChatViewInboxLocalUiParams) {
  const { messages, setMessages, loadMessages, setSending, setStatus, setStatusMsg } = p

  const [hiddenInboxIds, setHiddenInboxIds] = useState<Set<string>>(() => new Set())
  const [protokollMarkedIds, setProtokollMarkedIds] = useState<Set<string>>(() => new Set())
  const [inboxSelectMode, setInboxSelectMode] = useState(false)
  const [selectedInboxIds, setSelectedInboxIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const h = sessionStorage.getItem('morg.inbox.hidden.ids')
      if (h) setHiddenInboxIds(new Set(JSON.parse(h) as string[]))
      const pr = sessionStorage.getItem('morg.protokoll.marked.ids')
      if (pr) setProtokollMarkedIds(new Set(JSON.parse(pr) as string[]))
    } catch {
      /* ignore */
    }
  }, [])

  const displayMessages = useMemo(
    () => messages.filter((m) => !hiddenInboxIds.has(m.id)),
    [messages, hiddenInboxIds]
  )

  const onHideInboxMessageLocal = useCallback((id: string) => {
    setHiddenInboxIds((prev) => {
      const n = new Set(prev)
      n.add(id)
      try {
        sessionStorage.setItem('morg.inbox.hidden.ids', JSON.stringify([...n]))
      } catch {
        /* ignore */
      }
      return n
    })
  }, [])

  const onPurgeInboxMessageChain = useCallback(
    async (msg: Message) => {
      if (!msg.chainNonce || !msg.chainPurgeable) {
        setStatus('error')
        setStatusMsg(
          'On-chain Purge nicht möglich (nur Funk/Event oder fehlende Nonce). Siehe ENABLE_PURGE / MAILBOX_ID.'
        )
        setTimeout(() => setStatus('idle'), 8000)
        return
      }
      setSending(true)
      try {
        const r = await purgeMailboxMessage(msg.chainNonce, msg.from.startsWith('0x') ? msg.from : undefined)
        if (r.ok) {
          setHiddenInboxIds((prev) => {
            const n = new Set(prev)
            n.add(msg.id)
            try {
              sessionStorage.setItem('morg.inbox.hidden.ids', JSON.stringify([...n]))
            } catch {
              /* ignore */
            }
            return n
          })
          setMessages((prev) => prev.filter((m) => m.id !== msg.id))
          setStatus('success')
          setStatusMsg('Nachricht auf der Chain gelöscht (Storage-Rebate).')
          void loadMessages()
        } else {
          setStatus('error')
          setStatusMsg(r.error || r.message || 'Purge fehlgeschlagen')
        }
      } finally {
        setSending(false)
        setTimeout(() => setStatus('idle'), 6000)
      }
    },
    [loadMessages, setMessages, setSending, setStatus, setStatusMsg]
  )

  const toggleProtokollMark = useCallback((id: string) => {
    setProtokollMarkedIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      try {
        sessionStorage.setItem('morg.protokoll.marked.ids', JSON.stringify([...n]))
      } catch {
        /* ignore */
      }
      return n
    })
  }, [])

  const toggleInboxSelection = useCallback((id: string) => {
    setSelectedInboxIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }, [])

  const selectAllVisibleInbox = useCallback(() => {
    setSelectedInboxIds(new Set(displayMessages.map((m) => m.id)))
  }, [displayMessages])

  const clearInboxSelection = useCallback(() => setSelectedInboxIds(new Set()), [])

  const onHideAllVisibleLocal = useCallback(() => {
    setHiddenInboxIds((prev) => {
      const n = new Set(prev)
      for (const m of displayMessages) n.add(m.id)
      try {
        sessionStorage.setItem('morg.inbox.hidden.ids', JSON.stringify([...n]))
      } catch {
        /* ignore */
      }
      return n
    })
  }, [displayMessages])

  const onBulkHideSelected = useCallback(() => {
    setHiddenInboxIds((prev) => {
      const n = new Set(prev)
      for (const id of selectedInboxIds) n.add(id)
      try {
        sessionStorage.setItem('morg.inbox.hidden.ids', JSON.stringify([...n]))
      } catch {
        /* ignore */
      }
      return n
    })
    setSelectedInboxIds(new Set())
    setInboxSelectMode(false)
  }, [selectedInboxIds])

  const onBulkPurgeSelected = useCallback(async () => {
    const list = displayMessages.filter(
      (m) => selectedInboxIds.has(m.id) && m.chainPurgeable && m.chainNonce
    )
    if (list.length === 0) {
      setStatus('error')
      setStatusMsg('Keine purge-fähigen Nachrichten ausgewählt (Chain-Eintrag nötig).')
      setTimeout(() => setStatus('idle'), 7000)
      return
    }
    setSending(true)
    try {
      for (const msg of list) {
        const r = await purgeMailboxMessage(msg.chainNonce!, msg.from.startsWith('0x') ? msg.from : undefined)
        if (!r.ok) {
          setStatus('error')
          setStatusMsg(r.error || r.message || 'Purge fehlgeschlagen')
          setTimeout(() => setStatus('idle'), 8000)
          return
        }
        setHiddenInboxIds((prev) => new Set(prev).add(msg.id))
        setMessages((prev) => prev.filter((x) => x.id !== msg.id))
      }
      setStatus('success')
      setStatusMsg(`${list.length} Nachricht(en) auf der Chain gelöscht (Rebate).`)
      void loadMessages()
    } finally {
      setSending(false)
      setSelectedInboxIds(new Set())
      setInboxSelectMode(false)
      setTimeout(() => setStatus('idle'), 6000)
    }
  }, [displayMessages, selectedInboxIds, loadMessages, setMessages, setSending, setStatus, setStatusMsg])

  return {
    protokollMarkedIds,
    inboxSelectMode,
    setInboxSelectMode,
    selectedInboxIds,
    displayMessages,
    toggleProtokollMark,
    onHideInboxMessageLocal,
    onPurgeInboxMessageChain,
    toggleInboxSelection,
    selectAllVisibleInbox,
    clearInboxSelection,
    onHideAllVisibleLocal,
    onBulkHideSelected,
    onBulkPurgeSelected,
  }
}
