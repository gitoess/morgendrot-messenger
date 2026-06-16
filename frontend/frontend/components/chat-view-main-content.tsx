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
  buildPinnwandMatchContext,
  messageBelongsToPinnwand,
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
import type { ChatViewCoreState } from '@/frontend/hooks/use-chat-view-core'
import { saveContactEntry, type ContactMeshEntryClient } from '@/frontend/lib/api'
import { contactDisplayLabel } from '@/frontend/lib/contact-display'
import { applyPhonebookContactToComposer } from '@/frontend/lib/apply-phonebook-contact'
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
import { recordContactLastContacted } from '@/frontend/lib/contact-phonebook-meta-store'
import { addressMatchesIdentity } from '@/frontend/features/inbox/inbox-partner-filter'
import { resolveMeshtasticPlaintextDestination } from '@/frontend/lib/meshtastic-node-id'
import { canFetchHandshakesViaDirectIota } from '@/frontend/lib/direct-iota-handshake-fetch'
import { hasCachedHandshakeOffers } from '@/frontend/lib/handshake-offers-cache'
import {
  useChatViewPendingHandshakes,
  type PendingHandshakesPollState,
} from '@/frontend/hooks/use-chat-view-pending-handshakes'
import { useOfflineStatus } from '@/frontend/hooks/use-offline-status'
import { useChatViewSendPanelProps } from '@/frontend/hooks/use-chat-view-send-panel-props'
import { useChatViewShellProps } from '@/frontend/hooks/use-chat-view-shell-props'
import { asHandshakeOffersRead } from '@/frontend/features/messenger-ports'
import type { ChatViewMessengerPorts } from '@/frontend/features/messenger-ports'
import {
  tryPurgeHandshakeOfferOnChain,
  type HandshakeOfferSource,
} from '@/frontend/lib/handshake-offer-delete'
import {
  applyReplyContextVariant,
  resolveReplyContextFromInboxMessage,
  type ReplyContextVariant,
} from '@/frontend/lib/inbox-reply-context'
import type { Message } from '@/frontend/lib/types'
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
  channelMode?: MessengerChatChannel
  onChannelModeChange?: (c: MessengerChatChannel) => void
  pendingHandshakes?: PendingHandshakesPollState
  onOpenEinsatzleitung?: () => void
  phonebookNavRequest?: number
  onOpenSettings?: () => void
}

