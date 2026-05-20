'use client'

/**
 * Lokaler Posteingang: ausblenden, Protokoll-Stern, Mehrfachauswahl, Chain-Purge (einzeln/bulk).
 * Aus use-chat-view-core ausgelagert (Phase A).
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { purgeMailboxMessage, type ContactMeshEntryClient } from '@/frontend/lib/api'
import { contactDisplayLabel } from '@/frontend/lib/contact-display'
import {
  filterInboxMessagesByPartnerAndDirection,
  messageCounterpartyAddress,
  messagePureInternetInboxRow,
  messageTouchesInternetTransport,
  messageTouchesMeshTransport,
  uniqueCounterpartyAddresses,
  type InboxDirectionFilter,
} from '@/frontend/features/inbox/inbox-partner-filter'
import type { InboxFeedReadPort } from '@/frontend/features/messenger-ports'
import type { Message } from '@/frontend/lib/types'
import { messageMatchesInboxWireFilter, type InboxWireFilter } from '@/frontend/lib/inbox-wire-filter'
import {
  clearInboxBrowserViewFilters,
  INBOX_FILTERS_CLEARED_EVENT,
  IOTA_INBOX_ONLY_LS,
  INBOX_HIDDEN_IDS_LS,
  INBOX_PARTNER_MEMORY_BLOCKED_LS,
  INBOX_PARTNER_MEMORY_LS,
  INBOX_WIRE_FILTER_LS,
  MESH_INBOX_ONLY_LS,
} from '@/frontend/lib/inbox-browser-view-state'
import {
  readPinnedPinnwandIds,
  sortMessagesPinnedFirst,
  togglePinnedPinnwandId,
} from '@/frontend/lib/pinnwand-pin-store'

function messageHasMeshTransport(m: Message): boolean {
  return messageTouchesMeshTransport(m)
}

export type UseChatViewInboxLocalUiParams = InboxFeedReadPort & {
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  loadMessages: (
    mode?: 'reset' | 'append',
    packageIdOverride?: unknown,
    opts?: { silent?: boolean }
  ) => Promise<void>
  setSending: (v: boolean) => void
  setStatus: (s: 'idle' | 'success' | 'error') => void
  setStatusMsg: (msg: string) => void
  myAddress: string
  contactDirectory: Record<string, ContactMeshEntryClient>
  /** M2: Union-Filter für Gruppenmitglieder */
  groupMemberFilter?: string[] | null
  isGroupMode?: boolean
  /** M3: Anheften im Pinnwand-Kanal */
  isPinnwandMode?: boolean
}

