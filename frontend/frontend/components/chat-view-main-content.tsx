'use client'

/**
 * Reine Zusammenstellung der Chat-Unterkomponenten; gesamte Logik liegt in `useChatViewCore`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { isCapacitorNativePlatform } from '@/frontend/lib/capacitor-platform'
import {
  ChatViewMobileBottomNav,
  type ChatViewMobileTab,
} from '@/frontend/components/chat-view-mobile-bottom-nav'
import { ChatViewSendPathCompact } from '@/frontend/components/chat-view-send-path-compact'
import { ChatViewInboxPanel, type ChatViewInboxPanelProps } from '@/frontend/components/chat-view-inbox-panel'
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
import { ChatViewGroupSettingsSheet } from '@/frontend/components/chat-view-group-settings-sheet'
import { ChatViewEncryptedPartnerPanel } from '@/frontend/components/chat-view-encrypted-partner-panel'
import { useChatViewEncryptedPartnerPanelProps } from '@/frontend/hooks/use-chat-view-encrypted-partner-panel-props'
import { useChatViewTransportCardProps } from '@/frontend/hooks/use-chat-view-transport-card-props'
import { ChatViewPhonebookSheet } from '@/frontend/components/chat-view-phonebook-sheet'
import { ContactAddAliasDialog } from '@/frontend/components/contact-add-alias-dialog'
import { isPinnwandChannel } from '@/frontend/lib/messenger-chat-channel'
import { ChatViewNotesTabPanel } from '@/frontend/components/chat-view-notes-tab-panel'
import { ChatViewContactSidebar } from '@/frontend/components/chat-view-contact-sidebar'
import { ChatViewContactDetailDialog } from '@/frontend/components/chat-view-contact-detail-dialog'
import { ChatViewMessengerSearch } from '@/frontend/components/chat-view-messenger-search'
import { resolveContactSidebarDisplayName } from '@/frontend/lib/conversation-sidebar-items'
import { readMessengerGroups } from '@/frontend/lib/messenger-group-store'
import { fetchTelegramIntegration } from '@/frontend/lib/api/telegram-integrations'
import { resolveTelegramAlarmGroupPartnerKey } from '@/frontend/lib/telegram-einsatz-group-target'
import {
  patchTelegramAlarmGroupMembershipChatId,
  readTelegramAlarmGroupMembership,
  TELEGRAM_ALARM_INBOX_PARTNER_KEY,
} from '@/frontend/lib/telegram-alarm-group-prefs'
import { ChatViewTelegramAlarmThreadBanner } from '@/frontend/components/chat-view-telegram-alarm-thread-banner'
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
import { consumeDashboardSosPending } from '@/frontend/lib/dashboard-sos-pending'
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
import { resolveChatHeaderContext } from '@/frontend/lib/resolve-chat-header-context'
import { pinnwandSidebarLabel } from '@/frontend/lib/pinnwand-display'
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
    message,
    setMessage,
    recipient,
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
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false)
  const [contactDetailAddress, setContactDetailAddress] = useState<string | null>(null)
  const [contactDetailOpen, setContactDetailOpen] = useState(false)
  const [telegramAlarmSelected, setTelegramAlarmSelected] = useState(false)
  const [messengerSearchQuery, setMessengerSearchQuery] = useState('')
  const isNativeMobile = isCapacitorNativePlatform()
  const [mobileTab, setMobileTab] = useState<ChatViewMobileTab>('chats')
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
      if (channelMode === 'pinnwand' && onChannelModeChange) onChannelModeChange('private')
      setTelegramAlarmSelected(false)
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
      channelMode,
      onChannelModeChange,
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
  const showConversationSidebar = !onNotesTab && (isPrivate || isGroup || onPinnwandTab)
  const useNativeMessengerTabs =
    isNativeMobile && showConversationSidebar && !onNotesTab && !onPinnwandTab

  const inChatThread = Boolean(
    inboxConversationGroupId ||
      telegramAlarmSelected ||
      (inboxPartnerFiltersArmed && inboxPartnerKey?.trim())
  )

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
    myDataPanelProps,
  } = useChatViewShellProps({
    messengerPorts: panelMessengerPorts,
    vaultBannerActions,
    offlineStatus,
    showAdhocTransport: uiCaps.showAdhocTransport,
    showPackageIdBanner: uiCaps.showPackageIdBanner,
    onOpenSettings,
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

  const dashboardSosHandledRef = useRef(false)
  useEffect(() => {
    if (dashboardSosHandledRef.current) return
    const pending = consumeDashboardSosPending()
    if (!pending) return
    dashboardSosHandledRef.current = true
    setMessage(pending)
    void panelMessengerPorts.sendActions.onSend({
      emergencyWire: 'text',
      composerOverride: pending,
    })
  }, [panelMessengerPorts.sendActions, setMessage])

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
    onOpenPhonebook:
      (isPrivate || isGroup) && !showConversationSidebar ? () => setPhonebookOpen(true) : undefined,
    activeConversation:
      showConversationSidebar && (isPrivate || isGroup)
        ? {
            inboxPartnerKey: isPrivate ? inboxPartnerKey : null,
            inboxConversationGroupId: isGroup ? inboxConversationGroupId : null,
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
      setTelegramAlarmSelected(false)
      if ((channelMode === 'group' || channelMode === 'pinnwand') && onChannelModeChange) {
        onChannelModeChange('private')
      }
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
      setTelegramAlarmSelected(false)
      if (onChannelModeChange) onChannelModeChange('group')
      selectInboxConversationGroup(groupId)
      refreshMessengerGroups()
    },
    [onChannelModeChange, selectInboxConversationGroup, refreshMessengerGroups]
  )

  const handleSelectSidebarTelegramAlarm = useCallback(async () => {
    if (onChannelModeChange) onChannelModeChange('private')
    setTelegramAlarmSelected(true)
    const res = await fetchTelegramIntegration()
    const integration = res.ok ? res : null
    if (integration?.einsatzGroupChatId?.trim()) {
      patchTelegramAlarmGroupMembershipChatId(integration.einsatzGroupChatId)
    }
    const partnerKey = resolveTelegramAlarmGroupPartnerKey(integration)
    if (partnerKey) {
      selectInboxConversationPartner(partnerKey)
      setComposerDelivery('telegram')
      setRecipient(partnerKey)
      setPartner(partnerKey)
      toast.message('Telegram-Alarmgruppe — Thread und Composer aktiv.')
      return
    }
    selectInboxConversationPartner(TELEGRAM_ALARM_INBOX_PARTNER_KEY)
    setComposerDelivery('telegram')
    toast.message(
      'Telegram-Alarmgruppe gewählt — Chat-ID fehlt noch beim Boss; Senden an „Alle“ erst nach Konfiguration.'
    )
  }, [
    onChannelModeChange,
    selectInboxConversationPartner,
    selectInboxConversationAll,
    setComposerDelivery,
    setRecipient,
    setPartner,
  ])

  const handleSelectSidebarSelf = useCallback(() => {
    setTelegramAlarmSelected(false)
    const a = myAddress.trim().toLowerCase()
    if (!/^0x[a-f0-9]{64}$/.test(a)) {
      toast.message('Keine eigene Wallet-Adresse — zuerst Tresor/Identität prüfen.')
      return
    }
    if (channelMode === 'group' || channelMode === 'pinnwand') {
      if (onChannelModeChange) onChannelModeChange('private')
    }
    selectInboxConversationPartner(a)
    setPartner(a)
    setRecipient(a)
  }, [
    myAddress,
    channelMode,
    onChannelModeChange,
    selectInboxConversationPartner,
    setPartner,
    setRecipient,
  ])

  const handleSelectSidebarPinnwand = useCallback(() => {
    setTelegramAlarmSelected(false)
    if (onChannelModeChange) onChannelModeChange('pinnwand')
    setComposerDelivery('chain')
    setForcedTransport('internet')
  }, [onChannelModeChange, setComposerDelivery, setForcedTransport])

  const handleSelectSidebarAll = useCallback(() => {
    setTelegramAlarmSelected(false)
    if (channelMode === 'pinnwand' && onChannelModeChange) onChannelModeChange('private')
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
      toast.success(
        `${contacts.length} IOTA-Adressen eingetragen — Verschlüsselt/Klartext im Composer wählen, Senden pro Empfänger.`
      )
    } else if (activeSendPath === 'mesh') {
      toast.success(`${contacts.length} Funk-Kontakte — Broadcast ohne Ziel-Node.`)
    } else {
      toast.success(`${contacts.length} Ad-hoc-Kontakte vorbereitet.`)
    }
  }, [
    selectInboxConversationAll,
    channelMode,
    onChannelModeChange,
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
      toast.success(
        `Session-Schlüssel erneuert (Epoch ${result.newEpoch}) — Handshake gesendet; Partner sollte antworten.`
      )
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

  const activeSelfSelected = useMemo(() => {
    const me = myAddress.trim().toLowerCase()
    if (!/^0x[a-f0-9]{64}$/.test(me)) return false
    return (
      inboxPartnerFiltersArmed &&
      !inboxConversationGroupId &&
      inboxPartnerKey?.trim().toLowerCase() === me
    )
  }, [myAddress, inboxPartnerKey, inboxPartnerFiltersArmed, inboxConversationGroupId])

  const activeConversationTitle = useMemo(() => {
    if (telegramAlarmSelected) {
      return readTelegramAlarmGroupMembership()?.label?.trim() || 'Einsatz-Alarmgruppe'
    }
    if (activeSelfSelected) return 'Ich'
    if (inboxConversationGroupId) {
      return readMessengerGroups().find((g) => g.id === inboxConversationGroupId)?.name ?? 'Gruppe'
    }
    if (inboxPartnerKey) {
      return resolveContactSidebarDisplayName(directory, inboxPartnerKey)
    }
    return null
  }, [telegramAlarmSelected, activeSelfSelected, inboxConversationGroupId, inboxPartnerKey, directory])

  const activeConversationSubtitle = useMemo(() => {
    if (telegramAlarmSelected) {
      return 'Telegram · Hinweiskanal (kein Morgendrot-Gruppenchat)'
    }
    if (activeSelfSelected) {
      return 'Nachrichten an mich selbst'
    }
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
    telegramAlarmSelected,
    activeSelfSelected,
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
    !telegramAlarmSelected &&
    !onPinnwandTab &&
    (!inboxPartnerFiltersArmed || (!inboxPartnerKey && !inboxConversationGroupId))

  const chatHeaderContext = useMemo(
    () =>
      resolveChatHeaderContext({
        channelMode: channelMode ?? 'private',
        role,
        apiStatus,
        activeConversationTitle,
        activeConversationSubtitle,
        showAllConversationsActive,
        inboxConversationGroupId,
      }),
    [
      channelMode,
      role,
      apiStatus,
      activeConversationTitle,
      activeConversationSubtitle,
      showAllConversationsActive,
      inboxConversationGroupId,
    ]
  )

  const mergedChatHeaderProps = useMemo(
    () => ({
      ...chatHeaderProps,
      conversationTitle: chatHeaderContext.title,
      conversationSubtitle: chatHeaderContext.subtitle,
    }),
    [chatHeaderProps, chatHeaderContext]
  )

  const pinnwandSidebarProps = useMemo(
    () =>
      pinnwandCaps.showChannelTab
        ? {
            pinnwandLabel: pinnwandSidebarLabel(role, apiStatus),
            pinnwandUnreadCount: inboxOverviewUnreadCounts?.lagebild ?? 0,
            activePinnwandSelected: onPinnwandTab,
            onSelectPinnwand: handleSelectSidebarPinnwand,
          }
        : {},
    [
      pinnwandCaps.showChannelTab,
      role,
      apiStatus,
      inboxOverviewUnreadCounts?.lagebild,
      onPinnwandTab,
      handleSelectSidebarPinnwand,
    ]
  )

  const activeTelegramAlarmSelected = telegramAlarmSelected

  const telegramAlarmPartnerKeyReady = useMemo(() => {
    if (!telegramAlarmSelected) return false
    const key = inboxPartnerKey?.trim().toLowerCase()
    return Boolean(key?.startsWith('tg:'))
  }, [telegramAlarmSelected, inboxPartnerKey])

  const openGroupSettings = useCallback(() => setGroupSettingsOpen(true), [])

  const groupSettingsSheetProps = useMemo(
    () => ({
      contactDirectory: groupPanelDirectory,
      forcedTransport,
      teamMailboxCreateAllowed: canCreateTeamMailbox(connectionStatusRead.apiStatus),
      groupCreateAllowed: canCreateGroupCapability(connectionStatusRead.apiStatus),
      onGroupsChanged: refreshMessengerGroups,
      onOpenPhonebook: () => setPhonebookOpen(true),
      onOpenSettings,
      encrypted,
      onEncryptedChange: setEncrypted,
    }),
    [
      groupPanelDirectory,
      forcedTransport,
      connectionStatusRead.apiStatus,
      refreshMessengerGroups,
      onOpenSettings,
      encrypted,
      setEncrypted,
    ]
  )

  const conversationMenuProps = useMemo((): ChatViewInboxPanelProps['conversationMenu'] => {
    if (!showConversationSidebar) return undefined

    if (onPinnwandTab) {
      return {
        title: pinnwandSidebarLabel(role, apiStatus),
        subtitle: pinnwandCaps.canPost ? 'Team-Brett · posten erlaubt' : 'Team-Brett · nur Lesen',
        canClearHistory: false,
        canExport: true,
        onExportHistory: () => panelMessengerPorts.inboxExportActions.onExportEinsatzberichtTxt(),
      }
    }

    if (isGroup) {
      if (inboxConversationGroupId && activeConversationTitle) {
        return {
          title: activeConversationTitle,
          subtitle: activeConversationSubtitle,
          canClearHistory: true,
          canExport: true,
          onManageGroup: openGroupSettings,
          onCreateGroup: openGroupSettings,
          encryptionToggle: {
            encrypted,
            onEncryptedChange: setEncrypted,
            forcedTransport,
          },
          onExportHistory: () => panelMessengerPorts.inboxExportActions.onExportEinsatzberichtTxt(),
          onClearHistory: () => panelMessengerPorts.inboxActions.onHideAllVisibleLocal(),
        }
      }
      return {
        title: 'Gruppenchat',
        subtitle: 'Gruppe wählen oder anlegen',
        canClearHistory: false,
        canExport: false,
        onManageGroup: openGroupSettings,
        onCreateGroup: openGroupSettings,
        encryptionToggle: {
          encrypted,
          onEncryptedChange: setEncrypted,
          forcedTransport,
        },
      }
    }

    if (telegramAlarmSelected) {
      return {
        title: activeConversationTitle ?? 'Einsatz-Alarmgruppe',
        subtitle: activeConversationSubtitle,
        canClearHistory: false,
        canExport: true,
        onExportHistory: () => panelMessengerPorts.inboxExportActions.onExportEinsatzberichtTxt(),
      }
    }

    if (inboxPartnerFiltersArmed && (activeConversationTitle || telegramAlarmSelected)) {
      return {
        title: activeConversationTitle ?? 'Einsatz-Alarmgruppe',
        subtitle: activeConversationSubtitle,
        canClearHistory: !telegramAlarmSelected,
        canExport: true,
        onViewProfile:
          inboxPartnerKey && !telegramAlarmSelected ? () => handleOpenContactDetail(inboxPartnerKey) : undefined,
        onExportHistory: () => panelMessengerPorts.inboxExportActions.onExportEinsatzberichtTxt(),
        onClearHistory: () => panelMessengerPorts.inboxActions.onHideAllVisibleLocal(),
        onRenewEncryptionKeys:
          inboxPartnerKey && isValidRecipient0x(inboxPartnerKey) ? handleRenewPeerEncryption : undefined,
        encryptionToggle: {
          encrypted,
          onEncryptedChange: setEncrypted,
          forcedTransport,
        },
      }
    }

    if (isPrivate && composerDelivery === 'chain') {
      return {
        title: 'Direktchat',
        subtitle: 'Kontakt wählen oder Telefonbuch',
        canClearHistory: false,
        canExport: false,
        encryptionToggle: {
          encrypted,
          onEncryptedChange: setEncrypted,
          forcedTransport,
        },
      }
    }

    return undefined
  }, [
    showConversationSidebar,
    onPinnwandTab,
    role,
    apiStatus,
    pinnwandCaps.canPost,
    isGroup,
    telegramAlarmSelected,
    inboxConversationGroupId,
    activeConversationTitle,
    activeConversationSubtitle,
    openGroupSettings,
    encrypted,
    setEncrypted,
    forcedTransport,
    inboxPartnerFiltersArmed,
    inboxPartnerKey,
    handleOpenContactDetail,
    handleRenewPeerEncryption,
    composerDelivery,
    panelMessengerPorts.inboxExportActions,
    panelMessengerPorts.inboxActions,
  ])

  const composerBlock = (
    <section id="chat-composer-anchor" className="space-y-3 border-t border-border pt-4" aria-label="Nachricht verfassen">
      <ChatViewSendPanel {...sendPanelProps} />
    </section>
  )

  const sendPathProps = chatHeaderProps.sendPath

  const nativeHeaderProps = useMemo(
    () => ({
      ...mergedChatHeaderProps,
      compactNative: true,
      sendPath: sendPathProps ? { ...sendPathProps, visible: false } : null,
    }),
    [mergedChatHeaderProps, sendPathProps]
  )

  const showNativeComposerFooter = useNativeMessengerTabs

  const nativeComposerFooter = showNativeComposerFooter ? (
    <div className="sticky bottom-[3.5rem] z-20 -mx-1 space-y-2 border-t border-border bg-background/98 px-1 pt-2 backdrop-blur-sm">
      {sendPathProps?.visible ? <ChatViewSendPathCompact {...sendPathProps} layout="grid" /> : null}
      {composerBlock}
    </div>
  ) : null

  const handleMobileBackToChatList = useCallback(() => {
    selectInboxConversationAll()
  }, [selectInboxConversationAll])

  const handleMobileSelectContact = useCallback(
    (address: string) => {
      handleSelectSidebarContact(address)
      setMobileTab('chats')
    },
    [handleSelectSidebarContact]
  )

  const handleMobileSelectGroup = useCallback(
    (groupId: string) => {
      handleSelectSidebarGroup(groupId)
      setMobileTab('chats')
    },
    [handleSelectSidebarGroup]
  )

  const mobileInboxUnreadBadge = inboxOverviewUnreadCounts?.alle ?? 0

  const sharedContactSidebar = (
    <ChatViewContactSidebar
      directory={directory}
      partnerOptions={inboxPartnerOptions}
      activePartnerKey={inboxPartnerKey}
      activeGroupId={inboxConversationGroupId}
      activeTelegramAlarmSelected={activeTelegramAlarmSelected}
      showAllActive={showAllConversationsActive}
      searchQuery={messengerSearchQuery}
      activeSendPath={activeSendPath}
      onSelectAll={handleSelectSidebarAll}
      onSelectSelf={handleSelectSidebarSelf}
      activeSelfSelected={activeSelfSelected}
      onSelectContact={handleMobileSelectContact}
      onSelectGroup={handleMobileSelectGroup}
      onSelectTelegramAlarmGroup={() => {
        void handleSelectSidebarTelegramAlarm()
        setMobileTab('chats')
      }}
      onOpenGroupSettings={openGroupSettings}
      onOpenContactDetail={handleOpenContactDetail}
      onOpenPhonebook={() => setPhonebookOpen(true)}
      selfProfile={myDataPanelProps}
      {...pinnwandSidebarProps}
      {...sidebarHandshakeProps}
    />
  )

  const conversationBody = (
    <>
      {!onNotesTab && isGroup && !showConversationSidebar ? (
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

      {!onNotesTab && isGroup && !showConversationSidebar && encryptedPartnerPanelProps ? (
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

      {isPrivate && uiCaps.showPackageIdBanner && !useNativeMessengerTabs ? (
        <ChatViewPackageIdBanner {...packageIdBannerProps} />
      ) : null}

      {!showConversationSidebar && channelMode === 'private' && composerDelivery === 'chain' && !useNativeMessengerTabs ? (
        <ChatViewTransportCard {...transportCardProps} />
      ) : null}

      {showPartnerSetupPanel ? <ChatViewSetupPanel {...setupPanelProps} /> : null}

      {contactAliasDialog.open ? <ContactAddAliasDialog {...contactAliasDialog} /> : null}

      {showConversationSidebar && !useNativeMessengerTabs ? (
        <ChatViewContactSidebar
          className="lg:hidden"
          directory={directory}
          partnerOptions={inboxPartnerOptions}
          activePartnerKey={inboxPartnerKey}
          activeGroupId={inboxConversationGroupId}
          activeTelegramAlarmSelected={activeTelegramAlarmSelected}
          showAllActive={showAllConversationsActive}
          searchQuery={messengerSearchQuery}
          activeSendPath={activeSendPath}
          onSelectAll={handleSelectSidebarAll}
          onSelectSelf={handleSelectSidebarSelf}
          activeSelfSelected={activeSelfSelected}
          onSelectContact={handleSelectSidebarContact}
          onSelectGroup={handleSelectSidebarGroup}
          onSelectTelegramAlarmGroup={handleSelectSidebarTelegramAlarm}
          onOpenGroupSettings={openGroupSettings}
          onOpenContactDetail={handleOpenContactDetail}
          onOpenPhonebook={() => setPhonebookOpen(true)}
          selfProfile={myDataPanelProps}
          {...pinnwandSidebarProps}
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
          {composerBlock}
        </>
      ) : useNativeMessengerTabs ? null : (
        <>
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

          {telegramAlarmSelected ? (
            <ChatViewTelegramAlarmThreadBanner partnerKeyReady={telegramAlarmPartnerKeyReady} />
          ) : null}

          <ChatViewInboxPanel
            {...inboxPanelProps}
            hidePartnerStrip={showConversationSidebar}
            inboxSearchQuery={messengerSearchQuery}
            conversationMenu={conversationMenuProps}
          />

          {composerBlock}
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
      {useNativeMessengerTabs ? (
        <div className="pb-[calc(3.5rem+env(safe-area-inset-bottom,0px)+0.35rem)]">
          <div className="space-y-2">
            <ChatViewChatHeader {...nativeHeaderProps} />

            {uiCaps.showProminentOfflineQueueBanner ? (
              <ChatViewOfflineQueueStrip {...offlineQueueStripProps} />
            ) : null}

            {mobileTab === 'chats' && !inChatThread ? (
              <>
                <ChatViewMessengerSearch
                  directory={directory}
                  partnerOptions={inboxPartnerOptions}
                  messages={inboxMessages}
                  myAddress={myAddress}
                  query={messengerSearchQuery}
                  onQueryChange={setMessengerSearchQuery}
                  activeSendPath={activeSendPath}
                  onSelectContact={handleMobileSelectContact}
                  onSelectGroup={handleMobileSelectGroup}
                  onSelectTelegramAlarmGroup={() => {
                    void handleSelectSidebarTelegramAlarm()
                    setMobileTab('chats')
                  }}
                  onSelectMessageHit={(hit) => {
                    handleSelectMessageHit(hit)
                    setMobileTab('chats')
                  }}
                  {...sidebarHandshakeProps}
                />
                {sharedContactSidebar}
              </>
            ) : null}

            {mobileTab === 'chats' && inChatThread ? (
              <>
                <div className="flex items-center gap-2 border-b border-border/60 px-1 pb-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 shrink-0 px-2"
                    onClick={handleMobileBackToChatList}
                  >
                    <ChevronLeft className="mr-0.5 h-4 w-4" aria-hidden />
                    Chats
                  </Button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{activeConversationTitle ?? 'Chat'}</p>
                    {activeConversationSubtitle ? (
                      <p className="truncate text-[11px] text-muted-foreground">{activeConversationSubtitle}</p>
                    ) : null}
                  </div>
                </div>
                {telegramAlarmSelected ? (
                  <ChatViewTelegramAlarmThreadBanner partnerKeyReady={telegramAlarmPartnerKeyReady} />
                ) : null}
                <ChatViewInboxPanel
                  {...inboxPanelProps}
                  hidePartnerStrip
                  inboxSearchQuery={messengerSearchQuery}
                  conversationMenu={conversationMenuProps}
                />
                {nativeComposerFooter}
              </>
            ) : null}

            {mobileTab === 'inbox' ? (
              <>
                {inboxOverviewChipsVisible && (inboxPanelRead.inboxUnreadThreadOptions?.length ?? 0) > 0 ? (
                  <ChatViewInboxUnreadThreadsStrip
                    threads={[...(inboxPanelRead.inboxUnreadThreadOptions ?? [])]}
                    onOpenThread={(address) => {
                      setInboxOverviewCategory('direkt')
                      selectInboxPartnerForSend(address)
                    }}
                  />
                ) : null}
                {telegramAlarmSelected ? (
                  <ChatViewTelegramAlarmThreadBanner partnerKeyReady={telegramAlarmPartnerKeyReady} />
                ) : null}
                <ChatViewInboxPanel
                  {...inboxPanelProps}
                  hidePartnerStrip={false}
                  inboxSearchQuery={messengerSearchQuery}
                  conversationMenu={undefined}
                />
                {nativeComposerFooter}
              </>
            ) : null}

            {mobileTab === 'contacts' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 px-1">
                  <p className="text-sm font-semibold text-foreground">Kontakte</p>
                  <Button type="button" size="sm" variant="outline" onClick={() => setPhonebookOpen(true)}>
                    Telefonbuch
                  </Button>
                </div>
                {sharedContactSidebar}
              </div>
            ) : null}
          </div>
          <ChatViewMobileBottomNav
            active={mobileTab}
            onChange={setMobileTab}
            inboxUnreadCount={mobileInboxUnreadBadge}
          />
        </div>
      ) : (
      <div className={isNativeMobile ? 'space-y-3' : 'space-y-6'}>
        <ChatViewChatHeader
          {...(isNativeMobile ? nativeHeaderProps : mergedChatHeaderProps)}
        />

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
              onSelectTelegramAlarmGroup={handleSelectSidebarTelegramAlarm}
              onSelectMessageHit={handleSelectMessageHit}
              {...sidebarHandshakeProps}
            />
            <div className="grid gap-4 lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)] lg:items-start">
            <ChatViewContactSidebar
              className="hidden lg:flex"
              directory={directory}
              partnerOptions={inboxPartnerOptions}
              activePartnerKey={inboxPartnerKey}
              activeGroupId={inboxConversationGroupId}
              activeTelegramAlarmSelected={activeTelegramAlarmSelected}
              showAllActive={showAllConversationsActive}
              searchQuery={messengerSearchQuery}
              activeSendPath={activeSendPath}
              onSelectAll={handleSelectSidebarAll}
              onSelectSelf={handleSelectSidebarSelf}
              activeSelfSelected={activeSelfSelected}
              onSelectContact={handleSelectSidebarContact}
              onSelectGroup={handleSelectSidebarGroup}
              onSelectTelegramAlarmGroup={handleSelectSidebarTelegramAlarm}
              onOpenGroupSettings={openGroupSettings}
              onOpenContactDetail={handleOpenContactDetail}
              onOpenPhonebook={() => setPhonebookOpen(true)}
              selfProfile={myDataPanelProps}
              {...pinnwandSidebarProps}
              {...sidebarHandshakeProps}
            />
            <div className={isNativeMobile ? 'min-w-0 space-y-3' : 'min-w-0 space-y-8'}>{conversationBody}</div>
            </div>
          </div>
        ) : (
          <div className={isNativeMobile ? 'space-y-3' : 'space-y-8'}>{conversationBody}</div>
        )}
      </div>
      )}

      {contactDetailOpen ? (
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
      ) : null}

      {(isPrivate || isGroup || onPinnwandTab) && phonebookOpen ? (
        <ChatViewPhonebookSheet
          open={phonebookOpen}
          onOpenChange={setPhonebookOpen}
          directory={phonebookShellProps.directory}
          refreshContactDirectory={refreshContactDirectory}
          connectedAddresses={phonebookShellProps.connectedAddresses}
          onSelectContact={applyPhonebookContact}
          teamMailboxCreateAllowed={canCreateTeamMailbox(connectionStatusRead.apiStatus)}
          allowInitialProfileImport={canAccessEinsatzleitung(role)}
          apiStatus={connectionStatusRead.apiStatus ?? null}
          onOpenSettings={onOpenSettings}
          setStatusMsg={(msg) => {
            setStatus('success')
            setStatusMsg(msg)
            setTimeout(() => setStatus('idle'), 5000)
          }}
        />
      ) : null}

      {uiCaps.expertTools ? <LazyChatViewRelaySubmitButton hideMenuTrigger /> : null}

      {groupSettingsOpen ? (
      <ChatViewGroupSettingsSheet
        open={groupSettingsOpen}
        onOpenChange={setGroupSettingsOpen}
        {...groupSettingsSheetProps}
        encryptedPartnerPanel={encryptedPartnerPanelProps}
      />
      ) : null}

      {replyPathChoiceDialog.open ? (
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
      ) : null}
    </>
  )
}

