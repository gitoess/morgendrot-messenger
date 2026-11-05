'use client'

/**
 * Lokaler Posteingang: ausblenden, Protokoll-Stern, Mehrfachauswahl, Chain-Purge (einzeln/bulk).
 * Aus use-chat-view-core ausgelagert (Phase A).
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import { inboxSourceFilterReadAllowed } from '@/frontend/lib/messenger-capability-gates'
import { purgeMailboxMessageHybrid, teamBroadcastPurgeHint } from '@/frontend/lib/purge-message-hybrid'
import { contactDisplayLabel } from '@/frontend/lib/contact-display'
import type { InboxOverviewCategory } from '@/frontend/lib/inbox-overview-filter'
import {
  filterInboxMessagesForContactConversation,
  resolveContactConversationMatch,
} from '@/frontend/lib/contact-conversation-filter'
import {
  resolveActiveInboxDisplayMessages,
} from '@/frontend/lib/inbox-conversation-display'
import {
  countUnreadInboxByOverviewCategory,
  inboxScopeKey,
  markInboxOverviewCategorySeenFromMessages,
  readInboxOverviewLastSeen,
} from '@/frontend/lib/inbox-overview-unread'
import {
  filterInboxMessagesByPartnerAndDirection,
  buildPartnerLastMessageAtMap,
  isIgnoredInboxCounterpartyAddress,
  messageCounterpartyAddress,
  messageTouchesInternetTransport,
  messageTouchesMeshTransport,
  messageTouchesTelegramTransport,
  uniqueCounterpartyAddresses,
  type InboxDirectionFilter,
} from '@/frontend/features/inbox/inbox-partner-filter'
import type { InboxFeedReadPort } from '@/frontend/features/messenger-ports'
import type { Message } from '@/frontend/lib/types'
import { messageMatchesInboxWireFilter, type InboxWireFilter } from '@/frontend/lib/inbox-wire-filter'
import {
  messageMatchesInboxSourceFilter,
  type InboxSourceFilter,
} from '@/frontend/lib/inbox-source-filter'
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
import { readPinnedPinnwandIds, togglePinnedPinnwandId } from '@/frontend/lib/pinnwand-pin-store'
import { readMessengerGroups } from '@/frontend/lib/messenger-group-store'
import { sortInboxPinnwandFirst } from '@/frontend/lib/inbox-pinnwand-sort'
import {
  messageBelongsToPinnwand,
  type PinnwandMatchContext,
} from '@/frontend/lib/messenger-pinnwand-capabilities'
import {
  countUnreadByPartner,
  isInboxMessageUnreadForPartner,
  markPartnerSeenFromMessages,
  readPartnerLastSeenMap,
} from '@/frontend/lib/inbox-partner-unread'
import type { InboxUnreadThreadOption } from '@/frontend/components/chat-view-inbox-unread-threads-strip'
import { selectPinnwandFeedMessages } from '@/frontend/lib/pinnwand-feed-messages'
import { TELEGRAM_ALARM_INBOX_PARTNER_KEY } from '@/frontend/lib/telegram-alarm-group-prefs'

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
  /** Team-Mailbox für Gruppen-Broadcast-Erkennung im Kanal-Filter. */
  teamMailboxObjectId?: string | null
  /** M3: Brett-Kontext für Lagebild-Erkennung (Empfänger + ggf. Whitelist). */
  pinnwandMatchContext?: PinnwandMatchContext | null
  /** Helfer/Simple: Kategorie-Chips + Listenfilter (Lagebild aus „Alle“ wenn Streifen). */
  inboxOverviewEnabled?: boolean
  excludePinnwandFromOverviewAlle?: boolean
  apiStatus?: ApiStatus | null
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
    teamMailboxObjectId = null,
    pinnwandMatchContext = null,
    inboxOverviewEnabled = false,
    excludePinnwandFromOverviewAlle = false,
    apiStatus = null,
  } = p

  const [inboxChannelFiltersArmed, setInboxChannelFiltersArmedState] = useState(false)
  const [inboxWireFiltersArmed, setInboxWireFiltersArmedState] = useState(false)
  const [inboxPartnerFiltersArmed, setInboxPartnerFiltersArmedState] = useState(false)
  const [inboxConversationGroupId, setInboxConversationGroupIdState] = useState<string | null>(null)

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
      setPinnedPinnwandIds(readPinnedPinnwandIds())
    } catch {
      /* ignore */
    }
  }, [])

  const displayMessages = useMemo(
    () =>
      messages.filter(
        (m) => !hiddenInboxIds.has(m.id) && !m.id.startsWith('morg-pkg-')
      ),
    [messages, hiddenInboxIds]
  )

  /** Schnellfilter: Gesprächspartner + Kanal (Eingang/Ausgang). */
  const [inboxPartnerKey, setInboxPartnerKey] = useState<string | null>(null)
  const [inboxDirectionFilter, setInboxDirectionFilter] = useState<InboxDirectionFilter>('all')
  const [inboxSourceFilter, setInboxSourceFilterState] = useState<InboxSourceFilter>('all')

  useEffect(() => {
    if (inboxSourceFilterReadAllowed(apiStatus, inboxSourceFilter)) return
    setInboxSourceFilterState('all')
  }, [apiStatus, inboxSourceFilter])
  const [inboxWireFilter, setInboxWireFilterState] = useState<InboxWireFilter>('all')
  const [inboxOverviewCategory, setInboxOverviewCategoryState] =
    useState<InboxOverviewCategory>('alle')
  const [overviewLastSeen, setOverviewLastSeen] = useState(() =>
    readInboxOverviewLastSeen(inboxScopeKey(myAddress))
  )
  const [partnerLastSeenMap, setPartnerLastSeenMap] = useState(() =>
    readPartnerLastSeenMap(inboxScopeKey(myAddress))
  )
  const [inboxPartnerMemory, setInboxPartnerMemory] = useState<string[]>([])
  const [inboxPartnerBlockedNorms, setInboxPartnerBlockedNorms] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      /** Transport-Filter nicht aus alter Session — gesamter Posteingang standardmäßig. */
      try {
        sessionStorage.setItem(MESH_INBOX_ONLY_LS, '0')
        sessionStorage.setItem(IOTA_INBOX_ONLY_LS, '0')
        sessionStorage.setItem(INBOX_WIRE_FILTER_LS, 'all')
      } catch {
        /* ignore */
      }
      setInboxWireFilterState('all')
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
                .filter(
                  (v): v is string =>
                    typeof v === 'string' && v.trim().length > 0 && !isIgnoredInboxCounterpartyAddress(v)
                )
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
      setInboxSourceFilterState('all')
      setInboxWireFilterState('all')
      setInboxChannelFiltersArmedState(false)
      setInboxWireFiltersArmedState(false)
      setInboxPartnerFiltersArmedState(false)
      setInboxConversationGroupIdState(null)
    }
    window.addEventListener(INBOX_FILTERS_CLEARED_EVENT, onCleared)
    return () => window.removeEventListener(INBOX_FILTERS_CLEARED_EVENT, onCleared)
  }, [])

  const observedPartnerNormsKey = useMemo(() => {
    return uniqueCounterpartyAddresses(displayMessages, myAddress)
      .map((v) => v.trim().toLowerCase())
      .filter((v) => v.length > 0)
      .sort()
      .join('|')
  }, [displayMessages, myAddress])

  useEffect(() => {
    if (!observedPartnerNormsKey) return
    const observedNorms = observedPartnerNormsKey.split('|')
    setInboxPartnerMemory((prev) => {
      const prevNorms = new Set(prev.map((v) => v.trim().toLowerCase()))
      let hasNew = false
      for (const n of observedNorms) {
        if (inboxPartnerBlockedNorms.has(n)) continue
        if (!prevNorms.has(n)) {
          hasNew = true
          break
        }
      }
      if (!hasNew) return prev

      const byNorm = new Map(prev.map((v) => [v.trim().toLowerCase(), v.trim().toLowerCase()]))
      for (const n of observedNorms) {
        if (inboxPartnerBlockedNorms.has(n)) continue
        byNorm.set(n, n)
      }
      const merged = Array.from(byNorm.values())
        .filter((a) => !inboxPartnerBlockedNorms.has(a))
        .sort((a, b) => a.localeCompare(b))
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(INBOX_PARTNER_MEMORY_LS, JSON.stringify(merged))
        } catch {
          /* ignore */
        }
      }
      return merged
    })
  }, [observedPartnerNormsKey, inboxPartnerBlockedNorms])

  const setInboxWireFilter = useCallback((f: InboxWireFilter) => {
    setInboxWireFilterState(f)
    if (typeof window === 'undefined') return
    try {
      sessionStorage.setItem(INBOX_WIRE_FILTER_LS, f)
    } catch {
      /* ignore */
    }
  }, [])

  const setInboxSourceFilter = useCallback((f: InboxSourceFilter) => {
    setInboxSourceFilterState(f)
  }, [])

  const setInboxChannelFiltersArmed = useCallback((armed: boolean) => {
    setInboxChannelFiltersArmedState(armed)
    if (!armed) {
      setInboxDirectionFilter('all')
      setInboxSourceFilterState('all')
    }
  }, [])

  const setInboxWireFiltersArmed = useCallback((armed: boolean) => {
    setInboxWireFiltersArmedState(armed)
    if (!armed) setInboxWireFilterState('all')
  }, [])

  const setInboxPartnerFiltersArmed = useCallback((armed: boolean) => {
    setInboxPartnerFiltersArmedState(armed)
    if (!armed) {
      setInboxPartnerKey(null)
      setInboxConversationGroupIdState(null)
    }
  }, [])

  const setInboxConversationGroupId = useCallback((groupId: string | null) => {
    setInboxConversationGroupIdState(groupId?.trim() || null)
  }, [])

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

  const sourceFilterCtx = useMemo(
    () => ({
      pinnwandMatch: pinnwandMatchContext,
      teamMailboxObjectId: teamMailboxObjectId ?? undefined,
    }),
    [pinnwandMatchContext, teamMailboxObjectId]
  )

  const partnerFilteredMessages = useMemo(() => {
    let rows = displayMessages
    if (inboxPartnerFiltersArmed) {
      if (inboxConversationGroupId) {
        const group = readMessengerGroups().find((g) => g.id === inboxConversationGroupId)
        if (group) {
          rows = filterInboxMessagesByPartnerAndDirection(rows, myAddress, null, 'all', {
            groupMemberAddresses: group.memberAddresses,
            teamMailboxObjectId: group.teamMailboxObjectId,
          })
        }
      } else if (inboxPartnerKey?.trim().toLowerCase() === TELEGRAM_ALARM_INBOX_PARTNER_KEY) {
        rows = rows.filter((m) => messageTouchesTelegramTransport(m))
      } else if (inboxPartnerKey?.trim()) {
        const key = inboxPartnerKey.trim().toLowerCase()
        const meNorm = myAddress.trim().toLowerCase()
        if (meNorm && key === meNorm) {
          rows = filterInboxMessagesByPartnerAndDirection(rows, myAddress, meNorm, 'all')
        } else {
          const contactMatch = resolveContactConversationMatch(key, contactDirectory)
          rows = filterInboxMessagesForContactConversation(rows, myAddress, key, 'all', {
            contactMatch,
          })
        }
      }
    }
    if (inboxChannelFiltersArmed) {
      rows = filterInboxMessagesByPartnerAndDirection(rows, myAddress, null, inboxDirectionFilter)
      if (inboxSourceFilter !== 'all') {
        rows = rows.filter((m) => messageMatchesInboxSourceFilter(m, inboxSourceFilter, sourceFilterCtx))
      }
    }
    return rows
  }, [
    displayMessages,
    myAddress,
    inboxPartnerKey,
    inboxDirectionFilter,
    inboxSourceFilter,
    inboxChannelFiltersArmed,
    inboxPartnerFiltersArmed,
    inboxConversationGroupId,
    sourceFilterCtx,
    contactDirectory,
  ])

  const wireFilteredMessages = useMemo(() => {
    if (!inboxWireFiltersArmed || inboxWireFilter === 'all') return partnerFilteredMessages
    return partnerFilteredMessages.filter((m) => messageMatchesInboxWireFilter(m, inboxWireFilter))
  }, [partnerFilteredMessages, inboxWireFilter, inboxWireFiltersArmed])

  useEffect(() => {
    setPartnerLastSeenMap(readPartnerLastSeenMap(inboxScopeKey(myAddress)))
  }, [myAddress])

  const partnerUnreadByNorm = useMemo(
    () =>
      countUnreadByPartner(
        wireFilteredMessages,
        myAddress,
        partnerLastSeenMap,
        pinnwandMatchContext
      ),
    [wireFilteredMessages, myAddress, partnerLastSeenMap, pinnwandMatchContext]
  )

  const partnerLastMessageAt = useMemo(
    () => buildPartnerLastMessageAtMap(displayMessages, myAddress),
    [displayMessages, myAddress]
  )

  const inboxPartnerOptions = useMemo(() => {
    const live = uniqueCounterpartyAddresses(displayMessages, myAddress)
    const byNorm = new Map<string, string>()
    for (const a of inboxPartnerMemory) byNorm.set(a.trim().toLowerCase(), a.trim())
    for (const a of live) byNorm.set(a.trim().toLowerCase(), a.trim())
    const addrs = Array.from(byNorm.values()).filter(
      (a) =>
        !inboxPartnerBlockedNorms.has(a.trim().toLowerCase()) &&
        !isIgnoredInboxCounterpartyAddress(a)
    )
    return addrs
      .map((address) => {
        const label = contactDisplayLabel(contactDirectory, address)
        const short =
          address.startsWith('0x') && address.length > 12
            ? `${address.slice(0, 8)}…${address.slice(-4)}`
            : address
        const norm = address.trim().toLowerCase()
        return {
          address,
          label: label || short,
          unreadCount: partnerUnreadByNorm[norm] ?? 0,
          lastMessageAt: partnerLastMessageAt[norm] ?? 0,
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'de'))
  }, [
    displayMessages,
    myAddress,
    contactDirectory,
    inboxPartnerMemory,
    inboxPartnerBlockedNorms,
    partnerUnreadByNorm,
    partnerLastMessageAt,
  ])

  const inboxUnreadThreadOptions = useMemo((): InboxUnreadThreadOption[] => {
    return inboxPartnerOptions
      .filter((o) => (o.unreadCount ?? 0) > 0)
      .sort((a, b) => (b.unreadCount ?? 0) - (a.unreadCount ?? 0))
      .slice(0, 6)
      .map((o) => ({
        address: o.address,
        label: o.label,
        unreadCount: o.unreadCount ?? 0,
      }))
  }, [inboxPartnerOptions])

  useEffect(() => {
    if (!inboxPartnerKey?.trim()) return
    const next = markPartnerSeenFromMessages(
      inboxScopeKey(myAddress),
      inboxPartnerKey,
      wireFilteredMessages,
      myAddress,
      pinnwandMatchContext
    )
    setPartnerLastSeenMap(next)
  }, [inboxPartnerKey, wireFilteredMessages, myAddress, pinnwandMatchContext])

  const isInboxMessageUnread = useCallback(
    (msg: Message) =>
      isInboxMessageUnreadForPartner(msg, myAddress, partnerLastSeenMap, pinnwandMatchContext),
    [myAddress, partnerLastSeenMap, pinnwandMatchContext]
  )

  const filteredDisplayMessages = useMemo(() => wireFilteredMessages, [wireFilteredMessages])

  const sortedFilteredDisplayMessages = useMemo(
    () =>
      sortInboxPinnwandFirst(
        filteredDisplayMessages,
        pinnwandMatchContext,
        pinnedPinnwandIds.size > 0 ? pinnedPinnwandIds : undefined
      ),
    [filteredDisplayMessages, pinnwandMatchContext, pinnedPinnwandIds]
  )

  const inboxOverviewCtx = useMemo(
    () => ({
      myAddress,
      broadcastAddress: pinnwandMatchContext?.broadcastAddress ?? '',
      pinnwandMatch: pinnwandMatchContext,
      excludePinnwandFromAlle: excludePinnwandFromOverviewAlle,
    }),
    [myAddress, pinnwandMatchContext, excludePinnwandFromOverviewAlle]
  )

  useEffect(() => {
    setOverviewLastSeen(readInboxOverviewLastSeen(inboxScopeKey(myAddress)))
  }, [myAddress])

  const markOverviewCategorySeen = useCallback(
    (category: InboxOverviewCategory) => {
      const next = markInboxOverviewCategorySeenFromMessages(
        inboxScopeKey(myAddress),
        category,
        wireFilteredMessages,
        inboxOverviewCtx
      )
      setOverviewLastSeen(next)
    },
    [myAddress, wireFilteredMessages, inboxOverviewCtx]
  )

  const setInboxOverviewCategory = useCallback((category: InboxOverviewCategory) => {
    setInboxOverviewCategoryState(category)
    if (category === 'alle') {
      setInboxChannelFiltersArmed(false)
      setInboxSourceFilterState('all')
      return
    }
    const source: InboxSourceFilter =
      category === 'lagebild'
        ? 'lagebild'
        : category === 'funk'
          ? 'funk'
          : 'mailbox'
    setInboxSourceFilterState(source)
    setInboxChannelFiltersArmedState(true)
  }, [setInboxChannelFiltersArmed])

  useEffect(() => {
    if (!inboxOverviewEnabled) return
    markOverviewCategorySeen(inboxOverviewCategory)
    if (inboxOverviewCategory === 'alle' && excludePinnwandFromOverviewAlle) {
      markOverviewCategorySeen('lagebild')
    }
  }, [
    inboxOverviewEnabled,
    inboxOverviewCategory,
    excludePinnwandFromOverviewAlle,
    wireFilteredMessages,
    markOverviewCategorySeen,
  ])

  const inboxOverviewUnreadCounts = useMemo(
    () => countUnreadInboxByOverviewCategory(wireFilteredMessages, inboxOverviewCtx, overviewLastSeen),
    [wireFilteredMessages, inboxOverviewCtx, overviewLastSeen]
  )

  const overviewFilteredDisplayMessages = useMemo(
    () =>
      resolveActiveInboxDisplayMessages(sortedFilteredDisplayMessages, {
        overviewEnabled: inboxOverviewEnabled,
        category: inboxOverviewCategory,
        ctx: inboxOverviewCtx,
        inboxPartnerFiltersArmed,
        inboxPartnerKey,
        inboxConversationGroupId,
      }),
    [
      sortedFilteredDisplayMessages,
      inboxOverviewEnabled,
      inboxOverviewCategory,
      inboxOverviewCtx,
      inboxPartnerFiltersArmed,
      inboxPartnerKey,
      inboxConversationGroupId,
    ]
  )

  const pinnwandFeedMessages = useMemo(
    () =>
      selectPinnwandFeedMessages(
        displayMessages,
        pinnwandMatchContext,
        pinnedPinnwandIds.size > 0 ? pinnedPinnwandIds : undefined
      ),
    [displayMessages, pinnwandMatchContext, pinnedPinnwandIds]
  )

  const isPinnwandInboxMessage = useCallback(
    (msg: Message) =>
      pinnwandMatchContext?.broadcastAddress.trim()
        ? messageBelongsToPinnwand(msg, pinnwandMatchContext)
        : false,
    [pinnwandMatchContext]
  )

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
        const r = await purgeMailboxMessageHybrid(msg, { backendReachable: true })
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
          setStatusMsg(r.message || 'Nachricht auf der Chain gelöscht (Storage-Rebate).')
          void loadMessages('reset', undefined, { silent: true })
        } else {
          setStatus('error')
          const hint = teamBroadcastPurgeHint(msg, myAddress)
          setStatusMsg(r.error || hint || r.message || 'Purge fehlgeschlagen')
        }
      } finally {
        setSending(false)
        setTimeout(() => setStatus('idle'), 6000)
      }
    },
    [loadMessages, myAddress, setMessages, setSending, setStatus, setStatusMsg]
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
        const r = await purgeMailboxMessageHybrid(msg, { backendReachable: true })
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
    setHiddenInboxIds((prev) => (prev.size === 0 ? prev : new Set()))
    setInboxPartnerKey((cur) => (cur == null ? cur : null))
    setInboxDirectionFilter((cur) => (cur === 'all' ? cur : 'all'))
    setInboxSourceFilterState((cur) => (cur === 'all' ? cur : 'all'))
    setInboxWireFilterState((cur) => (cur === 'all' ? cur : 'all'))
    setInboxChannelFiltersArmedState(false)
    setInboxWireFiltersArmedState(false)
    setInboxPartnerFiltersArmedState(false)
  }, [])

  /** Geladen vs. sichtbar — konkrete Filter nennen (nicht pauschal „Nur Funk“). */
  const inboxVisibilityHint = useMemo(() => {
    const inboxMessages = messages.filter(
      (m) => !m.id.startsWith('morg-pkg-')
    )
    if (inboxMessages.length === 0) return null
    if (filteredDisplayMessages.length > 0) return null

    const hiddenLocal = inboxMessages.filter((m) => hiddenInboxIds.has(m.id)).length
    const reasons: string[] = []
    if (hiddenLocal > 0) reasons.push(`${hiddenLocal} lokal ausgeblendet`)
    if (inboxPartnerFiltersArmed && inboxPartnerKey) reasons.push('Partner-Filter')
    if (inboxChannelFiltersArmed && inboxDirectionFilter !== 'all') {
      reasons.push(`Kanal „${inboxDirectionFilter === 'in' ? 'Eingang' : 'Ausgang'}“`)
    }
    if (inboxChannelFiltersArmed && inboxSourceFilter !== 'all') {
      reasons.push(`Quelle „${inboxSourceFilter}“`)
    }
    if (inboxWireFilter === 'encrypted') reasons.push('Inhalt „Verschlüsselt“')
    if (inboxWireFilter === 'plaintext') reasons.push('Inhalt „Klartext“')

    const encLoaded = inboxMessages.filter((m) => m.encrypted === true).length
    const encVisible = filteredDisplayMessages.filter((m) => m.encrypted === true).length
    if (encLoaded > 0 && encVisible === 0 && inboxWireFilter === 'plaintext') {
      reasons.push(`${encLoaded} verschlüsselt (unter „Klartext“ ausgeblendet)`)
    }
    const plainLoaded = inboxMessages.filter((m) => m.encrypted !== true).length
    const plainVisible = filteredDisplayMessages.filter((m) => m.encrypted !== true).length
    if (plainLoaded > 0 && plainVisible === 0 && inboxWireFilter === 'encrypted') {
      reasons.push(`${plainLoaded} Klartext (unter „Verschlüsselt“ ausgeblendet)`)
    }

    if (reasons.length === 0) {
      return `${inboxMessages.length} Nachrichten geladen, Anzeige leer — Filter unter Partner / Kanal / Posteingang prüfen.`
    }
    return `${inboxMessages.length} geladen, keine sichtbar: ${reasons.join(' · ')}.`
  }, [
    messages,
    filteredDisplayMessages,
    hiddenInboxIds,
    inboxPartnerKey,
    inboxChannelFiltersArmed,
    inboxPartnerFiltersArmed,
    inboxDirectionFilter,
    inboxSourceFilter,
    inboxWireFilter,
    inboxWireFiltersArmed,
  ])

  /** Transport/Partner blockieren Mailbox — zurücksetzen (nicht bei bewusstem Inhalt-Filter Klartext/Verschlüsselt). */
  useEffect(() => {
    if (inboxPartnerFiltersArmed && inboxPartnerKey?.trim()) return
    if (messages.length === 0) return
    if (displayMessages.length === 0) return
    if (inboxWireFiltersArmed && inboxWireFilter !== 'all') return
    const encLoaded = messages.filter((m) => m.encrypted === true).length
    const encVisible = filteredDisplayMessages.filter((m) => m.encrypted === true).length
    const mbLoaded = messages.filter((m) => m.chainPurgeable === true).length
    const mbVisible = filteredDisplayMessages.filter((m) => m.chainPurgeable === true).length
    const transportFilterBlocksMailbox =
      inboxChannelFiltersArmed &&
      inboxSourceFilter === 'funk' &&
      mbLoaded > 0 &&
      mbVisible === 0
    const filtersActive =
      hiddenInboxIds.size > 0 ||
      (inboxPartnerFiltersArmed && inboxPartnerKey != null) ||
      (inboxChannelFiltersArmed &&
        (inboxDirectionFilter !== 'all' || inboxSourceFilter !== 'all')) ||
      (inboxWireFiltersArmed && inboxWireFilter !== 'all')
    const needsReset =
      (filteredDisplayMessages.length === 0 && filtersActive) ||
      (encLoaded > 0 && encVisible === 0 && filtersActive) ||
      transportFilterBlocksMailbox
    if (!needsReset) return
    resetInboxViewFilters()
  }, [
    messages,
    displayMessages.length,
    filteredDisplayMessages,
    hiddenInboxIds.size,
    inboxPartnerKey,
    inboxChannelFiltersArmed,
    inboxPartnerFiltersArmed,
    inboxDirectionFilter,
    inboxSourceFilter,
    resetInboxViewFilters,
    inboxWireFilter,
    inboxWireFiltersArmed,
  ])

  return {
    protokollMarkedIds,
    pinnedPinnwandIds,
    togglePinnedPinnwand,
    inboxSelectMode,
    setInboxSelectMode,
    selectedInboxIds,
    displayMessages,
    filteredDisplayMessages: overviewFilteredDisplayMessages,
    pinnwandFeedMessages,
    inboxOverviewEnabled,
    isPinnwandInboxMessage,
    inboxOverviewCategory,
    setInboxOverviewCategory,
    inboxOverviewUnreadCounts,
    hiddenInboxCount: hiddenInboxIds.size,
    inboxPartnerKey,
    setInboxPartnerKey,
    inboxDirectionFilter,
    setInboxDirectionFilter,
    inboxSourceFilter,
    setInboxSourceFilter,
    inboxChannelFiltersArmed,
    setInboxChannelFiltersArmed,
    inboxWireFiltersArmed,
    setInboxWireFiltersArmed,
    inboxPartnerFiltersArmed,
    setInboxPartnerFiltersArmed,
    inboxConversationGroupId,
    setInboxConversationGroupId,
    inboxWireFilter,
    setInboxWireFilter,
    inboxPartnerOptions,
    inboxUnreadThreadOptions,
    isInboxMessageUnread,
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
