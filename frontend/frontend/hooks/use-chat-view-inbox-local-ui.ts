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

const MESH_INBOX_ONLY_LS = 'morg.inbox.meshTransportOnly.v1'
const INBOX_WIRE_FILTER_LS = 'morg.inbox.wireFilter.v1'
const IOTA_INBOX_ONLY_LS = 'morg.inbox.iotaTransportOnly.v1'
const INBOX_PARTNER_MEMORY_LS = 'morg.inbox.partnerMemory.v1'
const INBOX_PARTNER_MEMORY_BLOCKED_LS = 'morg.inbox.partnerMemoryBlocked.v1'

function messageHasMeshTransport(m: Message): boolean {
  return messageTouchesMeshTransport(m)
}

export type UseChatViewInboxLocalUiParams = InboxFeedReadPort & {
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  loadMessages: (mode?: 'reset' | 'append', packageIdOverride?: unknown) => Promise<void>
  setSending: (v: boolean) => void
  setStatus: (s: 'idle' | 'success' | 'error') => void
  setStatusMsg: (msg: string) => void
  myAddress: string
  contactDirectory: Record<string, ContactMeshEntryClient>
}

export function useChatViewInboxLocalUi(p: UseChatViewInboxLocalUiParams) {
  const { messages, setMessages, loadMessages, setSending, setStatus, setStatusMsg, myAddress, contactDirectory } =
    p

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
      const wf = sessionStorage.getItem(INBOX_WIRE_FILTER_LS)
      if (wf === 'encrypted' || wf === 'plaintext') setInboxWireFilterState(wf)
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
            sessionStorage.setItem('morg.inbox.hidden.ids', JSON.stringify([...sett]))
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
        inboxPartnerKey,
        inboxDirectionFilter
      ),
    [displayMessages, myAddress, inboxPartnerKey, inboxDirectionFilter]
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
    setSelectedInboxIds(new Set(filteredDisplayMessages.map((m) => m.id)))
  }, [filteredDisplayMessages])

  const clearInboxSelection = useCallback(() => setSelectedInboxIds(new Set()), [])

  const onHideAllVisibleLocal = useCallback(() => {
    setHiddenInboxIds((prev) => {
      const n = new Set(prev)
      for (const m of filteredDisplayMessages) n.add(m.id)
      try {
        sessionStorage.setItem('morg.inbox.hidden.ids', JSON.stringify([...n]))
      } catch {
        /* ignore */
      }
      return n
    })
  }, [filteredDisplayMessages])

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
    const list = filteredDisplayMessages.filter(
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
  }, [filteredDisplayMessages, selectedInboxIds, loadMessages, setMessages, setSending, setStatus, setStatusMsg])

  return {
    protokollMarkedIds,
    inboxSelectMode,
    setInboxSelectMode,
    selectedInboxIds,
    displayMessages,
    filteredDisplayMessages,
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
  }
}