export function ChatViewMainContent(c: ChatViewMainContentProps) {
  const {
    isPrivate,
    isGroup,
    activeGroup,
    refreshMessengerGroups,
    role,
    myAddress,
    messengerPorts,
    sending,
    setSending,
    refreshApiStatus,
    syncCanonicalPackageIdFromServer,
    inboxPackageFilter,
    setInboxPackageFilter,
    packageIdSuggestions,
    refreshPackageIdSuggestions,
    applyPackageIdBackend,
    applyInboxPackageFilterOnly,
    packageIdBusy,
    composerMailboxObjectId,
    setComposerMailboxObjectId,
    morgPkgDeviceBusy,
    morgPkgFileRef,
    morgPkgDeviceFilesRef,
    refreshContactDirectory,
    inboxTotalCount,
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
    inboxRows,
    pinnwandFeedMessages,
    pinnwandInboxRows,
    meshtastic,
    meshSyncMsg,
    setMeshSyncMsg,
    localPurgeBusy,
    setLocalPurgeBusy,
    contactBleAddress,
    setContactBleAddress,
    contactBleUuid,
    setContactBleUuid,
    contactBleBusy,
    setContactBleBusy,
    exportEcdhMorgPkgForMessage,
    onMorgPkgDeviceFiles,
    onMorgPkgImportFile,
    onMorgPkgDeviceExportPick,
    morgPkgImports,
    morgPkgImportsOpen,
    setMorgPkgImportsOpen,
    removeMorgPkgImport,
    onForwardMorgPkgItem,
    morgPkgExportRecipient,
    setMorgPkgExportRecipient,
    morgPkgExportPartnerOptions,
    openPartnerSetupPanel,
    onExportEinsatzberichtJson,
    onExportEinsatzberichtTxt,
    onExportEinsatzberichtTxtFull,
    onExportEinsatzberichtEncrypted,
    onExportEinsatzprotokoll,
    onExportEinsatzprotokollPlainZip,
    onExportEinsatzprotokollMarked,
    onHideInboxMessageLocal,
    onPurgeInboxMessageChain,
    onForwardMessage,
    onHideAllVisibleLocal,
    onBulkHideSelected,
    onBulkPurgeSelected,
    resetInboxViewFilters,
    vaultBannerActions,
    channelMode,
    onChannelModeChange,
    pendingHandshakes,
    onOpenEinsatzleitung,
    phonebookNavRequest,
    onOpenSettings,
    inboxUnreadThreadOptions,
  } = c

  const {
    connectionStatusRead,
    contactDirectoryRead,
    inboxViewUi,
    meshSendOptions,
    composerDraft,
    composerPartner,
    composerSendPath,
    sendTransportRead,
    sendTransportChoice,
    sendMeshFunkOptions,
    sendActions,
  } = messengerPorts
  const {
    apiStatus,
    basisUnreachable,
    statusCacheAgeMinutes,
    deviceTimeTrustWarn,
    connectedAddresses: handshakeConnectedAddresses,
  } = connectionStatusRead
  const { directory, isMeshVerifiedForAddress } = contactDirectoryRead
  const {
    meshPlaintextToNodeEnabled,
    meshPlaintextNodeId,
    setMeshPlaintextNodeId,
    setMeshPlaintextToNodeEnabled,
    setMeshtasticChannelIndex,
  } = meshSendOptions
  const { message, recipient, onMessageChange: setMessage, onRecipientChange: setRecipient } = composerDraft
  const { partner, onPartnerChange: setPartner } = composerPartner
  const { encrypted, forcedTransport } = sendTransportRead
  const { onEncryptedChange: setEncrypted, onForcedTransportChange: setForcedTransport } = sendTransportChoice
  const {
    composerDelivery,
    onComposerDeliveryChange: setComposerDelivery,
  } = composerSendPath
  const { messagingPersistenceMode } = sendTransportChoice
  const { meshLoRaImagesEnabled, onMeshLoRaImagesEnabledChange: setMeshLoRaImagesEnabled } = sendMeshFunkOptions
  const { meshSelfArchiveAfterLoRa, onMeshSelfArchiveAfterLoRaChange: setMeshSelfArchiveAfterLoRa } =
    sendMeshFunkOptions
  const {
    status,
    statusMsg,
    onStatusChange: setStatus,
    onStatusMsgChange: setStatusMsg,
    onConfirmLoraSendViaOnline: confirmLoraSendViaOnline,
    onDismissLoraOnlineFallback: dismissLoraOnlineFallback,
    onSend: handleSend,
    onCancelSend: cancelSend,
    loraOnlineFallbackOffer,
  } = sendActions
  const {
    selectInboxPartnerForSend,
    inboxOverviewChipsVisible,
    inboxOverviewCategory,
    setInboxOverviewCategory,
    inboxOverviewUnreadCounts,
    isInboxMessageUnread,
    isPinnwandInboxMessage,
    inboxSelectMode,
    selectedInboxIds,
    toggleInboxSelection,
    protokollMarkedIds,
    pinnedPinnwandIds,
    togglePinnedPinnwand,
    toggleProtokollMark,
  } = inboxViewUi

  const { enabled: clientExpertMode } = useMessengerClientExpertMode()

  const [contactAliasDialog, setContactAliasDialog] = useState<{
    address: string
    defaultLabel: string
  } | null>(null)
  const [contactAliasBusy, setContactAliasBusy] = useState(false)
  const [phonebookOpen, setPhonebookOpen] = useState(false)
  useEffect(() => {
    if (phonebookOpen) refreshContactDirectory()
  }, [phonebookOpen, refreshContactDirectory])

  useEffect(() => {
    if (phonebookNavRequest != null && phonebookNavRequest > 0) setPhonebookOpen(true)
  }, [phonebookNavRequest])

  const pendingHandshakeRefreshKey = `${[...handshakeConnectedAddresses].join('|')}|${apiStatus?.locked === true ? 'locked' : 'open'}`

  const internalPendingHandshakes = useChatViewPendingHandshakes({
    enabled:
      !c.pendingHandshakes &&
      /^0x[a-fA-F0-9]{64}$/i.test(myAddress.trim()) &&
      (basisUnreachable !== true || hasCachedHandshakeOffers() || canFetchHandshakesViaDirectIota()),
    connectedAddresses: [...handshakeConnectedAddresses],
    refreshToken: pendingHandshakeRefreshKey,
    contactDirectory: directory,
    vaultLocked: apiStatus?.locked === true,
    basisUnreachable: basisUnreachable === true,
  })

  const {
    offers: pendingHandshakeOffers,
    outgoingOffers: outgoingHandshakeOffers,
    loading: pendingHandshakesLoading,
    reload: reloadPendingHandshakes,
    dismissOffer: dismissPendingHandshake,
    dismissOutgoingOffer: dismissOutgoingPendingHandshake,
  } = c.pendingHandshakes ?? internalPendingHandshakes

  const pendingHandshakeCount = pendingHandshakeOffers.length + outgoingHandshakeOffers.length

  const panelMessengerPorts = useMemo(
    (): ChatViewMessengerPorts => ({
      ...messengerPorts,
      handshakeOffersRead: asHandshakeOffersRead(
        pendingHandshakeOffers,
        outgoingHandshakeOffers,
        reloadPendingHandshakes
      ),
    }),
    [messengerPorts, pendingHandshakeOffers, outgoingHandshakeOffers, reloadPendingHandshakes]
  )

  const { handshakeActions } = panelMessengerPorts

  const handleResendOutgoingHandshake = useCallback(
    async (recipient: string) => {
      await handshakeActions.onHandshakeForAddress(recipient)
      window.setTimeout(() => void reloadPendingHandshakes(), 3000)
    },
    [handshakeActions, reloadPendingHandshakes]
  )

  const handleAcceptHandshakeFromInbox = useCallback(
    async (sender: string) => {
      setPartner(sender.trim())
      await handshakeActions.onConnectAcceptForAddress(sender)
      window.setTimeout(() => void reloadPendingHandshakes(), 4000)
    },
    [setPartner, handshakeActions, reloadPendingHandshakes]
  )

  const purgeAndDismissHandshake = useCallback(
    async (p: {
      recipient: string
      sender: string
      source: HandshakeOfferSource
      dismissLocal: () => void
      label: string
    }) => {
      setSending(true)
      try {
        const purge = await tryPurgeHandshakeOfferOnChain({
          recipient: p.recipient,
          sender: p.sender,
          source: p.source,
          apiStatus,
        })
        p.dismissLocal()
        if (purge.ok && purge.onChain) {
          toast.success(`Handshake mit ${p.label} gelöscht (on-chain + lokal).`)
        } else if (purge.ok && !purge.onChain) {
          const hint =
            purge.reason === 'event-only'
              ? 'Nur lokal ausgeblendet — Event-only (kein Mailbox-Purge möglich).'
              : 'Nur lokal ausgeblendet — Purge/Mailbox nicht verfügbar.'
          toast.info(hint)
        } else {
          toast.warning(`Lokal ausgeblendet. On-chain-Purge fehlgeschlagen: ${purge.error}`)
        }
        window.setTimeout(() => void reloadPendingHandshakes(), 2500)
      } finally {
        setSending(false)
      }
    },
    [apiStatus, reloadPendingHandshakes, setSending]
  )

  const handleDeleteIncomingHandshake = useCallback(
    async (sender: string, nonce: string, source: HandshakeOfferSource) => {
      const me = myAddress.trim()
      if (!/^0x[a-fA-F0-9]{64}$/i.test(me)) {
        toast.error('Eigene Adresse fehlt — Purge nicht möglich.')
        return
      }
      const label =
        contactDisplayLabel(directory, sender.trim().toLowerCase()) || sender.slice(0, 12)
      await purgeAndDismissHandshake({
        recipient: me,
        sender: sender.trim(),
        source,
        dismissLocal: () => dismissPendingHandshake(sender, nonce),
        label,
      })
    },
    [myAddress, directory, purgeAndDismissHandshake, dismissPendingHandshake]
  )

  const handleDeleteOutgoingHandshake = useCallback(
    async (recipient: string, nonce: string, source: HandshakeOfferSource) => {
      const me = myAddress.trim()
      if (!/^0x[a-fA-F0-9]{64}$/i.test(me)) {
        toast.error('Eigene Adresse fehlt — Purge nicht möglich.')
        return
      }
      const label =
        contactDisplayLabel(directory, recipient.trim().toLowerCase()) || recipient.slice(0, 12)
      await purgeAndDismissHandshake({
        recipient: recipient.trim(),
        sender: me,
        source,
        dismissLocal: () => dismissOutgoingPendingHandshake(recipient, nonce),
        label,
      })
    },
    [myAddress, directory, purgeAndDismissHandshake, dismissOutgoingPendingHandshake]
  )

  const handleUseSenderAsPartnerFromInbox = useCallback(
    (sender: string) => {
      const t = sender.trim()
      setPartner(t)
      setRecipient(t)
      toast.info('Partner-Adresse übernommen.')
    },
    [setPartner, setRecipient, setComposerDelivery]
  )

  const [replyPathChoice, setReplyPathChoice] = useState<ReplyContextVariant[] | null>(null)

  const applyInboxReplyVariant = useCallback(
    (variant: ReplyContextVariant) => {
      messengerPorts.attachmentBar.clearCompactAttachment()
      applyReplyContextVariant(variant, {
        onChannelModeChange,
        setForcedTransport,
        setComposerDelivery,
        setPartner,
        setRecipient,
        setEncrypted,
        setComposerMailboxObjectId,
        setMeshtasticChannelIndex,
        setMeshPlaintextNodeId,
        setMeshPlaintextToNodeEnabled,
        selectInboxPartnerForSend,
        setMessage,
        refreshMessengerGroups,
      })
      setStatus('success')
      setStatusMsg(
        variant.hint
          ? `Antworten: ${variant.label} — ${variant.hint}`
          : `Antworten: ${variant.label} — Nachricht ergänzen und senden.`
      )
      toast.success(`Antworten: ${variant.label}`)
      requestAnimationFrame(() => {
        document.getElementById('chat-composer-message')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    },
    [
      messengerPorts.attachmentBar.clearCompactAttachment,
      onChannelModeChange,
      setForcedTransport,
      setComposerDelivery,
      setPartner,
      setRecipient,
      setEncrypted,
      setComposerMailboxObjectId,
      setMeshtasticChannelIndex,
      setMeshPlaintextNodeId,
      setMeshPlaintextToNodeEnabled,
      selectInboxPartnerForSend,
      setMessage,
      refreshMessengerGroups,
      setStatus,
      setStatusMsg,
    ]
  )

  const handleReplyToInboxMessage = useCallback(
    (msg: Message) => {
      const result = resolveReplyContextFromInboxMessage(msg, {
        myAddress,
        contactDirectory: directory,
        pinnwandBoardAddress: apiStatus?.broadcastPinnwand?.address,
        activeGroup,
      })
      if (!result) {
        toast.error('Antworten: Kein passender Kanal für diese Zeile.')
        return
      }
      if (result.kind === 'choice') {
        setReplyPathChoice(result.variants)
        return
      }
      applyInboxReplyVariant(result.variant)
    },
    [myAddress, directory, apiStatus?.broadcastPinnwand?.address, activeGroup, applyInboxReplyVariant]
  )

  const addInboxSenderToContactBook = useCallback(
    (address: string) => {
      const a = address.trim()
      if (!a.startsWith('0x') || a.length < 66) {
        setStatus('error')
        setStatusMsg('Keine gültige 0x-Absenderadresse.')
        setTimeout(() => setStatus('idle'), 4000)
        return
      }
      if (myAddress.trim() && addressMatchesIdentity(a, myAddress)) {
        setStatus('error')
        setStatusMsg('Das ist deine eigene Adresse — nicht ins Telefonbuch nötig.')
        setTimeout(() => setStatus('idle'), 4000)
        return
      }
      const suggest = contactDisplayLabel(directory, a) || `${a.slice(0, 10)}…${a.slice(-4)}`
      setContactAliasDialog({ address: a, defaultLabel: suggest })
    },
    [directory, myAddress, setStatus, setStatusMsg]
  )

  const saveContactAliasFromDialog = useCallback(
    async (label: string) => {
      if (!contactAliasDialog) return
      setContactAliasBusy(true)
      const r = await saveContactEntry({
        address: contactAliasDialog.address,
        label: label || undefined,
      })
      setContactAliasBusy(false)
      if (r.ok) {
        refreshContactDirectory()
        recordContactLastContacted(contactAliasDialog.address)
        setStatus('success')
        setStatusMsg(r.message || 'Kontakt gespeichert.')
        setContactAliasDialog(null)
      } else {
        setStatus('error')
        setStatusMsg(r.error || 'Kontakt speichern fehlgeschlagen.')
      }
      setTimeout(() => setStatus('idle'), 5000)
    },
    [contactAliasDialog, refreshContactDirectory, setStatus, setStatusMsg]
  )

  const onSarqNakWire = useCallback(
    async (wire: string) => {
      if (!meshtastic.connected) return
      const resolved = meshPlaintextToNodeEnabled
        ? resolveMeshtasticPlaintextDestination(true, meshPlaintextNodeId)
        : 'broadcast'
      const dest = resolved === null ? 'broadcast' : resolved
      try {
        await meshtastic.sendMeshText(wire, dest)
      } catch {
        /* NAK optional; Chat bleibt bedienbar */
      }
    },
    [meshtastic, meshPlaintextNodeId, meshPlaintextToNodeEnabled]
  )

  const applyPhonebookContact = useCallback(
    (storageKey: string, entry: ContactMeshEntryClient) => {
      const applied = applyPhonebookContactToComposer(storageKey, entry, {
        setPartner,
        setRecipient,
        setMeshPlaintextNodeId,
        setMeshPlaintextToNodeEnabled,
        setContactBleUuid,
        selectInboxPartnerForSend,
      })
      recordContactLastContacted(applied.storageKey)
      setPhonebookOpen(false)
      if (applied.telegramChatId && !applied.iotaAddress) {
        setComposerDelivery('telegram')
      } else if (applied.iotaAddress) {
        setComposerDelivery('chain')
      }
      const parts: string[] = []
      if (applied.iotaAddress) parts.push('IOTA')
      if (applied.telegramChatId) parts.push('Telegram')
      if (applied.meshNodeId) parts.push('Meshtastic')
      if (applied.mailboxObjectId) parts.push('Mailbox')
      toast.success(
        `${applied.label}: ${parts.length ? parts.join(', ') : 'Kontakt'} übernommen — Transport wählen und senden.`
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
      setContactBleUuid,
      selectInboxPartnerForSend,
      setComposerDelivery,
    ]
  )

  const uiCaps = useMemo(() => getMessengerUiCapabilities(apiStatus), [apiStatus])
  const pinnwandCaps = useMemo(
    () => getMessengerPinnwandCapabilities(apiStatus, role, channelMode, myAddress),
    [apiStatus, role, channelMode, myAddress]
  )
  const pinnwandPreviewMessages = useMemo(() => {
    if (!pinnwandCaps.showInboxStrip) return []
    const match = buildPinnwandMatchContext(apiStatus, myAddress)
    if (!match) return []
    return messages
      .filter((m) => messageBelongsToPinnwand(m, match))
      .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
      .slice(0, 3)
  }, [messages, pinnwandCaps.showInboxStrip, apiStatus, myAddress])
  const showInboxPackageExpert = uiCaps.showInboxPackageExpertMenu(clientExpertMode)
  /** Kanal-Tab „Pinnwand“ — eigener Feed, kein gemischter Posteingang. */
  const onPinnwandTab =
    channelMode != null && isPinnwandChannel(channelMode) && pinnwandCaps.configured

  useEffect(() => {
    if (!onChannelModeChange || channelMode == null) return
    if (channelMode === 'pinnwand' && !pinnwandCaps.showChannelTab) {
      onChannelModeChange('private')
    }
  }, [channelMode, pinnwandCaps.showChannelTab, onChannelModeChange])

  useEffect(() => {
    if (!showInboxPackageExpert) return
    void refreshPackageIdSuggestions()
  }, [showInboxPackageExpert, refreshPackageIdSuggestions])

  const applyTemporaryInboxPackage = useCallback(
    async (packageId: string) => {
      setInboxPackageFilter(packageId)
      await loadMessages('reset', packageId)
    },
    [loadMessages, setInboxPackageFilter]
  )

  const clearTemporaryInboxPackage = useCallback(async () => {
    setInboxPackageFilter('')
    await loadMessages('reset')
  }, [loadMessages, setInboxPackageFilter])

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
  }, [basisUnreachable, inboxFromCache, status, statusMsg, setStatus, setStatusMsg])

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
    toast.success('Empfänger übernommen — siehe „Verschlüsselung & Partner“ oben.')
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
    isPrivate,
    isGroup,
    role,
    channelMode,
    onChannelModeChange,
    vaultBannerActions,
    offlineStatus,
    meshBleConnected: meshtastic.connected,
    refreshApiStatus,
    showAdhocTransport: uiCaps.showAdhocTransport,
    packageIdBusy,
    syncCanonicalPackageIdFromServer,
    showPackageIdBanner: uiCaps.showPackageIdBanner,
  })

  const inboxPanelProps = useChatViewInboxPanelProps({
    messengerPorts: panelMessengerPorts,
    inboxTotalCount,
    inboxRows,
    morgPkgFileRef,
    morgPkgDeviceFilesRef,
    onMorgPkgImportFile,
    onMorgPkgDeviceFiles,
    onMorgPkgDeviceExportPick,
    morgPkgDeviceBusy,
    morgPkgExportRecipient,
    setMorgPkgExportRecipient,
    morgPkgExportPartnerOptions,
    morgPkgImportCount: morgPkgImports.length,
    onOpenMorgPkgArchive: () => setMorgPkgImportsOpen(true),
    loadMessages,
    refreshContactDirectory,
    pendingHandshakesLoading,
    pendingHandshakeCount,
    sending,
    onAcceptPendingHandshake: handleAcceptHandshakeFromInbox,
    onUseSenderAsPartnerFromInbox: handleUseSenderAsPartnerFromInbox,
    onReplyToMessage: handleReplyToInboxMessage,
    onDeleteIncomingHandshake: handleDeleteIncomingHandshake,
    onDeleteOutgoingHandshake: handleDeleteOutgoingHandshake,
    onResendOutgoingHandshake: handleResendOutgoingHandshake,
    loading,
    loadingMore,
    loadMoreInbox,
    inboxHasMore,
    loadError,
    inboxFromCache,
    inboxCacheAgeMinutes,
    inboxLiveSource,
    exportEcdhMorgPkgForMessage,
    onExportEinsatzberichtJson,
    onExportEinsatzberichtTxt,
    onExportEinsatzberichtTxtFull,
    onExportEinsatzberichtEncrypted,
    onExportEinsatzprotokoll,
    onExportEinsatzprotokollPlainZip,
    onExportEinsatzprotokollMarked,
    onHideInboxMessageLocal,
    onPurgeInboxMessageChain,
    onForwardMessage,
    onHideAllVisibleLocal,
    onBulkHideSelected,
    onBulkPurgeSelected,
    recipient,
    setStatus,
    setStatusMsg,
    addInboxSenderToContactBook,
    onSarqNakWire,
    localPurgeBusy,
    showPinnwandPinActions: pinnwandCaps.configured && pinnwandCaps.canPost,
    openPartnerSetupPanel,
    onOpenPhonebook: () => setPhonebookOpen(true),
    messagingPersistenceMode,
    showInboxIotaFilter: uiCaps.showInboxIotaFilter,
    showIotaExpertInboxActions: uiCaps.expertTools,
    pinnwandOverviewConfigured: pinnwandCaps.configured,
    showInboxPackageExpertMenu: showInboxPackageExpert,
    inboxPackageFilter,
    packageIdSuggestions,
    packageIdBusy,
    applyTemporaryInboxPackage,
    clearTemporaryInboxPackage,
    applyPackageIdBackend,
    onOpenSettings,
    setRecipient,
  })

  const { sendPanelProps } = useChatViewSendPanelProps({
    messengerPorts: panelMessengerPorts,
    activeGroup,
    refreshApiStatus,
    loadMessages,
    composerMailboxObjectId,
    setComposerMailboxObjectId,
    appendMeshMessage,
    expertTools: uiCaps.expertTools,
    pinnwandBroadcastAddress: pinnwandCaps.broadcastAddress,
    canPostToPinnwand: pinnwandCaps.canPost,
    vaultBannerActions,
    onOpenPhonebook: isPrivate || isGroup ? () => setPhonebookOpen(true) : undefined,
  })

  const { encryptedPartnerPanelProps } = useChatViewEncryptedPartnerPanelProps({
    messengerPorts: panelMessengerPorts,
    sending,
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
    meshBleSupported: meshtastic.bleSupported,
    meshBleConnected: meshtastic.connected,
    onOpenPartnerSetup: openPartnerSetupPanel,
    refreshContactDirectory,
    refreshApiStatus,
    setStatus,
    setStatusMsg,
    encryptedPartnerPanelProps,
  })

  return (
    <div className="space-y-8">
      <ChatViewChatHeader {...chatHeaderProps} />

      {uiCaps.showProminentOfflineQueueBanner ? (
        <ChatViewOfflineQueueStrip {...offlineQueueStripProps} />
      ) : null}

      {isGroup ? (
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

      {isGroup && encryptedPartnerPanelProps ? (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Handshake — Gruppenmitglieder</p>
          <ChatViewEncryptedPartnerPanel {...encryptedPartnerPanelProps} />
        </div>
      ) : null}

      {pinnwandCaps.showInboxStrip ? (
        <ChatViewPinnwandInboxStrip
          messages={pinnwandPreviewMessages}
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

      {channelMode === 'private' && composerDelivery === 'chain' ? (
        <ChatViewTransportCard {...transportCardProps} />
      ) : null}

      {showPartnerSetupPanel ? (
        <ChatViewSetupPanel
          forcedTransport={forcedTransport}
          meshtastic={{
            bleSupported: meshtastic.bleSupported,
            serialSupported: meshtastic.serialSupported,
            transportKind: meshtastic.transportKind,
            connected: meshtastic.connected,
            connecting: meshtastic.connecting,
            error: meshtastic.error,
            lastRxDebug: meshtastic.lastRxDebug,
            meshRxSubscriptions: meshtastic.meshRxSubscriptions,
            connect: meshtastic.connect,
            connectBluetooth: meshtastic.connectBluetooth,
            connectUsb: meshtastic.connectUsb,
            disconnect: meshtastic.disconnect,
          }}
          refreshContactDirectory={refreshContactDirectory}
          contactBleAddress={contactBleAddress}
          onContactBleAddressChange={setContactBleAddress}
          contactBleUuid={contactBleUuid}
          onContactBleUuidChange={setContactBleUuid}
          contactBleBusy={contactBleBusy}
          setContactBleBusy={setContactBleBusy}
          meshSyncMsg={meshSyncMsg}
          setMeshSyncMsg={setMeshSyncMsg}
        />
      ) : null}

      <ContactAddAliasDialog
        open={contactAliasDialog != null}
        onOpenChange={(open) => {
          if (!open) setContactAliasDialog(null)
        }}
        address={contactAliasDialog?.address ?? ''}
        defaultLabel={contactAliasDialog?.defaultLabel ?? ''}
        busy={contactAliasBusy}
        onSave={saveContactAliasFromDialog}
      />

      {onPinnwandTab ? (
        <>
          <ChatViewPinnwandFeedPanel
            apiStatus={connectionStatusRead.apiStatus}
            role={role}
            canPost={pinnwandCaps.canPost}
            unreadCount={inboxOverviewUnreadCounts?.lagebild ?? 0}
            loading={loading}
            onRefresh={() => void loadMessages('reset')}
            loadError={loadError}
            inboxFromCache={inboxFromCache}
            inboxCacheAgeMinutes={inboxCacheAgeMinutes}
            basisUnreachable={connectionStatusRead.basisUnreachable ?? false}
            messages={pinnwandFeedMessages}
            inboxRows={pinnwandInboxRows}
            myAddress={myAddress}
            contactDirectory={contactDirectoryRead.directory}
            isMeshVerifiedForAddress={contactDirectoryRead.isMeshVerifiedForAddress}
            exportEcdhMorgPkgForMessage={exportEcdhMorgPkgForMessage}
            onHideInboxMessageLocal={onHideInboxMessageLocal}
            onPurgeInboxMessageChain={onPurgeInboxMessageChain}
            onForwardMessage={onForwardMessage}
            onReplyToMessage={handleReplyToInboxMessage}
            toggleProtokollMark={toggleProtokollMark}
            protokollMarkedIds={protokollMarkedIds}
            pinnedPinnwandIds={pinnedPinnwandIds}
            onTogglePinnedPinnwand={togglePinnedPinnwand}
            showPinnwandPinActions={pinnwandCaps.configured && pinnwandCaps.canPost}
            inboxSelectMode={inboxSelectMode}
            selectedInboxIds={selectedInboxIds}
            toggleInboxSelection={toggleInboxSelection}
            loadingMore={loadingMore}
            loadMoreInbox={loadMoreInbox}
            inboxHasMore={inboxHasMore}
            onAddSenderToContactBook={addInboxSenderToContactBook}
            onSarqNakWire={onSarqNakWire}
            isInboxMessageUnread={isInboxMessageUnread}
            isPinnwandInboxMessage={isPinnwandInboxMessage}
            sending={sending}
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

          {inboxOverviewChipsVisible && (inboxUnreadThreadOptions?.length ?? 0) > 0 ? (
            <ChatViewInboxUnreadThreadsStrip
              threads={inboxUnreadThreadOptions ?? []}
              onOpenThread={(address) => {
                setInboxOverviewCategory('direkt')
                selectInboxPartnerForSend(address)
              }}
            />
          ) : null}

          <ChatViewInboxPanel {...inboxPanelProps} />
        </>
      )}

      {morgPkgImportsOpen ? (
        <LazyChatViewMorgPkgImportsSheet
          open={morgPkgImportsOpen}
          onOpenChange={setMorgPkgImportsOpen}
          records={morgPkgImports}
          contactDirectory={contactDirectoryRead.directory}
          onRemove={removeMorgPkgImport}
          onForwardItem={onForwardMorgPkgItem}
        />
      ) : null}

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

      <Dialog open={replyPathChoice != null} onOpenChange={(open) => !open && setReplyPathChoice(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Antworten — Sendeweg wählen</DialogTitle>
            <DialogDescription>
              Diese Nachricht kam über mehrere Wege an. Welchen Pfad soll der Composer übernehmen?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-1">
            {(replyPathChoice ?? []).map((variant) => (
              <Button
                key={variant.id}
                type="button"
                variant="outline"
                className="h-auto justify-start px-3 py-2.5 text-left"
                onClick={() => {
                  setReplyPathChoice(null)
                  applyInboxReplyVariant(variant)
                }}
              >
                <span className="font-semibold">{variant.label}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
