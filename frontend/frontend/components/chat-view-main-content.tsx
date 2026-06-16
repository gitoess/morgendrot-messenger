'use client'

/**
 * Reine Zusammenstellung der Chat-Unterkomponenten; gesamte Logik liegt in `useChatViewCore`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ChatViewInboxPanel } from '@/frontend/components/chat-view-inbox-panel'
import { useChatViewInboxPanelProps } from '@/frontend/hooks/use-chat-view-inbox-panel-props'
import { ChatViewPackageIdBanner } from '@/frontend/components/chat-view-package-id-banner'
import { ChatViewSendPanel } from '@/frontend/components/chat-view-send-panel'
import { ChatViewChatHeader, type ChatViewVaultBannerActions } from '@/frontend/components/chat-view-chat-header'
import { ChatViewOfflineQueueStrip } from '@/frontend/components/chat-view-offline-queue-strip'
import { ChatViewPinnwandFeedPanel } from '@/frontend/components/chat-view-pinnwand-feed-panel'
import { ChatViewPinnwandInboxStrip } from '@/frontend/components/chat-view-pinnwand-inbox-strip'
import { ChatViewInboxUnreadThreadsStrip } from '@/frontend/components/chat-view-inbox-unread-threads-strip'
import {
  canPostToPinnwand,
  getMessengerPinnwandCapabilities,
} from '@/frontend/lib/messenger-pinnwand-capabilities'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
import {
  ChatViewTransportCard,
} from '@/frontend/components/chat-view-transport-card'
import { ChatViewSetupPanel } from '@/frontend/components/chat-view-setup-panel'
import { ChatViewGroupPanel } from '@/frontend/components/chat-view-group-panel'
import { ChatViewEncryptedPartnerPanel } from '@/frontend/components/chat-view-encrypted-partner-panel'
import { useChatViewEncryptedPartnerPanelProps } from '@/frontend/hooks/use-chat-view-encrypted-partner-panel-props'
import { useChatViewTransportCardProps } from '@/frontend/hooks/use-chat-view-transport-card-props'
import { ChatViewPhonebookSheet } from '@/frontend/components/chat-view-phonebook-sheet'
import { ContactAddAliasDialog } from '@/frontend/components/contact-add-alias-dialog'
import { isGroupChannel, isPinnwandChannel } from '@/frontend/lib/messenger-chat-channel'
import { ChatViewNotesTabPanel } from '@/frontend/components/chat-view-notes-tab-panel'
import { ChatViewContactSidebar } from '@/frontend/components/chat-view-contact-sidebar'
import { ChatViewContactDetailDialog } from '@/frontend/components/chat-view-contact-detail-dialog'
import { ChatViewMessengerSearch } from '@/frontend/components/chat-view-messenger-search'
import { resolveContactSidebarDisplayName } from '@/frontend/lib/conversation-sidebar-items'
import { readMessengerGroups } from '@/frontend/lib/messenger-group-store'
import type { InboxSearchMessageHit } from '@/frontend/lib/inbox-unified-search'
import type { ChatViewCoreState } from '@/frontend/hooks/use-chat-view-core'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { applyPhonebookContactToComposer } from '@/frontend/lib/apply-phonebook-contact'
import { lookupContactEntry } from '@/frontend/lib/contact-display'
import {
  collectContactsForSendPath,
  formatAllRecipientsForSendPath,
  inboxPartnerKeyForContact,
} from '@/frontend/lib/contact-send-path'
import { resolveActiveSendPath } from '@/frontend/lib/messenger-channel-send-path'
import {
  contactHandshakeBadgeKind,
  contactHandshakeBadgeLabel,
  isContactHandshakeReady,
  resolveContactHandshakeStatus,
} from '@/frontend/lib/contact-handshake-ui'
import {
  canAccessEinsatzleitung,
  canCreateTeamMailbox,
  getMessengerUiCapabilities,
} from '@/frontend/lib/messenger-role-capabilities'
import { canCreateGroupCapability } from '@/frontend/lib/messenger-capability-gates'
import {
  LazyChatViewMorgPkgImportsSheet,
  LazyChatViewRelaySubmitButton,
} from '@/frontend/components/lazy/messenger-scope-b'
import { useMessengerClientExpertMode } from '@/frontend/hooks/use-messenger-client-expert-mode'
import { recordContactLastContacted, readContactFavorites, readHiddenContacts, toggleContactFavorite } from '@/frontend/lib/contact-phonebook-meta-store'
import { canFetchHandshakesViaDirectIota } from '@/frontend/lib/direct-iota-handshake-fetch'
import { hasCachedHandshakeOffers } from '@/frontend/lib/handshake-offers-cache'
import {
  PEER_KEY_RENEWAL_CONFIRM,
  renewDirectChatPeerEncryption,
} from '@/frontend/lib/peer-key-renewal'
import { isValidRecipient0x } from '@/frontend/lib/encrypted-recipient-handshake-status'
import type { PendingHandshakesPollState } from '@/frontend/hooks/use-chat-view-pending-handshakes'
import { useOfflineStatus } from '@/frontend/hooks/use-offline-status'
import { useChatViewSendPanelProps } from '@/frontend/hooks/use-chat-view-send-panel-props'
import { useChatViewSetupPanelProps } from '@/frontend/hooks/use-chat-view-setup-panel-props'
import { useChatViewPinnwandFeedPanelProps } from '@/frontend/hooks/use-chat-view-pinnwand-feed-panel-props'
import { buildComposeReplyTargets } from '@/frontend/hooks/build-compose-reply-targets'
import { useChatViewComposerBindings } from '@/frontend/hooks/use-chat-view-composer-bindings'
import { useChatViewPanelMessengerPorts } from '@/frontend/hooks/use-chat-view-panel-messenger-ports'
import { useChatViewShellProps } from '@/frontend/hooks/use-chat-view-shell-props'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export type ChatViewMainContentProps = ChatViewCoreState & {
  vaultBannerActions?: ChatViewVaultBannerActions
  onChannelModeChange?: (c: MessengerChatChannel) => void
  pendingHandshakes?: PendingHandshakesPollState
  onOpenEinsatzleitung?: () => void
  phonebookNavRequest?: number
  onOpenSettings?: () => void
}

export function ChatViewMainContent(c: ChatViewMainContentProps) {
  const {
    messengerPorts,
    vaultBannerActions,
    onChannelModeChange,
    pendingHandshakes,
    onOpenEinsatzleitung,
    phonebookNavRequest,
    onOpenSettings,
  } = c

  const {
    channelMode,
    isPrivate,
    isGroup,
    activeGroup,
    refreshMessengerGroups,
    role,
    myAddress,
    apiStatus,
    basisUnreachable,
    handshakeConnectedAddresses,
    directory,
    refreshContactDirectory,
    setMeshPlaintextNodeId,
    setMeshPlaintextToNodeEnabled,
    setMeshtasticChannelIndex,
    setMessage,
    setRecipient,
    partner,
    setPartner,
    encrypted,
    forcedTransport,
    setEncrypted,
    setForcedTransport,
    composerDelivery,
    setComposerDelivery,
    status,
    statusMsg,
    setStatus,
    setStatusMsg,
    selectInboxPartnerForSend,
    selectInboxConversationAll,
    selectInboxConversationPartner,
    selectInboxConversationGroup,
    inboxConversationGroupId,
    inboxPartnerKey,
    inboxPartnerFiltersArmed,
    inboxPartnerOptions,
    inboxOverviewChipsVisible,
    setInboxOverviewCategory,
    inboxOverviewUnreadCounts,
    composerSendPath,
    connectionStatusRead,
    contactDirectoryRead,
    inboxPanelRead,
    inboxPreviewRead,
    morgPkgArchive,
    meshSetup,
    inboxActions,
    packageExpert,
  } = useChatViewComposerBindings(messengerPorts)

  const { enabled: clientExpertMode } = useMessengerClientExpertMode()

  const [phonebookOpen, setPhonebookOpen] = useState(false)
  const [contactDetailAddress, setContactDetailAddress] = useState<string | null>(null)
  const [contactDetailOpen, setContactDetailOpen] = useState(false)
  const [sidebarMetaTick, setSidebarMetaTick] = useState(0)
  const [messengerSearchQuery, setMessengerSearchQuery] = useState('')
  useEffect(() => {
    if (phonebookOpen) refreshContactDirectory()
  }, [phonebookOpen, refreshContactDirectory])

  useEffect(() => {
    if (phonebookNavRequest != null && phonebookNavRequest > 0) setPhonebookOpen(true)
  }, [phonebookNavRequest])

  const pendingHandshakeRefreshKey = `${[...handshakeConnectedAddresses].join('|')}|${apiStatus?.locked === true ? 'locked' : 'open'}`

  const composeReply = useMemo(
    () =>
      buildComposeReplyTargets({
        onChannelModeChange,
        setForcedTransport,
        setComposerDelivery,
        setPartner,
        setRecipient,
        setEncrypted,
        onComposerMailboxObjectIdChange: composerSendPath.onComposerMailboxObjectIdChange,
        setMeshtasticChannelIndex,
        setMeshPlaintextNodeId,
        setMeshPlaintextToNodeEnabled,
        selectInboxPartnerForSend,
        setMessage,
        refreshMessengerGroups,
      }),
    [
      onChannelModeChange,
      setForcedTransport,
      setComposerDelivery,
      setPartner,
      setRecipient,
      setEncrypted,
      composerSendPath.onComposerMailboxObjectIdChange,
      setMeshtasticChannelIndex,
      setMeshPlaintextNodeId,
      setMeshPlaintextToNodeEnabled,
      selectInboxPartnerForSend,
      setMessage,
      refreshMessengerGroups,
    ]
  )

  const { panelMessengerPorts, contactAliasDialog, replyPathChoiceDialog } = useChatViewPanelMessengerPorts({
    messengerPorts,
    myAddress,
    activeGroup,
    apiStatus,
    contactDirectory: directory,
    pendingHandshakes: c.pendingHandshakes,
    pendingHandshakesPoll: {
      enabled:
        !c.pendingHandshakes &&
        /^0x[a-fA-F0-9]{64}$/i.test(myAddress.trim()) &&
        (basisUnreachable !== true || hasCachedHandshakeOffers() || canFetchHandshakesViaDirectIota()),
      connectedAddresses: handshakeConnectedAddresses,
      refreshToken: pendingHandshakeRefreshKey,
      vaultLocked: apiStatus?.locked === true,
      basisUnreachable: basisUnreachable === true,
    },
    onChannelModeChange,
    setStatus,
    setStatusMsg,
    refreshContactDirectory,
    composeReply,
  })

  const activeSendPath = useMemo(
    () => resolveActiveSendPath(composerDelivery, forcedTransport),
    [composerDelivery, forcedTransport]
  )

  const applyPhonebookContact = useCallback(
    (storageKey: string, entry: ContactMeshEntryClient) => {
      const handshakeStatus = resolveContactHandshakeStatus({
        address: storageKey,
        connectedAddresses: handshakeConnectedAddresses,
        incomingOffers: panelMessengerPorts.handshakeOffersRead.pendingOffers,
        outgoingOffers: panelMessengerPorts.handshakeOffersRead.outgoingOffers,
      })
      const applied = applyPhonebookContactToComposer(
        storageKey,
        entry,
        {
          setPartner,
          setRecipient,
          setMeshPlaintextNodeId,
          setMeshPlaintextToNodeEnabled,
          setContactBleUuid: meshSetup.onContactBleUuidChange,
          selectInboxPartnerForSend: selectInboxConversationPartner,
          setEncrypted,
        },
        { handshakeReady: isContactHandshakeReady(handshakeStatus), activeSendPath }
      )
      recordContactLastContacted(applied.storageKey)
      setPhonebookOpen(false)
      const parts: string[] = []
      if (applied.iotaAddress) parts.push('IOTA')
      if (applied.telegramChatId) parts.push('Telegram')
      if (applied.meshNodeId) parts.push('Meshtastic')
      if (applied.mailboxObjectId) parts.push('Mailbox')
      toast.success(
        `${applied.label}: ${parts.length ? parts.join(', ') : 'Kontakt'} übernommen — ${activeSendPath === 'telegram' ? 'Telegram' : activeSendPath === 'mesh' ? 'Funk' : activeSendPath === 'adhoc' ? 'Ad-hoc' : 'Online'}.`
      )
      requestAnimationFrame(() => {
        document.getElementById('chat-composer-message')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    },
    [
      setPartner,
      setRecipient,
      setMeshPlaintextNodeId,
      setMeshPlaintextToNodeEnabled,
      meshSetup.onContactBleUuidChange,
      selectInboxConversationPartner,
      handshakeConnectedAddresses,
      panelMessengerPorts.handshakeOffersRead.pendingOffers,
      panelMessengerPorts.handshakeOffersRead.outgoingOffers,
      setEncrypted,
      activeSendPath,
    ]
  )

  const uiCaps = useMemo(() => getMessengerUiCapabilities(apiStatus), [apiStatus])
  const pinnwandCaps = useMemo(
    () => getMessengerPinnwandCapabilities(apiStatus, role, channelMode, myAddress),
    [apiStatus, role, channelMode, myAddress]
  )
  const pinnwandPreviewMessages = inboxPreviewRead.pinnwandStripMessages
  const showInboxPackageExpert = uiCaps.showInboxPackageExpertMenu(clientExpertMode)
  /** Kanal-Tab „Pinnwand“ — eigener Feed, kein gemischter Posteingang. */
  const onPinnwandTab =
    channelMode != null && isPinnwandChannel(channelMode) && pinnwandCaps.configured
  const onNotesTab = channelMode === 'notes'
  const showConversationSidebar = !onNotesTab && !onPinnwandTab && (isPrivate || isGroup)

  useEffect(() => {
    if (!onChannelModeChange || channelMode == null) return
    if (channelMode === 'pinnwand' && !pinnwandCaps.showChannelTab) {
      onChannelModeChange('private')
    }
  }, [channelMode, pinnwandCaps.showChannelTab, onChannelModeChange])

  useEffect(() => {
    if (!showInboxPackageExpert) return
    void packageExpert.refreshPackageIdSuggestions()
  }, [showInboxPackageExpert, packageExpert.refreshPackageIdSuggestions])

  const offlineStatus = useOfflineStatus({
    apiSnapshot: apiStatus,
    backendReachable: basisUnreachable ? false : true,
  })

  /** Inbox-Cache ≠ offline: Composer-Status nicht mit Posteingang-Fallback verwechseln. */
  useEffect(() => {
    if (basisUnreachable === true) return
    if (status === 'error') {
      setStatus('idle')
      if (/Offline — (letzte Nachrichten|Basis nicht erreichbar)/.test(statusMsg)) {
        setStatusMsg('')
      }
    }
  }, [basisUnreachable, inboxActions.inboxFromCache, status, statusMsg, setStatus, setStatusMsg])

  useEffect(() => {
    if (!uiCaps.showAdhocTransport && forcedTransport === 'adhoc') {
      setForcedTransport('mesh')
      setEncrypted(false)
    }
  }, [uiCaps.showAdhocTransport, forcedTransport, setForcedTransport, setEncrypted])

  const applyPartnerAsSendRecipient = useCallback(() => {
    const a = partner.trim().toLowerCase()
    if (!/^0x[a-f0-9]{64}$/.test(a)) {
      toast.error('Gültige Empfänger-Wallet eingeben: 0x + 64 Hex.')
      return
    }
    setRecipient(a)
    selectInboxPartnerForSend(a)
    toast.success('Empfänger übernommen — Chat-Partner gesetzt.')
  }, [partner, setRecipient, selectInboxPartnerForSend])

  const {
    chatHeaderProps,
    offlineQueueStripProps,
    packageIdBannerProps,
    pinnwandInboxStripProps,
    phonebookShellProps,
    groupPanelDirectory,
  } = useChatViewShellProps({
    messengerPorts: panelMessengerPorts,
    vaultBannerActions,
    offlineStatus,
    showAdhocTransport: uiCaps.showAdhocTransport,
    showPackageIdBanner: uiCaps.showPackageIdBanner,
    peeringQr: {
      onPeeringImported: ({ address }) => {
        const a = address.trim().toLowerCase()
        setPartner(a)
        setRecipient(a)
        selectInboxConversationPartner(a)
        toast.success('Peering übernommen — Partner im Chat gesetzt.')
      },
      onPeeringStatus: (msg) => toast.message(msg),
    },
  })

  const inboxPanelProps = useChatViewInboxPanelProps({
    messengerPorts: panelMessengerPorts,
    showPinnwandPinActions: pinnwandCaps.configured && pinnwandCaps.canPost,
    onOpenPhonebook: () => setPhonebookOpen(true),
    showInboxIotaFilter: uiCaps.showInboxIotaFilter,
    showIotaExpertInboxActions: uiCaps.expertTools,
    pinnwandOverviewConfigured: pinnwandCaps.configured,
    showInboxPackageExpertMenu: showInboxPackageExpert,
    onOpenSettings,
    hidePartnerStrip: showConversationSidebar,
    hideOverviewChips:
      showConversationSidebar &&
      isPrivate &&
      inboxPartnerFiltersArmed &&
      Boolean(inboxPartnerKey?.trim()),
  })

  const { sendPanelProps } = useChatViewSendPanelProps({
    messengerPorts: panelMessengerPorts,
    activeGroup,
    expertTools: uiCaps.expertTools,
    pinnwandBroadcastAddress: pinnwandCaps.broadcastAddress,
    canPostToPinnwand: pinnwandCaps.canPost,
    vaultBannerActions,
    onOpenPhonebook: isPrivate || isGroup ? () => setPhonebookOpen(true) : undefined,
    activeConversation:
      showConversationSidebar && isPrivate
        ? {
            inboxPartnerKey,
            inboxPartnerFiltersArmed,
            directory,
          }
        : undefined,
  })

  const { encryptedPartnerPanelProps } = useChatViewEncryptedPartnerPanelProps({
    messengerPorts: panelMessengerPorts,
    activeGroupMemberAddresses: activeGroup?.memberAddresses,
    setStatusMsg,
  })

  const showPartnerSetupPanel =
    messengerPorts.composerSendPath.composerDelivery === 'chain' &&
    (messengerPorts.sendTransportRead.forcedTransport === 'mesh' ||
      messengerPorts.sendTransportRead.forcedTransport === 'adhoc') &&
    (messengerPorts.composerSendPath.channelMode === 'private' || messengerPorts.composerSendPath.isGroup)

  const transportCardProps = useChatViewTransportCardProps({
    messengerPorts: panelMessengerPorts,
    onOpenPartnerSetup: inboxActions.openPartnerSetupPanel,
    setStatus,
    setStatusMsg,
    encryptedPartnerPanelProps,
  })

  const setupPanelProps = useChatViewSetupPanelProps({ messengerPorts: panelMessengerPorts })

  const pinnwandFeedPanelProps = useChatViewPinnwandFeedPanelProps({
    messengerPorts: panelMessengerPorts,
    role,
    canPost: pinnwandCaps.canPost,
    unreadCount: inboxOverviewUnreadCounts?.lagebild ?? 0,
  })

  const handleSelectSidebarContact = useCallback(
    (address: string) => {
      if (channelMode === 'group' && onChannelModeChange) onChannelModeChange('private')
      const entry = lookupContactEntry(directory, address) ?? { label: address }
      const inboxKey = inboxPartnerKeyForContact(address, entry)
      selectInboxConversationPartner(inboxKey)
      const handshakeStatus = resolveContactHandshakeStatus({
        address: inboxKey,
        connectedAddresses: handshakeConnectedAddresses,
        incomingOffers: panelMessengerPorts.handshakeOffersRead.pendingOffers,
        outgoingOffers: panelMessengerPorts.handshakeOffersRead.outgoingOffers,
      })
      applyPhonebookContactToComposer(
        address,
        entry,
        {
          setPartner,
          setRecipient,
          setMeshPlaintextNodeId,
          setMeshPlaintextToNodeEnabled,
          setContactBleUuid: meshSetup.onContactBleUuidChange,
          selectInboxPartnerForSend: selectInboxConversationPartner,
          setEncrypted,
        },
        { handshakeReady: isContactHandshakeReady(handshakeStatus), activeSendPath }
      )
      recordContactLastContacted(address)
    },
    [
      channelMode,
      onChannelModeChange,
      selectInboxConversationPartner,
      directory,
      setPartner,
      setRecipient,
      setMeshPlaintextNodeId,
      setMeshPlaintextToNodeEnabled,
      meshSetup.onContactBleUuidChange,
      handshakeConnectedAddresses,
      panelMessengerPorts.handshakeOffersRead.pendingOffers,
      panelMessengerPorts.handshakeOffersRead.outgoingOffers,
      setEncrypted,
      activeSendPath,
    ]
  )

  const handleSelectSidebarGroup = useCallback(
    (groupId: string) => {
      if (onChannelModeChange) onChannelModeChange('group')
      selectInboxConversationGroup(groupId)
      refreshMessengerGroups()
    },
    [onChannelModeChange, selectInboxConversationGroup, refreshMessengerGroups]
  )

  const handleSelectSidebarAll = useCallback(() => {
    selectInboxConversationAll()
    const contacts = collectContactsForSendPath({
      directory,
      partnerOptions: inboxPartnerOptions,
      path: activeSendPath,
      hidden: readHiddenContacts(),
    })
    const formatted = formatAllRecipientsForSendPath(contacts, activeSendPath)
    setPartner(formatted.partner)
    setRecipient(formatted.recipient)
    setMeshPlaintextNodeId(formatted.meshPlaintextNodeId)
    setMeshPlaintextToNodeEnabled(formatted.meshPlaintextToNodeEnabled)
    if (contacts.length === 0) {
      toast.message('Keine Empfänger für diesen Sendepfad im Telefonbuch.')
      return
    }
    if (activeSendPath === 'telegram') {
      toast.success(`${contacts.length} Telegram-Empfänger eingetragen.`)
    } else if (activeSendPath === 'internet') {
      toast.success(`${contacts.length} IOTA-Adressen eingetragen — Senden erzeugt pro Empfänger eine PTB.`)
    } else if (activeSendPath === 'mesh') {
      toast.success(`${contacts.length} Funk-Kontakte — Broadcast ohne Ziel-Node.`)
    } else {
      toast.success(`${contacts.length} Ad-hoc-Kontakte vorbereitet.`)
    }
  }, [
    selectInboxConversationAll,
    directory,
    inboxPartnerOptions,
    activeSendPath,
    setPartner,
    setRecipient,
    setMeshPlaintextNodeId,
    setMeshPlaintextToNodeEnabled,
  ])

  const handleOpenContactDetail = useCallback((address: string) => {
    setContactDetailAddress(address)
    setContactDetailOpen(true)
  }, [])

  const handleRenewPeerEncryption = useCallback(async () => {
    if (!inboxPartnerKey || !isValidRecipient0x(inboxPartnerKey)) {
      toast.error('Schlüssel erneuern ist nur für IOTA-1:1-Chats verfügbar.')
      return
    }
    if (!window.confirm(PEER_KEY_RENEWAL_CONFIRM)) return
    setEncrypted(true)
    setForcedTransport('internet')
    setComposerDelivery('chain')
    const result = await renewDirectChatPeerEncryption(inboxPartnerKey, {
      onHandshake: (addr) => panelMessengerPorts.handshakeActions.onHandshakeForAddress(addr),
    })
    if (result.ok) {
      toast.success('Neuer Handshake gesendet — Partner muss antworten, dann wieder verschlüsselt senden.')
      window.setTimeout(() => void panelMessengerPorts.handshakeOffersRead.reload(), 3000)
    } else {
      toast.error(result.error)
    }
  }, [
    inboxPartnerKey,
    setEncrypted,
    setForcedTransport,
    setComposerDelivery,
    panelMessengerPorts.handshakeActions,
    panelMessengerPorts.handshakeOffersRead,
  ])

  const handleSelectMessageHit = useCallback(
    (hit: InboxSearchMessageHit) => {
      if (hit.counterpartyAddress) {
        handleSelectSidebarContact(hit.counterpartyAddress)
      }
      setMessengerSearchQuery(messengerSearchQuery.trim() || hit.snippet.slice(0, 40))
      requestAnimationFrame(() => {
        document.getElementById(`inbox-msg-${hit.messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    },
    [handleSelectSidebarContact, messengerSearchQuery]
  )

  const activeConversationTitle = useMemo(() => {
    if (inboxConversationGroupId) {
      return readMessengerGroups().find((g) => g.id === inboxConversationGroupId)?.name ?? 'Gruppe'
    }
    if (inboxPartnerKey) {
      return resolveContactSidebarDisplayName(directory, inboxPartnerKey)
    }
    return null
  }, [inboxConversationGroupId, inboxPartnerKey, directory])

  const activeConversationSubtitle = useMemo(() => {
    if (inboxConversationGroupId) {
      const count =
        readMessengerGroups().find((g) => g.id === inboxConversationGroupId)?.memberAddresses.length ?? 0
      return `${count} Mitglieder`
    }
    if (!inboxPartnerKey) return undefined
    const handshakeLabel = contactHandshakeBadgeLabel(
      contactHandshakeBadgeKind(
        resolveContactHandshakeStatus({
          address: inboxPartnerKey,
          connectedAddresses: handshakeConnectedAddresses,
          incomingOffers: panelMessengerPorts.handshakeOffersRead.pendingOffers,
          outgoingOffers: panelMessengerPorts.handshakeOffersRead.outgoingOffers,
        })
      )
    )
    return handshakeLabel ?? inboxPartnerKey
  }, [
    inboxConversationGroupId,
    inboxPartnerKey,
    handshakeConnectedAddresses,
    panelMessengerPorts.handshakeOffersRead.pendingOffers,
    panelMessengerPorts.handshakeOffersRead.outgoingOffers,
  ])

  const sidebarHandshakeProps = useMemo(
    () => ({
      connectedAddresses: handshakeConnectedAddresses,
      incomingHandshakeOffers: panelMessengerPorts.handshakeOffersRead.pendingOffers,
      outgoingHandshakeOffers: panelMessengerPorts.handshakeOffersRead.outgoingOffers,
    }),
    [
      handshakeConnectedAddresses,
      panelMessengerPorts.handshakeOffersRead.pendingOffers,
      panelMessengerPorts.handshakeOffersRead.outgoingOffers,
    ]
  )

  const inboxMessages = panelMessengerPorts.inboxFeedRead.messages

  const showAllConversationsActive =
    !inboxPartnerFiltersArmed || (!inboxPartnerKey && !inboxConversationGroupId)

  const conversationBody = (
    <>
      {!onNotesTab && isGroup ? (
        <ChatViewGroupPanel
          contactDirectory={groupPanelDirectory}
          forcedTransport={forcedTransport}
          teamMailboxCreateAllowed={canCreateTeamMailbox(connectionStatusRead.apiStatus)}
          groupCreateAllowed={canCreateGroupCapability(connectionStatusRead.apiStatus)}
          onGroupsChanged={refreshMessengerGroups}
          onOpenPhonebook={() => setPhonebookOpen(true)}
          onOpenSettings={onOpenSettings}
          encrypted={encrypted}
          onEncryptedChange={setEncrypted}
        />
      ) : null}

      {!onNotesTab && isGroup && encryptedPartnerPanelProps ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">Handshake — Gruppenmitglieder</p>
          <ChatViewEncryptedPartnerPanel {...encryptedPartnerPanelProps} />
        </div>
      ) : null}

      {!onNotesTab && pinnwandCaps.showInboxStrip ? (
        <ChatViewPinnwandInboxStrip
          messages={[...pinnwandPreviewMessages]}
          role={role}
          apiStatus={pinnwandInboxStripProps.apiStatus}
          contactDirectory={pinnwandInboxStripProps.contactDirectory}
          unreadCount={pinnwandInboxStripProps.unreadCount}
          onOpenFullPinnwand={
            onChannelModeChange ? () => onChannelModeChange('pinnwand') : undefined
          }
        />
      ) : null}

      {isPrivate && uiCaps.showPackageIdBanner ? (
        <ChatViewPackageIdBanner {...packageIdBannerProps} />
      ) : null}

      {!showConversationSidebar && channelMode === 'private' && composerDelivery === 'chain' ? (
        <ChatViewTransportCard {...transportCardProps} />
      ) : null}

      {showPartnerSetupPanel ? <ChatViewSetupPanel {...setupPanelProps} /> : null}

      <ContactAddAliasDialog {...contactAliasDialog} />

      {showConversationSidebar ? (
        <ChatViewContactSidebar
          key={`sidebar-mobile-${sidebarMetaTick}`}
          className="lg:hidden"
          directory={directory}
          partnerOptions={inboxPartnerOptions}
          activePartnerKey={inboxPartnerKey}
          activeGroupId={inboxConversationGroupId}
          showAllActive={showAllConversationsActive}
          searchQuery={messengerSearchQuery}
          activeSendPath={activeSendPath}
          onSelectAll={handleSelectSidebarAll}
          onSelectContact={handleSelectSidebarContact}
          onSelectGroup={handleSelectSidebarGroup}
          onOpenContactDetail={handleOpenContactDetail}
          onOpenPhonebook={() => setPhonebookOpen(true)}
          {...sidebarHandshakeProps}
        />
      ) : null}

      {onNotesTab ? (
        <ChatViewNotesTabPanel />
      ) : onPinnwandTab ? (
        <>
          <ChatViewPinnwandFeedPanel
            {...pinnwandFeedPanelProps}
            showPinnwandPinActions={pinnwandCaps.configured && pinnwandCaps.canPost}
          />
          <section className="space-y-3 border-t border-border pt-6" aria-labelledby="chat-compose-heading">
            <h2 id="chat-compose-heading" className="text-sm font-semibold tracking-tight text-foreground">
              An Pinnwand senden
            </h2>
            <ChatViewSendPanel {...sendPanelProps} />
          </section>
        </>
      ) : (
        <>
          <section className="space-y-3 border-t border-border pt-6" aria-labelledby="chat-compose-heading">
            <h2 id="chat-compose-heading" className="text-sm font-semibold tracking-tight text-foreground">
              Nachricht verfassen
            </h2>
            <ChatViewSendPanel {...sendPanelProps} />
          </section>

          {!showConversationSidebar &&
          inboxOverviewChipsVisible &&
          (inboxPanelRead.inboxUnreadThreadOptions?.length ?? 0) > 0 ? (
            <ChatViewInboxUnreadThreadsStrip
              threads={[...(inboxPanelRead.inboxUnreadThreadOptions ?? [])]}
              onOpenThread={(address) => {
                setInboxOverviewCategory('direkt')
                selectInboxPartnerForSend(address)
              }}
            />
          ) : null}

          <ChatViewInboxPanel
            {...inboxPanelProps}
            hidePartnerStrip={showConversationSidebar}
            inboxSearchQuery={messengerSearchQuery}
            conversationMenu={
              showConversationSidebar && inboxPartnerFiltersArmed && activeConversationTitle
                ? {
                    title: activeConversationTitle,
                    subtitle: activeConversationSubtitle,
                    canClearHistory: true,
                    canExport: true,
                    onViewProfile: inboxPartnerKey
                      ? () => handleOpenContactDetail(inboxPartnerKey)
                      : undefined,
                    onExportHistory: () => panelMessengerPorts.inboxExportActions.onExportEinsatzberichtTxt(),
                    onClearHistory: () => panelMessengerPorts.inboxActions.onHideAllVisibleLocal(),
                    onRenewEncryptionKeys:
                      inboxPartnerKey && isValidRecipient0x(inboxPartnerKey)
                        ? handleRenewPeerEncryption
                        : undefined,
                  }
                : undefined
            }
          />
        </>
      )}

      {morgPkgArchive.open ? (
        <LazyChatViewMorgPkgImportsSheet
          open={morgPkgArchive.open}
          onOpenChange={morgPkgArchive.setOpen}
          records={[...morgPkgArchive.records]}
          contactDirectory={contactDirectoryRead.directory}
          onRemove={morgPkgArchive.remove}
          onForwardItem={morgPkgArchive.onForwardItem}
        />
      ) : null}
    </>
  )

  return (
    <>
      <div className="space-y-6">
        <ChatViewChatHeader {...chatHeaderProps} />

        {uiCaps.showProminentOfflineQueueBanner ? (
          <ChatViewOfflineQueueStrip {...offlineQueueStripProps} />
        ) : null}

        {showConversationSidebar ? (
          <div className="space-y-3">
            <ChatViewMessengerSearch
              directory={directory}
              partnerOptions={inboxPartnerOptions}
              messages={inboxMessages}
              myAddress={myAddress}
              query={messengerSearchQuery}
              onQueryChange={setMessengerSearchQuery}
              activeSendPath={activeSendPath}
              onSelectContact={handleSelectSidebarContact}
              onSelectGroup={handleSelectSidebarGroup}
              onSelectMessageHit={handleSelectMessageHit}
              {...sidebarHandshakeProps}
            />
            <div className="grid gap-4 lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)] lg:items-start">
            <ChatViewContactSidebar
              key={`sidebar-desktop-${sidebarMetaTick}`}
              className="hidden lg:flex"
              directory={directory}
              partnerOptions={inboxPartnerOptions}
              activePartnerKey={inboxPartnerKey}
              activeGroupId={inboxConversationGroupId}
              showAllActive={showAllConversationsActive}
              searchQuery={messengerSearchQuery}
              onSelectAll={handleSelectSidebarAll}
              onSelectContact={handleSelectSidebarContact}
              onSelectGroup={handleSelectSidebarGroup}
              onOpenContactDetail={handleOpenContactDetail}
              onOpenPhonebook={() => setPhonebookOpen(true)}
              {...sidebarHandshakeProps}
            />
            <div className="min-w-0 space-y-8">{conversationBody}</div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">{conversationBody}</div>
        )}
      </div>

      <ChatViewContactDetailDialog
        open={contactDetailOpen}
        onOpenChange={setContactDetailOpen}
        address={contactDetailAddress}
        entry={contactDetailAddress ? lookupContactEntry(directory, contactDetailAddress) : undefined}
        directory={directory}
        messages={inboxMessages}
        myAddress={myAddress}
        connectedAddresses={phonebookShellProps.connectedAddresses}
        isFavorite={
          contactDetailAddress ? readContactFavorites().has(contactDetailAddress.trim().toLowerCase()) : false
        }
        onToggleFavorite={() => {
          if (!contactDetailAddress) return
          toggleContactFavorite(contactDetailAddress)
          setSidebarMetaTick((n) => n + 1)
        }}
        onEdit={() => setPhonebookOpen(true)}
        onShowQr={() => undefined}
        onRemove={() => setPhonebookOpen(true)}
        onSelectForMessenger={() => {
          if (!contactDetailAddress) return
          handleSelectSidebarContact(contactDetailAddress)
          setContactDetailOpen(false)
        }}
      />

      {(isPrivate || isGroup) ? (
        <ChatViewPhonebookSheet
          open={phonebookOpen}
          onOpenChange={setPhonebookOpen}
          directory={phonebookShellProps.directory}
          refreshContactDirectory={refreshContactDirectory}
          connectedAddresses={phonebookShellProps.connectedAddresses}
          onSelectContact={applyPhonebookContact}
          teamMailboxCreateAllowed={canCreateTeamMailbox(connectionStatusRead.apiStatus)}
          allowInitialProfileImport={canAccessEinsatzleitung(role)}
          onOpenSettings={onOpenSettings}
          setStatusMsg={(msg) => {
            setStatus('success')
            setStatusMsg(msg)
            setTimeout(() => setStatus('idle'), 5000)
          }}
        />
      ) : null}

      {uiCaps.expertTools ? <LazyChatViewRelaySubmitButton hideMenuTrigger /> : null}

      <Dialog open={replyPathChoiceDialog.open} onOpenChange={(open) => !open && replyPathChoiceDialog.onClose()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Antworten — Sendeweg wählen</DialogTitle>
            <DialogDescription>
              Diese Nachricht kam über mehrere Wege an. Welchen Pfad soll der Composer übernehmen?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-1">
            {replyPathChoiceDialog.variants.map((variant) => (
              <Button
                key={variant.id}
                type="button"
                variant="outline"
                className="h-auto justify-start px-3 py-2.5 text-left"
                onClick={() => replyPathChoiceDialog.onSelect(variant)}
              >
                <span className="font-semibold">{variant.label}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

