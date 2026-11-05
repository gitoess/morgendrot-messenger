'use client'

/**
 * Posteingang-Schicht: Laden, Filter, lokale UI, Status-Polling, Mirror/Outbox, Exporte.
 * Aus use-chat-view-core extrahiert (P1 Port-Assembler-Scheibe).
 */

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { fetchAllInboxMessagesForExport, type ContactMeshEntryClient, readBootstrapCachedApiStatus } from '@/frontend/lib/api'
import { extractCompletedSlideSequences } from '@/frontend/features/inbox/inbox-slideshow'
import { buildChatInboxRows, type ChatInboxRow } from '@/frontend/features/inbox/chat-view-inbox-rows'
import { useChatViewInbox } from '@/frontend/hooks/use-chat-view-inbox'
import { useChatViewEinsatzExports } from '@/frontend/hooks/use-chat-view-einsatz-exports'
import { useChatViewMirrorDelay } from '@/frontend/hooks/use-chat-view-mirror-delay'
import { useChatViewApiStatusPoll } from '@/frontend/hooks/use-chat-view-api-status-poll'
import { useChatViewInboxLocalUi } from '@/frontend/hooks/use-chat-view-inbox-local-ui'
import {
  useChatViewPackageFilterState,
  useChatViewPackageIdCommands,
} from '@/frontend/hooks/use-chat-view-package-id'
import { mergeAllMessages } from '@/frontend/lib/message-dedup'
import type { Message } from '@/frontend/lib/types'
import {
  readComposerMailboxObjectId,
  writeComposerMailboxObjectId,
} from '@/frontend/lib/composer-mailbox-object-id'
import {
  readContactSendMailboxTarget,
  writeContactSendMailboxTarget,
} from '@/frontend/lib/contact-mailbox-slots'
import { defaultContactSendMailboxTarget } from '@/frontend/lib/contact-send-mailbox-default'
import { composerMailboxIdForSendTarget } from '@/frontend/lib/sync-composer-mailbox-from-target'
import { resolveComposerIotaAddress } from '@/frontend/lib/composer-recipient-fields'
import {
  isPinnwandChannel,
  type MessengerChatChannel,
} from '@/frontend/lib/messenger-chat-channel'
import { isSimpleUiMode } from '@/frontend/lib/messenger-role-capabilities'
import {
  isMessengerHelperRole,
  showPinnwandInboxStrip,
  buildPinnwandMatchContext,
} from '@/frontend/lib/messenger-pinnwand-capabilities'
import { writeActiveGroupId } from '@/frontend/lib/messenger-group-store'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import { shouldApplyMeshFirstTransportDefault } from '@/frontend/lib/standalone-onboarding'
import {
  PACKAGE_PROFILE_REGISTRY_CHANGED,
  readActiveProfileSnapshot,
} from '@/frontend/lib/package-profile-registry'

export type UseChatViewInboxOrchestrationParams = {
  channelMode: MessengerChatChannel
  role: string
  myAddress: string
  groupTeamMailboxId: string | null
  isPrivate: boolean
  showSetup: boolean
  recipient: string
  partner: string
  encrypted: boolean
  setRecipient: (v: string) => void
  setSending: (v: boolean) => void
  setStatus: (v: 'idle' | 'success' | 'error') => void
  setStatusMsg: (v: string) => void
  setComposerMailboxObjectIdState: (v: string) => void
  meshFirstTransportDefaultApplied: MutableRefObject<boolean>
  onMeshFirstTransportDefault: (t: ForcedTransport) => void
  directory: Record<string, ContactMeshEntryClient>
  refreshContactDirectory: () => void
  isMeshVerifiedForAddress: (address: string) => boolean
}