export function useChatViewInboxLocalUi(p: UseChatViewInboxLocalUiParams) {
  const {
    messages,
    setMessages,
    loadMessages,
    setSending,
    setStatus,
    setStatusMsg,
    myAddress,
    contactDirectory,
    groupMemberFilter = null,
    isGroupMode = false,
    isPinnwandMode = false,
  } = p

  const [pinnedPinnwandIds, setPinnedPinnwandIds] = useState<Set<string>>(() => new Set())
  const [hiddenInboxIds, setHiddenInboxIds] = useState<Set<string>>(() => new Set())
  const [protokollMarkedIds, setProtokollMarkedIds] = useState<Set<string>>(() => new Set())
  const [inboxSelectMode, setInboxSelectMode] = useState(false)
  const [selectedInboxIds, setSelectedInboxIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const h = sessionStorage.getItem(INBOX_HIDDEN_IDS_LS)
      if (h) setHiddenInboxIds(new Set(JSON.parse(h) as string[]))
      const pr = sessionStorage.getItem('morg.protokoll.marked.ids')
      if (pr) setProtokollMarkedIds(new Set(JSON.parse(pr) as string[]))
      if (isPinnwandMode) setPinnedPinnwandIds(readPinnedPinnwandIds())
    } catch {
      /* ignore */
    }
  }, [isPinnwandMode])

  const displayMessages = useMemo(
    () => messages.filter((m) => !hiddenInboxIds.has(m.id)),
    [messages, hiddenInboxIds]
  )

  /** Schnellfilter: Gesprächspartner + Kanal (Eingang/Ausgang). */
  const [inboxPartnerKey, setInboxPartnerKey] = useState<string | null>(null)
  const [inboxDirectionFilter, setInboxDirectionFilter] = useState<InboxDirectionFilter>('all')
  const [inboxMeshTransportOnly, setInboxMeshTransportOnly] = useState(false)
  const [inboxIotaTransportOnly, setInboxIotaTransportOnly] = useState(false)
  const [inboxWireFilter, setInboxWireFilterState] = useState<InboxWireFilter>('all')
  const [inboxPartnerMemory, setInboxPartnerMemory] = useState<string[]>([])
  const [inboxPartnerBlockedNorms, setInboxPartnerBlockedNorms] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const meshOnly = sessionStorage.getItem(MESH_INBOX_ONLY_LS) === '1'
      const iotaOnly = sessionStorage.getItem(IOTA_INBOX_ONLY_LS) === '1'
      /** Wire-Filter (nur Klartext/nur verschlüsselt) nicht aus alter Session — blendet sonst Mailbox/Event aus. */
      setInboxMeshTransportOnly(meshOnly)
      setInboxIotaTransportOnly(iotaOnly && !meshOnly)
      if (meshOnly && iotaOnly) {
        try {
          sessionStorage.setItem(IOTA_INBOX_ONLY_LS, '0')
        } catch {
          /* ignore */
        }
      }
      let blockedNorms = new Set<string>()
      const rawBlocked = window.localStorage.getItem(INBOX_PARTNER_MEMORY_BLOCKED_LS)
      if (rawBlocked) {
        const b = JSON.parse(rawBlocked) as unknown
        if (Array.isArray(b)) {
          blockedNorms = new Set(
            b
              .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
              .map((v) => v.trim().toLowerCase())
          )
          setInboxPartnerBlockedNorms(blockedNorms)
        }
      }
      const raw = window.localStorage.getItem(INBOX_PARTNER_MEMORY_LS)
      if (raw) {
        const arr = JSON.parse(raw) as unknown
        if (Array.isArray(arr)) {
          const unique = Array.from(
            new Map(
              arr
                .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
                .map((v) => [v.trim().toLowerCase(), v.trim()])
            ).values()
          ).filter((a) => !blockedNorms.has(a.trim().toLowerCase()))
          setInboxPartnerMemory(unique)
        }
      }
    } catch {
      /* ignore */
    }
  }, [])

  /** Posteingang-Reload leert sessionStorage — React-Filter (z. B. „nur Klartext“) sonst weiter aktiv. */
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onCleared = () => {
      setHiddenInboxIds(new Set())
      setInboxPartnerKey(null)
      setInboxDirectionFilter('all')
      setInboxMeshTransportOnly(false)
      setInboxIotaTransportOnly(false)
      setInboxWireFilterState('all')
    }
    window.addEventListener(INBOX_FILTERS_CLEARED_EVENT, onCleared)
    return () => window.removeEventListener(INBOX_FILTERS_CLEARED_EVENT, onCleared)
  }, [])

  useEffect(() => {
    const observed = uniqueCounterpartyAddresses(displayMessages, myAddress)
    if (observed.length === 0) return
    setInboxPartnerMemory((prev) => {
      const byNorm = new Map(prev.map((v) => [v.trim().toLowerCase(), v]))
      for (const v of observed) {
        const t = v.trim()
        if (!t) continue
        const n = t.toLowerCase()
        if (inboxPartnerBlockedNorms.has(n)) continue
        byNorm.set(n, t)
      }
      const merged = Array.from(byNorm.values())
        .filter((a) => !inboxPartnerBlockedNorms.has(a.trim().toLowerCase()))
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      if (merged.length === prev.length && merged.every((v, i) => v === prev[i])) return prev
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(INBOX_PARTNER_MEMORY_LS, JSON.stringify(merged))
        } catch {
          /* ignore */
        }
      }
      return merged
    })
  }, [displayMessages, myAddress, inboxPartnerBlockedNorms])

  const setInboxMeshTransportOnlyPersist = useCallback((v: boolean) => {
    setInboxMeshTransportOnly(v)
    if (v) {
      setInboxIotaTransportOnly(false)
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(IOTA_INBOX_ONLY_LS, '0')
        } catch {
          /* ignore */
        }
      }
    }
    if (typeof window === 'undefined') return
    try {
      sessionStorage.setItem(MESH_INBOX_ONLY_LS, v ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])

  const setInboxWireFilter = useCallback((f: InboxWireFilter) => {
    setInboxWireFilterState(f)
    if (typeof window === 'undefined') return
    try {
      sessionStorage.setItem(INBOX_WIRE_FILTER_LS, f)
    } catch {
      /* ignore */
    }
  }, [])

  const setInboxIotaTransportOnlyPersist = useCallback((v: boolean) => {
    setInboxIotaTransportOnly(v)
    if (v) {
      setInboxMeshTransportOnly(false)
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(MESH_INBOX_ONLY_LS, '0')
        } catch {
          /* ignore */
        }
      }
    }
    if (typeof window === 'undefined') return
    try {
      sessionStorage.setItem(IOTA_INBOX_ONLY_LS, v ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])

  const inboxPartnerOptions = useMemo(() => {
    const live = uniqueCounterpartyAddresses(displayMessages, myAddress)
    const byNorm = new Map<string, string>()
    for (const a of inboxPartnerMemory) byNorm.set(a.trim().toLowerCase(), a.trim())
    for (const a of live) byNorm.set(a.trim().toLowerCase(), a.trim())
    const addrs = Array.from(byNorm.values()).filter((a) => !inboxPartnerBlockedNorms.has(a.trim().toLowerCase()))
    return addrs.map((address) => {
      const label = contactDisplayLabel(contactDirectory, address)
      const short =
        address.startsWith('0x') && address.length > 12
          ? `${address.slice(0, 8)}…${address.slice(-4)}`
          : address
      return { address, label: label || short }
    })
  }, [displayMessages, myAddress, contactDirectory, inboxPartnerMemory, inboxPartnerBlockedNorms])

  const removeInboxPartnerFromQuickList = useCallback(
    (
      address: string,
      opts?: { hideMatchingMessages?: boolean; messageTransport?: 'mesh' | 'iota' | 'all' }
    ) => {
      const raw = address.trim()
      const n = raw.toLowerCase()
      if (!n) return

      setInboxPartnerBlockedNorms((prevBlocked) => {
        const nextBlocked = new Set(prevBlocked)
        nextBlocked.add(n)
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(INBOX_PARTNER_MEMORY_BLOCKED_LS, JSON.stringify([...nextBlocked]))
          } catch {
            /* ignore */
          }
        }
        return nextBlocked
      })

      setInboxPartnerMemory((prev) => {
        const next = prev.filter((a) => a.trim().toLowerCase() !== n)
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(INBOX_PARTNER_MEMORY_LS, JSON.stringify(next))
          } catch {
            /* ignore */
          }
        }
        return next
      })

      setInboxPartnerKey((cur) => (cur != null && cur.trim().toLowerCase() === n ? null : cur))

      if (opts?.hideMatchingMessages && opts.messageTransport && myAddress.trim()) {
        const transport = opts.messageTransport
        const pred =
          transport === 'all'
            ? (m: Message) => {
                const cp = messageCounterpartyAddress(m, myAddress)
                return !!cp && cp.trim().toLowerCase() === n
              }
            : transport === 'mesh'
              ? (m: Message) => {
                  const cp = messageCounterpartyAddress(m, myAddress)
                  return !!cp && cp.trim().toLowerCase() === n && messageTouchesMeshTransport(m)
                }
              : (m: Message) => {
                  const cp = messageCounterpartyAddress(m, myAddress)
                  return !!cp && cp.trim().toLowerCase() === n && messageTouchesInternetTransport(m)
                }
        setHiddenInboxIds((prev) => {
          const sett = new Set(prev)
          for (const m of messages) {
            if (pred(m)) sett.add(m.id)
          }
          try {
            sessionStorage.setItem(INBOX_HIDDEN_IDS_LS, JSON.stringify([...sett]))
          } catch {
            /* ignore */
          }
          return sett
        })
      }
    },
    [myAddress, messages]
  )

  const partnerFilteredMessages = useMemo(
    () =>
      filterInboxMessagesByPartnerAndDirection(
        displayMessages,
        myAddress,
        isGroupMode ? null : inboxPartnerKey,
        inboxDirectionFilter,
        groupMemberFilter?.length ? { groupMemberAddresses: groupMemberFilter } : undefined
      ),
    [displayMessages, myAddress, inboxPartnerKey, inboxDirectionFilter, groupMemberFilter, isGroupMode]
  )

  const wireFilteredMessages = useMemo(() => {
    if (inboxWireFilter === 'all') return partnerFilteredMessages
    return partnerFilteredMessages.filter((m) => messageMatchesInboxWireFilter(m, inboxWireFilter))
  }, [partnerFilteredMessages, inboxWireFilter])

  const filteredDisplayMessages = useMemo(() => {
    if (inboxMeshTransportOnly) {
      return wireFilteredMessages.filter((m) => messageHasMeshTransport(m))
    }
    if (inboxIotaTransportOnly) {
      return wireFilteredMessages.filter((m) => messagePureInternetInboxRow(m))
    }
    return wireFilteredMessages
  }, [wireFilteredMessages, inboxMeshTransportOnly, inboxIotaTransportOnly])

  const sortedFilteredDisplayMessages = useMemo(() => {
    if (!isPinnwandMode || pinnedPinnwandIds.size === 0) return filteredDisplayMessages
    return sortMessagesPinnedFirst(filteredDisplayMessages, pinnedPinnwandIds)
  }, [filteredDisplayMessages, isPinnwandMode, pinnedPinnwandIds])

  const togglePinnedPinnwand = useCallback((id: string) => {
    const nowPinned = togglePinnedPinnwandId(id)
    setPinnedPinnwandIds(readPinnedPinnwandIds())
    return nowPinned
  }, [])

  const onHideInboxMessageLocal = useCallback((id: string) => {
    setHiddenInboxIds((prev) => {
      const n = new Set(prev)
      n.add(id)
      try {
        sessionStorage.setItem(INBOX_HIDDEN_IDS_LS, JSON.stringify([...n]))
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
              sessionStorage.setItem(INBOX_HIDDEN_IDS_LS, JSON.stringify([...n]))
            } catch {
              /* ignore */
            }
            return n
          })
          setMessages((prev) => prev.filter((m) => m.id !== msg.id))
          setStatus('success')
          setStatusMsg('Nachricht auf der Chain gelöscht (Storage-Rebate).')
          void loadMessages('reset', undefined, { silent: true })
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
    setSelectedInboxIds(new Set(sortedFilteredDisplayMessages.map((m) => m.id)))
  }, [sortedFilteredDisplayMessages])

  const clearInboxSelection = useCallback(() => setSelectedInboxIds(new Set()), [])

  const onHideAllVisibleLocal = useCallback(() => {
    setHiddenInboxIds((prev) => {
      if (prev.size > 0) {
        try {
          sessionStorage.removeItem(INBOX_HIDDEN_IDS_LS)
        } catch {
          /* ignore */
        }
        return new Set()
      }
      const n = new Set(prev)
      for (const m of sortedFilteredDisplayMessages) n.add(m.id)
      try {
        sessionStorage.setItem(INBOX_HIDDEN_IDS_LS, JSON.stringify([...n]))
      } catch {
        /* ignore */
      }
      return n
    })
  }, [sortedFilteredDisplayMessages])

  const onBulkHideSelected = useCallback(() => {
    setHiddenInboxIds((prev) => {
      const n = new Set(prev)
      for (const id of selectedInboxIds) n.add(id)
      try {
        sessionStorage.setItem(INBOX_HIDDEN_IDS_LS, JSON.stringify([...n]))
      } catch {
        /* ignore */
      }
      return n
    })
    setSelectedInboxIds(new Set())
    setInboxSelectMode(false)
  }, [selectedInboxIds])

  const onBulkPurgeSelected = useCallback(async () => {
    const list = sortedFilteredDisplayMessages.filter(
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
      void loadMessages('reset', undefined, { silent: true })
    } finally {
      setSending(false)
      setSelectedInboxIds(new Set())
      setInboxSelectMode(false)
      setTimeout(() => setStatus('idle'), 6000)
    }
  }, [sortedFilteredDisplayMessages, selectedInboxIds, loadMessages, setMessages, setSending, setStatus, setStatusMsg])

  const resetInboxViewFilters = useCallback(() => {
    clearInboxBrowserViewFilters()
    setHiddenInboxIds(new Set())
    setInboxPartnerKey(null)
    setInboxDirectionFilter('all')
    setInboxMeshTransportOnly(false)
    setInboxIotaTransportOnly(false)
    setInboxWireFilterState('all')
  }, [])

  /** Nachrichten da, aber Filter/SessionStorage blendet alles aus → einmal Filter zurücksetzen. */
  useEffect(() => {
    if (messages.length === 0 || filteredDisplayMessages.length > 0) return
    resetInboxViewFilters()
  }, [messages.length, filteredDisplayMessages.length, resetInboxViewFilters])

  return {
    protokollMarkedIds,
    pinnedPinnwandIds,
    togglePinnedPinnwand,
    inboxSelectMode,
    setInboxSelectMode,
    selectedInboxIds,
    displayMessages,
    filteredDisplayMessages: sortedFilteredDisplayMessages,
    hiddenInboxCount: hiddenInboxIds.size,
    inboxPartnerKey,
    setInboxPartnerKey,
    inboxDirectionFilter,
    setInboxDirectionFilter,
    inboxMeshTransportOnly,
    setInboxMeshTransportOnly: setInboxMeshTransportOnlyPersist,
    inboxIotaTransportOnly,
    setInboxIotaTransportOnly: setInboxIotaTransportOnlyPersist,
    inboxWireFilter,
    setInboxWireFilter,
    inboxPartnerOptions,
    toggleProtokollMark,
    onHideInboxMessageLocal,
    onPurgeInboxMessageChain,
    toggleInboxSelection,
    selectAllVisibleInbox,
    clearInboxSelection,
    onHideAllVisibleLocal,
    onBulkHideSelected,
    onBulkPurgeSelected,
    removeInboxPartnerFromQuickList,
    resetInboxViewFilters,
  }
}
