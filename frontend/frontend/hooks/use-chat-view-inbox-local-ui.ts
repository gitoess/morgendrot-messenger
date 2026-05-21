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
    mode?: 'reset' | 'append' | 'poll',
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
      /** Transport-Filter (Nur Funk/Nur IOTA) nicht aus alter Session — blendet Mailbox/verschlüsselt aus. */
      setInboxMeshTransportOnly(false)
      setInboxIotaTransportOnly(false)
      try {
        sessionStorage.setItem(MESH_INBOX_ONLY_LS, '0')
        sessionStorage.setItem(IOTA_INBOX_ONLY_LS, '0')
        const rawWire = sessionStorage.getItem(INBOX_WIRE_FILTER_LS)
        const wire: InboxWireFilter =
          rawWire === 'encrypted' || rawWire === 'plaintext' || rawWire === 'all' ? rawWire : 'all'
        setInboxWireFilterState(wire)
      } catch {
        setInboxWireFilterState('all')
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
    const visible = filteredDisplayMessages
    setHiddenInboxIds((prev) => {
      if (prev.size > 0) {
        try {
          sessionStorage.removeItem(INBOX_HIDDEN_IDS_LS)
        } catch {
          /* ignore */
        }
        setStatus('success')
        setStatusMsg('Ausgeblendete Nachrichten wieder eingeblendet (nur dieser Browser).')
        setTimeout(() => setStatus('idle'), 4000)
        return new Set()
      }
      if (visible.length === 0) {
        setStatus('error')
        setStatusMsg('Keine sichtbaren Zeilen — Filter „Alles“ / Partner prüfen.')
        setTimeout(() => setStatus('idle'), 5000)
        return prev
      }
      const n = new Set(prev)
      for (const m of visible) n.add(m.id)
      try {
        sessionStorage.setItem(INBOX_HIDDEN_IDS_LS, JSON.stringify([...n]))
      } catch {
        /* ignore */
      }
      setStatus('success')
      setStatusMsg(`${visible.length} Zeile(n) lokal ausgeblendet (Chain unverändert).`)
      setTimeout(() => setStatus('idle'), 4000)
      return n
    })
  }, [filteredDisplayMessages, setStatus, setStatusMsg])

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

  /** Geladen vs. sichtbar — Hinweis wenn Mailbox/verschlüsselt im State, aber Filter versteckt. */
  const inboxVisibilityHint = useMemo(() => {
    if (messages.length === 0) return null
    const encLoaded = messages.filter((m) => m.encrypted === true).length
    const encVisible = filteredDisplayMessages.filter((m) => m.encrypted === true).length
    const mbLoaded = messages.filter((m) => m.chainPurgeable === true).length
    const mbVisible = filteredDisplayMessages.filter((m) => m.chainPurgeable === true).length
    if (encLoaded > 0 && encVisible === 0) {
      if (inboxWireFilter === 'plaintext') {
        return `${encLoaded} verschlüsselt geladen — unter „Klartext“ werden sie ausgeblendet. „Alles“ oder „Verschlüsselt“ wählen.`
      }
      return `${encLoaded} verschlüsselt geladen, aber keiner sichtbar — Filter „Alle / Alles“ oder „Verschlüsselt“ wählen.`
    }
    const plainLoaded = messages.filter((m) => m.encrypted !== true).length
    const plainVisible = filteredDisplayMessages.filter((m) => m.encrypted !== true).length
    if (plainLoaded > 0 && plainVisible === 0 && inboxWireFilter === 'encrypted') {
      return `${plainLoaded} Klartext-Zeilen geladen — unter „Verschlüsselt“ ausgeblendet. „Alles“ oder „Klartext“ wählen.`
    }
    if (mbLoaded > 0 && mbVisible === 0) {
      return `${mbLoaded} Mailbox-Zeilen geladen, aber keine sichtbar — nicht „Nur Funk“ aktivieren.`
    }
    if (filteredDisplayMessages.length === 0 && messages.length > 0) {
      return `${messages.length} Nachrichten geladen, Anzeige leer — Partner-/Transport-Filter zurücksetzen.`
    }
    return null
  }, [messages, filteredDisplayMessages, inboxWireFilter])

  /** Transport/Partner blockieren Mailbox — zurücksetzen (nicht bei bewusstem Inhalt-Filter Klartext/Verschlüsselt). */
  useEffect(() => {
    if (messages.length === 0) return
    if (inboxWireFilter !== 'all') return
    const encLoaded = messages.filter((m) => m.encrypted === true).length
    const encVisible = filteredDisplayMessages.filter((m) => m.encrypted === true).length
    const mbLoaded = messages.filter((m) => m.chainPurgeable === true).length
    const mbVisible = filteredDisplayMessages.filter((m) => m.chainPurgeable === true).length
    const transportFilterBlocksMailbox =
      (inboxMeshTransportOnly || inboxIotaTransportOnly) && mbLoaded > 0 && mbVisible === 0
    if (
      filteredDisplayMessages.length === 0 ||
      (encLoaded > 0 && encVisible === 0) ||
      transportFilterBlocksMailbox
    ) {
      resetInboxViewFilters()
    }
  }, [
    messages,
    filteredDisplayMessages,
    resetInboxViewFilters,
    inboxMeshTransportOnly,
    inboxIotaTransportOnly,
    inboxWireFilter,
  ])

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
    inboxVisibilityHint,
  }
}