export function useChatViewInboxOrchestration(p: UseChatViewInboxOrchestrationParams) {
  const {
    channelMode,
    role,
    myAddress,
    groupTeamMailboxId,
    isPrivate,
    showSetup,
    recipient,
    partner,
    encrypted,
    setRecipient,
    setSending,
    setStatus,
    setStatusMsg,
    setComposerMailboxObjectIdState,
    meshFirstTransportDefaultApplied,
    onMeshFirstTransportDefault,
    directory,
    refreshContactDirectory,
    isMeshVerifiedForAddress,
  } = p

  const {
    inboxPackageFilter,
    setInboxPackageFilter,
    packageIdSuggestions,
    setPackageIdSuggestions,
    packageIdBusy,
    setPackageIdBusy,
  } = useChatViewPackageFilterState()

  const [serverPackageId, setServerPackageId] = useState<string | undefined>(() => {
    const boot = readBootstrapCachedApiStatus()?.packageId?.trim()
    return boot || undefined
  })

  const {
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
  } = useChatViewInbox({
    refreshContactDirectory,
    myAddress,
    packageId: inboxPackageFilter,
    apiPackageId: serverPackageId,
  })

  const meshInboundTextBufferRef = useRef<string[]>([])

  const clearMeshInboundText = useCallback(() => {
    meshInboundTextBufferRef.current = []
  }, [])

  const drainMeshInboundText = useCallback((): string[] => {
    const out = meshInboundTextBufferRef.current
    meshInboundTextBufferRef.current = []
    return out
  }, [])

  const appendMeshMessageWithInboundCapture = useCallback(
    (msg: Message) => {
      if (msg.source === 'mesh' && typeof msg.content === 'string' && msg.content.includes('MORG_NAK_V1')) {
        meshInboundTextBufferRef.current.push(msg.content)
        if (meshInboundTextBufferRef.current.length > 64) {
          meshInboundTextBufferRef.current.shift()
        }
      }
      appendMeshMessage(msg)
    },
    [appendMeshMessage]
  )

  const messagesForExport = useCallback(async () => {
    const fromApi = await fetchAllInboxMessagesForExport({
      packageId: inboxPackageFilter.trim() || undefined,
      bossView: false,
      role,
    })
    const meshOnly = messages.filter((m) => m.transports?.includes('mesh'))
    if (meshOnly.length === 0) return fromApi
    return mergeAllMessages([...fromApi, ...meshOnly])
  }, [messages, inboxPackageFilter, role])

  const {
    mirrorQueuePending,
    offlineMailboxQueuePending,
    offlineMailboxQueueUntrustedTimeCount,
    offlineMailboxQueueBackoffCount,
    offlineMailboxQueueErrorHint,
    offlineMailboxQueueItems,
    removeOfflineMailboxQueueItems,
    refreshOfflineMailboxQueueCount,
    runMirrorDrain,
    runOfflineMailboxDrain,
    onDelayMirrorPlaintext,
  } = useChatViewMirrorDelay({
    loadMessages,
    setStatus,
    setStatusMsg,
    mailboxRecipient: recipient,
    senderAddress: myAddress,
  })

  const { apiStatus, refreshApiStatus, basisUnreachable, packageIdMismatch, deviceTimeTrustWarn, statusCacheAgeMinutes, statusPollAttempted } =
    useChatViewApiStatusPoll({
      runMirrorDrain,
      runOfflineMailboxDrain,
      pollInbox: () => loadMessages('poll', undefined, { silent: true }),
      onReconnectNow: () => {
        void loadMessages('poll', undefined, { silent: true })
        refreshContactDirectory()
        void runOfflineMailboxDrain()
      },
      localPackageId: inboxPackageFilter.trim(),
      probeGeolocationForDeviceTime: isPrivate,
    })

  useEffect(() => {
    const pkg = (apiStatus?.packageId ?? '').trim()
    if (!pkg || pkg === serverPackageId) return
    setServerPackageId(pkg)
  }, [apiStatus?.packageId, serverPackageId])

  useEffect(() => {
    const addr = resolveComposerIotaAddress(recipient, partner, encrypted).trim().toLowerCase()
    if (!/^0x[a-f0-9]{64}$/i.test(addr)) {
      setComposerMailboxObjectIdState('')
      return
    }
    const savedComposer = readComposerMailboxObjectId(addr)
    const savedTarget = readContactSendMailboxTarget(addr)
    if (savedComposer) {
      setComposerMailboxObjectIdState(savedComposer)
      return
    }
    if (savedTarget && savedTarget !== 'event') {
      const mb = composerMailboxIdForSendTarget({
        recipientWallet: addr,
        target: savedTarget,
        contactDirectory: directory,
        serverMailboxId: apiStatus?.mailboxId,
      })
      setComposerMailboxObjectIdState(mb)
      return
    }
    setComposerMailboxObjectIdState('')
  }, [recipient, partner, encrypted, directory, apiStatus?.mailboxId, setComposerMailboxObjectIdState])

  useEffect(() => {
    const addr = resolveComposerIotaAddress(recipient, partner, encrypted).trim().toLowerCase()
    if (!/^0x[a-f0-9]{64}$/i.test(addr)) return
    if (readComposerMailboxObjectId(addr)) return
    if (readContactSendMailboxTarget(addr)) return
    const def = defaultContactSendMailboxTarget(apiStatus)
    if (def === 'event') return
    writeContactSendMailboxTarget(addr, def)
    const mb = composerMailboxIdForSendTarget({
      recipientWallet: addr,
      target: def,
      contactDirectory: directory,
      serverMailboxId: apiStatus?.mailboxId,
    })
    setComposerMailboxObjectIdState(mb)
    if (mb) writeComposerMailboxObjectId(addr, mb)
  }, [recipient, partner, encrypted, apiStatus, directory, setComposerMailboxObjectIdState])

  const inboxOverviewEnabled = useMemo(() => {
    return isSimpleUiMode(apiStatus) || isMessengerHelperRole(role)
  }, [apiStatus, role])

  const excludePinnwandFromOverviewAlle = useMemo(
    () => showPinnwandInboxStrip(apiStatus, role, channelMode),
    [apiStatus, role, channelMode]
  )

  const pinnwandMatchContext = useMemo(
    () => buildPinnwandMatchContext(apiStatus, myAddress),
    [apiStatus, myAddress]
  )

  const {
    protokollMarkedIds,
    inboxSelectMode,
    setInboxSelectMode,
    selectedInboxIds,
    displayMessages,
    filteredDisplayMessages,
    pinnwandFeedMessages,
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
    isPinnwandInboxMessage,
    toggleProtokollMark,
    onHideInboxMessageLocal,
    onPurgeInboxMessageChain,
    toggleInboxSelection,
    selectAllVisibleInbox,
    clearInboxSelection,
    onHideAllVisibleLocal,
    hiddenInboxCount,
    onBulkHideSelected,
    onBulkPurgeSelected,
    removeInboxPartnerFromQuickList,
    resetInboxViewFilters,
    inboxVisibilityHint,
    pinnedPinnwandIds,
    togglePinnedPinnwand,
    inboxOverviewEnabled: inboxOverviewChipsVisible,
    inboxOverviewCategory,
    setInboxOverviewCategory,
    inboxOverviewUnreadCounts,
  } = useChatViewInboxLocalUi({
    messages,
    setMessages,
    loadMessages,
    setSending,
    setStatus,
    setStatusMsg,
    myAddress,
    contactDirectory: directory,
    teamMailboxObjectId: groupTeamMailboxId,
    pinnwandMatchContext,
    inboxOverviewEnabled,
    excludePinnwandFromOverviewAlle,
    apiStatus,
  })

  useEffect(() => {
    if (!isPinnwandChannel(channelMode)) return
    setInboxOverviewCategory('lagebild')
  }, [channelMode, setInboxOverviewCategory])

  useEffect(() => {
    if (channelMode === 'pinnwand' || channelMode === 'notes') {
      setInboxChannelFiltersArmed(false)
      setInboxWireFiltersArmed(false)
      setInboxPartnerFiltersArmed(false)
    }
  }, [channelMode, setInboxChannelFiltersArmed, setInboxWireFiltersArmed, setInboxPartnerFiltersArmed])

  useEffect(() => {
    if (!packageIdMismatch) return
    setInboxPackageFilter('')
    void loadMessages('reset', undefined, { silent: true })
  }, [packageIdMismatch, setInboxPackageFilter, loadMessages])

  useEffect(() => {
    const serverPkg = (apiStatus?.packageId ?? '').trim().toLowerCase()
    if (!serverPkg || !/^0x[a-f0-9]{64}$/.test(serverPkg)) return
    const snap = readActiveProfileSnapshot()
    if (!snap?.resolved || !snap.packageId) return
    const profilePkg = snap.packageId.trim().toLowerCase()
    if (profilePkg !== serverPkg) return
    if (!inboxPackageFilter.trim()) setInboxPackageFilter(snap.packageId)
  }, [apiStatus?.packageId, inboxPackageFilter, setInboxPackageFilter])

  useEffect(() => {
    const onProfileChange = () => {
      const snap = readActiveProfileSnapshot()
      if (snap?.resolved && snap.packageId) setInboxPackageFilter(snap.packageId)
      void loadMessages('reset', snap?.resolved ? snap.packageId : undefined)
    }
    window.addEventListener(PACKAGE_PROFILE_REGISTRY_CHANGED, onProfileChange)
    return () => window.removeEventListener(PACKAGE_PROFILE_REGISTRY_CHANGED, onProfileChange)
  }, [loadMessages, setInboxPackageFilter])

  useEffect(() => {
    if (!isPinnwandChannel(channelMode)) return
    const addr = apiStatus?.broadcastPinnwand?.address?.trim().toLowerCase() ?? ''
    if (!addr || !/^0x[a-f0-9]{64}$/.test(addr)) return
    setRecipient(addr)
  }, [channelMode, apiStatus?.broadcastPinnwand?.address, setRecipient])

  useEffect(() => {
    if (meshFirstTransportDefaultApplied.current || !apiStatus?.transportProfile) return
    meshFirstTransportDefaultApplied.current = true
    if (shouldApplyMeshFirstTransportDefault(apiStatus.transportProfile)) {
      onMeshFirstTransportDefault('mesh')
    }
  }, [apiStatus?.transportProfile, meshFirstTransportDefaultApplied, onMeshFirstTransportDefault])

  const {
    onExportEinsatzberichtJson,
    onExportEinsatzberichtTxt,
    onExportEinsatzberichtTxtFull,
    onExportEinsatzprotokoll,
    onExportEinsatzprotokollPlainZip,
    onExportEinsatzprotokollMarked,
    onExportEinsatzberichtEncrypted,
  } = useChatViewEinsatzExports({
    messagesLength: messages.length,
    messagesForExport,
    myAddress,
    protokollMarkedIds,
    setStatus,
    setStatusMsg,
    deviceTimeTrustWarn,
    apiStatus,
  })

  const selectInboxConversationAll = useCallback(() => {
    setInboxPartnerKey(null)
    setInboxConversationGroupId(null)
    setInboxPartnerFiltersArmed(false)
    setInboxOverviewCategory('alle')
  }, [
    setInboxPartnerKey,
    setInboxConversationGroupId,
    setInboxPartnerFiltersArmed,
    setInboxOverviewCategory,
  ])

  const selectInboxConversationPartner = useCallback(
    (address: string) => {
      const a = address.trim().toLowerCase()
      if (!a) return
      setInboxPartnerKey(a)
      setInboxConversationGroupId(null)
      setInboxPartnerFiltersArmed(true)
      setInboxChannelFiltersArmed(false)
      setInboxSourceFilter('all')
    },
    [
      setInboxPartnerKey,
      setInboxConversationGroupId,
      setInboxPartnerFiltersArmed,
      setInboxChannelFiltersArmed,
      setInboxSourceFilter,
    ]
  )

  const selectInboxConversationGroup = useCallback(
    (groupId: string) => {
      const id = groupId.trim()
      if (!id) return
      writeActiveGroupId(id)
      setInboxPartnerKey(null)
      setInboxConversationGroupId(id)
      setInboxPartnerFiltersArmed(true)
      setInboxOverviewCategory('direkt')
    },
    [setInboxPartnerKey, setInboxConversationGroupId, setInboxPartnerFiltersArmed, setInboxOverviewCategory]
  )

  const selectInboxPartnerForSend = useCallback(
    (address: string) => {
      selectInboxConversationPartner(address)
    },
    [selectInboxConversationPartner]
  )

  const slideSequences = useMemo(
    () => extractCompletedSlideSequences(filteredDisplayMessages),
    [filteredDisplayMessages]
  )

  const inboxRows = useMemo(
    (): ChatInboxRow[] => buildChatInboxRows(filteredDisplayMessages, slideSequences),
    [filteredDisplayMessages, slideSequences]
  )

  const pinnwandSlideSequences = useMemo(
    () => extractCompletedSlideSequences(pinnwandFeedMessages),
    [pinnwandFeedMessages]
  )

  const pinnwandInboxRows = useMemo(
    (): ChatInboxRow[] => buildChatInboxRows(pinnwandFeedMessages, pinnwandSlideSequences),
    [pinnwandFeedMessages, pinnwandSlideSequences]
  )

  const {
    refreshPackageIdSuggestions,
    applyPackageIdBackend,
    applyInboxPackageFilterOnly,
  } = useChatViewPackageIdCommands({
    showSetup,
    loadPackageSuggestions: true,
    inboxPackageFilter,
    setInboxPackageFilter,
    setPackageIdSuggestions,
    setPackageIdBusy,
    loadMessages,
    refreshApiStatus,
    setStatus,
    setStatusMsg,
  })

  const inboxUnionPackageKey = (apiStatus?.inboxUnionPackageIds ?? []).join('|')
  useEffect(() => {
    if (!inboxUnionPackageKey) return
    void refreshPackageIdSuggestions(apiStatus?.inboxUnionPackageIds)
  }, [inboxUnionPackageKey, apiStatus?.inboxUnionPackageIds, refreshPackageIdSuggestions])

  const syncCanonicalPackageIdFromServer = useCallback(() => {
    const raw = apiStatus?.packageId?.trim() ?? ''
    void applyPackageIdBackend(raw)
  }, [apiStatus?.packageId, applyPackageIdBackend])

  return {
    directory,
    refreshContactDirectory,
    isMeshVerifiedForAddress,
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
    appendMeshMessageWithInboundCapture,
    clearInboxRam,
    clearMeshInboundText,
    drainMeshInboundText,
    onDelayMirrorPlaintext,
    mirrorQueuePending,
    offlineMailboxQueuePending,
    offlineMailboxQueueUntrustedTimeCount,
    offlineMailboxQueueBackoffCount,
    offlineMailboxQueueErrorHint,
    offlineMailboxQueueItems,
    removeOfflineMailboxQueueItems,
    refreshOfflineMailboxQueueCount,
    apiStatus,
    refreshApiStatus,
    basisUnreachable,
    packageIdMismatch,
    deviceTimeTrustWarn,
    statusCacheAgeMinutes,
    statusPollAttempted,
    inboxPackageFilter,
    setInboxPackageFilter,
    packageIdSuggestions,
    refreshPackageIdSuggestions,
    applyPackageIdBackend,
    applyInboxPackageFilterOnly,
    packageIdBusy,
    syncCanonicalPackageIdFromServer,
    displayMessages,
    filteredDisplayMessages,
    pinnwandFeedMessages,
    slideSequences,
    inboxRows,
    pinnwandInboxRows,
    protokollMarkedIds,
    inboxSelectMode,
    setInboxSelectMode,
    selectedInboxIds,
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
    isPinnwandInboxMessage,
    toggleProtokollMark,
    onHideInboxMessageLocal,
    onPurgeInboxMessageChain,
    toggleInboxSelection,
    selectAllVisibleInbox,
    clearInboxSelection,
    onHideAllVisibleLocal,
    hiddenInboxCount,
    onBulkHideSelected,
    onBulkPurgeSelected,
    removeInboxPartnerFromQuickList,
    resetInboxViewFilters,
    inboxVisibilityHint,
    pinnedPinnwandIds,
    togglePinnedPinnwand,
    inboxOverviewChipsVisible,
    inboxOverviewCategory,
    setInboxOverviewCategory,
    inboxOverviewUnreadCounts,
    selectInboxPartnerForSend,
    selectInboxConversationAll,
    selectInboxConversationPartner,
    selectInboxConversationGroup,
    onExportEinsatzberichtJson,
    onExportEinsatzberichtTxt,
    onExportEinsatzberichtTxtFull,
    onExportEinsatzprotokoll,
    onExportEinsatzprotokollPlainZip,
    onExportEinsatzprotokollMarked,
    onExportEinsatzberichtEncrypted,
  }
}

export type ChatViewInboxOrchestration = ReturnType<typeof useChatViewInboxOrchestration>
