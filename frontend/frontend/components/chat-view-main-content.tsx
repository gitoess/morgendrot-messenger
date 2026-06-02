'use client'

/**
 * Reine Zusammenstellung der Chat-Unterkomponenten; gesamte Logik liegt in `useChatViewCore`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ChatViewInboxPanel, type ChatViewInboxPanelProps } from '@/frontend/components/chat-view-inbox-panel'
import {
  asComposerDraft,
  asInboxFeedRead,
  asSendMeshMirrorDelay,
  asSendTransportChoice,
  asSendTransportRead,
  asVoiceRecordSendPanel,
} from '@/frontend/features/messenger-ports'
import { ChatViewPackageIdBanner } from '@/frontend/components/chat-view-package-id-banner'
import { ChatViewSendPanel, type ChatViewSendPanelProps } from '@/frontend/components/chat-view-send-panel'
import { ChatViewChatHeader, type ChatViewVaultBannerActions } from '@/frontend/components/chat-view-chat-header'
import { ChatViewOfflineQueueStrip } from '@/frontend/components/chat-view-offline-queue-strip'
import { ChatViewPinnwandContextCard } from '@/frontend/components/chat-view-pinnwand-context-card'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
import {
  ChatViewTransportCard,
  type ChatViewTransportCardProps,
} from '@/frontend/components/chat-view-transport-card'
import { ChatViewSetupPanel } from '@/frontend/components/chat-view-setup-panel'
import { ChatViewGroupPanel } from '@/frontend/components/chat-view-group-panel'
import { ChatViewPhonebookSheet } from '@/frontend/components/chat-view-phonebook-sheet'
import { ChatViewMorgPkgImportsSheet } from '@/frontend/components/chat-view-morg-pkg-imports-sheet'
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
import { ChatViewRelaySubmitButton } from '@/frontend/components/chat-view-relay-submit-button'
import { recordTelegramOutgoing } from '@/frontend/lib/record-telegram-outgoing'
import { useChatViewTelegramComposer } from '@/frontend/hooks/use-chat-view-telegram-composer'
import { recordContactLastContacted } from '@/frontend/lib/contact-phonebook-meta-store'
import { addressMatchesIdentity } from '@/frontend/features/inbox/inbox-partner-filter'
import { resolveMeshtasticPlaintextDestination } from '@/frontend/lib/meshtastic-node-id'
import { resolveConnectedAddresses } from '@/frontend/lib/connected-peers-snapshot'
import { canFetchHandshakesViaDirectIota } from '@/frontend/lib/direct-iota-handshake-fetch'
import { hasCachedHandshakeOffers } from '@/frontend/lib/handshake-offers-cache'
import {
  useChatViewPendingHandshakes,
  type PendingHandshakesPollState,
} from '@/frontend/hooks/use-chat-view-pending-handshakes'
import { useOfflineStatus } from '@/frontend/hooks/use-offline-status'
import {
  groupMailboxTargetCount,
  readGroupMailboxSendAll,
} from '@/frontend/lib/group-mailbox-pairwise-send'
import {
  tryPurgeHandshakeOfferOnChain,
  type HandshakeOfferSource,
} from '@/frontend/lib/handshake-offer-delete'
import { useEncryptedRecipientHandshakeStatus } from '@/frontend/hooks/use-encrypted-recipient-handshake-status'
import { resolveComposerIotaAddress } from '@/frontend/lib/composer-recipient-fields'
import { isValidRecipient0x } from '@/frontend/lib/encrypted-recipient-handshake-status'

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
    message,
    setMessage,
    recipient,
    setRecipient,
    partner,
    setPartner,
    sending,
    setSending,
    status,
    statusMsg,
    setStatus,
    setStatusMsg,
    showSetup,
    toggleShowSetup,
    encrypted,
    setEncrypted,
    apiStatus,
    refreshApiStatus,
    basisUnreachable,
    statusCacheAgeMinutes,
    packageIdMismatch,
    deviceTimeTrustWarn,
    offlineMailboxQueuePending,
    offlineMailboxQueueUntrustedTimeCount,
    offlineMailboxQueueBackoffCount,
    offlineMailboxQueueErrorHint,
    offlineMailboxQueueItems,
    removeOfflineMailboxQueueItems,
    syncCanonicalPackageIdFromServer,
    inboxPackageFilter,
    setInboxPackageFilter,
    packageIdSuggestions,
    refreshPackageIdSuggestions,
    applyPackageIdBackend,
    applyInboxPackageFilterOnly,
    packageIdBusy,
    forcedTransport,
    setForcedTransport,
    composerDelivery,
    setComposerDelivery,
    messagingPersistenceMode,
    setMessagingPersistenceMode,
    composerMailboxObjectId,
    setComposerMailboxObjectId,
    morgPkgDeviceBusy,
    morgPkgFileRef,
    morgPkgDeviceFilesRef,
    directory,
    refreshContactDirectory,
    isMeshVerifiedForAddress,
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
    meshtastic,
    meshExportPw,
    setMeshExportPw,
    meshImportPw,
    setMeshImportPw,
    meshImportJson,
    setMeshImportJson,
    meshSyncBusy,
    setMeshSyncBusy,
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
    contactMeshNodeId,
    setContactMeshNodeId,
    meshPlaintextToNodeEnabled,
    setMeshPlaintextToNodeEnabled,
    meshPlaintextNodeId,
    setMeshPlaintextNodeId,
    meshtasticChannelIndex,
    setMeshtasticChannelIndex,
    attachedBlobBase64,
    attachedTxtFile,
    attachedAudioBase64,
    attachedLora,
    compactMeta,
    compactPreviewUrl,
    loraPreviewUrl,
    loraMeshProgressLine,
    loraOnlineFallbackOffer,
    compactBusy,
    attachmentPipelineHint,
    compactFileRef,
    clearCompactAttachment,
    handleCompactAttachmentPick,
    ingestChatAttachmentFile,
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
    confirmLoraSendViaOnline,
    handleSend,
    cancelSend,
    handleHandshake,
    handleHandshakeForAddress,
    handleConnectAcceptPartner,
    handleConnectAcceptForAddress,
    handleConnectDeployment,
    dismissLoraOnlineFallback,
    openPartnerSetupPanel,
    onExportEinsatzberichtJson,
    onExportEinsatzberichtTxt,
    onExportEinsatzberichtTxtFull,
    onExportEinsatzberichtEncrypted,
    onExportEinsatzprotokoll,
    onExportEinsatzprotokollPlainZip,
    onExportEinsatzprotokollMarked,
    meshSelfArchiveAfterLoRa,
    setMeshSelfArchiveAfterLoRa,
    protokollMarkedIds,
    pinnedPinnwandIds,
    togglePinnedPinnwand,
    toggleProtokollMark,
    onHideInboxMessageLocal,
    onPurgeInboxMessageChain,
    onForwardMessage,
    onHideAllVisibleLocal,
    inboxSelectMode,
    setInboxSelectMode,
    selectedInboxIds,
    hiddenInboxCount,
    toggleInboxSelection,
    selectAllVisibleInbox,
    clearInboxSelection,
    onBulkHideSelected,
    onBulkPurgeSelected,
    inboxPartnerKey,
    setInboxPartnerKey,
    inboxDirectionFilter,
    setInboxDirectionFilter,
    inboxMeshTransportOnly,
    setInboxMeshTransportOnly,
    inboxIotaTransportOnly,
    setInboxIotaTransportOnly,
    inboxPartnerOptions,
    selectInboxPartnerForSend,
    removeInboxPartnerFromQuickList,
    resetInboxViewFilters,
    inboxVisibilityHint,
    voicePhase,
    voiceActiveKind,
    voiceProgress01,
    voiceBusy,
    voiceRecording,
    onVoiceToggle,
    onVoiceEmergencyToggle,
    voiceNormalBlockedStart,
    voiceEmergencyBlockedStart,
    voiceMaxSeconds,
    voiceEmergencyMaxSeconds,
    sosVoiceFollowsOnline,
    sosVoiceAwaitingSend,
    vaultBannerActions,
    channelMode,
    onChannelModeChange,
    pendingHandshakes,
    onOpenEinsatzleitung,
    phonebookNavRequest,
    onOpenSettings,
    inboxWireFilter,
    setInboxWireFilter,
  } = c

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

  const handshakeConnected = useMemo(
    () =>
      resolveConnectedAddresses({
        fromStatus: apiStatus?.connectedAddresses,
        preferCacheWhenEmpty: basisUnreachable,
      }),
    [apiStatus?.connectedAddresses, basisUnreachable]
  )

  const pendingHandshakeRefreshKey = `${handshakeConnected.addresses.join('|')}|${apiStatus?.locked === true ? 'locked' : 'open'}`

  const internalPendingHandshakes = useChatViewPendingHandshakes({
    enabled:
      !c.pendingHandshakes &&
      /^0x[a-fA-F0-9]{64}$/i.test(myAddress.trim()) &&
      (basisUnreachable !== true || hasCachedHandshakeOffers() || canFetchHandshakesViaDirectIota()),
    connectedAddresses: handshakeConnected.addresses,
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

  const composerEncryptedRecipient = useMemo(
    () => resolveComposerIotaAddress(recipient, partner, encrypted),
    [recipient, partner, encrypted]
  )

  const encryptedRecipientHandshake = useEncryptedRecipientHandshakeStatus({
    enabled:
      isPrivate &&
      encrypted &&
      forcedTransport === 'internet' &&
      composerDelivery === 'chain' &&
      isValidRecipient0x(composerEncryptedRecipient),
    recipient: composerEncryptedRecipient,
    connectedAddresses: handshakeConnected.addresses,
    incomingOffers: pendingHandshakeOffers,
    outgoingOffers: outgoingHandshakeOffers,
  })

  const handleEncryptedHandshakeForComposerRecipient = useCallback(async () => {
    const addr = composerEncryptedRecipient.trim().toLowerCase()
    if (!isValidRecipient0x(addr)) return
    setPartner(addr)
    await handleHandshakeForAddress(addr)
    encryptedRecipientHandshake.refresh()
    window.setTimeout(() => void reloadPendingHandshakes(), 3000)
  }, [
    composerEncryptedRecipient,
    setPartner,
    handleHandshakeForAddress,
    encryptedRecipientHandshake,
    reloadPendingHandshakes,
  ])

  const handleEncryptedAcceptForComposerRecipient = useCallback(async () => {
    const addr = composerEncryptedRecipient.trim().toLowerCase()
    if (!isValidRecipient0x(addr)) return
    setPartner(addr)
    await handleConnectAcceptForAddress(addr)
    encryptedRecipientHandshake.refresh()
    await refreshApiStatus?.()
    window.setTimeout(() => void reloadPendingHandshakes(), 4000)
  }, [
    composerEncryptedRecipient,
    setPartner,
    handleConnectAcceptForAddress,
    encryptedRecipientHandshake,
    refreshApiStatus,
    reloadPendingHandshakes,
  ])

  const handleResendOutgoingHandshake = useCallback(
    async (recipient: string) => {
      await handleHandshakeForAddress(recipient)
      window.setTimeout(() => void reloadPendingHandshakes(), 3000)
    },
    [handleHandshakeForAddress, reloadPendingHandshakes]
  )

  const handleAcceptHandshakeFromInbox = useCallback(
    async (sender: string) => {
      setPartner(sender.trim())
      await handleConnectAcceptForAddress(sender)
      window.setTimeout(() => void reloadPendingHandshakes(), 4000)
    },
    [setPartner, handleConnectAcceptForAddress, reloadPendingHandshakes]
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
        setContactMeshNodeId,
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
      setContactMeshNodeId,
      setMeshPlaintextNodeId,
      setMeshPlaintextToNodeEnabled,
      setContactBleUuid,
      selectInboxPartnerForSend,
      setComposerDelivery,
    ]
  )

  const uiCaps = useMemo(() => getMessengerUiCapabilities(apiStatus), [apiStatus])
  const offlineStatus = useOfflineStatus({
    apiSnapshot: apiStatus,
    backendReachable: basisUnreachable ? false : true,
  })

  /** Inbox-Cache ≠ offline: Composer-Status nicht mit Posteingang-Fallback verwechseln. */
  useEffect(() => {
    if (basisUnreachable === true) return
    setStatus((cur) => {
      if (cur !== 'error') return cur
      return 'idle'
    })
    setStatusMsg((msg) =>
      /Offline — (letzte Nachrichten|Basis nicht erreichbar)/.test(msg) ? '' : msg
    )
  }, [basisUnreachable, inboxFromCache])

  useEffect(() => {
    if (!uiCaps.showInboxIotaFilter && inboxIotaTransportOnly) {
      setInboxIotaTransportOnly(false)
    }
  }, [uiCaps.showInboxIotaFilter, inboxIotaTransportOnly, setInboxIotaTransportOnly])

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
    toast.success('Empfänger übernommen — siehe „Empfänger-Adresse“ im Composer unten.')
  }, [partner, setRecipient, selectInboxPartnerForSend])

  const inboxPanelProps = {
    ...asInboxFeedRead(messages, myAddress),
    messageCount: inboxTotalCount,
    inboxRowCount: inboxRows.length,
    morgPkgFileRef,
    morgPkgDeviceFilesRef,
    onMorgPkgImportFile,
    onMorgPkgDeviceFiles,
    onMorgPkgDeviceExportPick,
    morgPkgDeviceBusy,
    morgPkgExportRecipient,
    onMorgPkgExportRecipientChange: setMorgPkgExportRecipient,
    morgPkgExportPartnerOptions,
    morgPkgImportCount: morgPkgImports.length,
    onOpenMorgPkgArchive: () => setMorgPkgImportsOpen(true),
    apiStatus,
    onRefresh: () => {
      void loadMessages('reset')
      refreshContactDirectory()
      void reloadPendingHandshakes()
    },
    pendingHandshakeOffers,
    outgoingHandshakeOffers,
    pendingHandshakesLoading,
    pendingHandshakeCount,
    sending,
    onAcceptPendingHandshake: handleAcceptHandshakeFromInbox,
    onUseSenderAsPartnerFromInbox: handleUseSenderAsPartnerFromInbox,
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
    basisUnreachable,
    inboxVisibilityHint,
    inboxPartnerOptions,
    inboxPartnerKey,
    setInboxPartnerKey,
    inboxDirectionFilter,
    setInboxDirectionFilter,
    inboxMeshTransportOnly,
    setInboxMeshTransportOnly,
    inboxIotaTransportOnly,
    setInboxIotaTransportOnly,
    inboxWireFilter,
    setInboxWireFilter,
    selectInboxPartnerForSend,
    removeInboxPartnerFromQuickList,
    inboxRows,
    contactDirectory: directory,
    isMeshVerifiedForAddress,
    exportEcdhMorgPkgForMessage,
    onExportEinsatzberichtJson,
    onExportEinsatzberichtTxt,
    onExportEinsatzberichtTxtFull,
    onExportEinsatzberichtEncrypted,
    onExportEinsatzprotokoll,
    onExportEinsatzprotokollPlainZip,
    onExportEinsatzprotokollMarked,
    protokollMarkedCount: protokollMarkedIds.size,
    protokollMarkedIds,
    onHideInboxMessageLocal,
    onPurgeInboxMessageChain,
    onForwardMessage,
    onToggleHideAllVisibleLocal: onHideAllVisibleLocal,
    inboxSelectMode,
    setInboxSelectMode,
    selectedInboxIds,
    hiddenInboxCount,
    toggleInboxSelection,
    onSelectAllVisible: selectAllVisibleInbox,
    onClearInboxSelection: clearInboxSelection,
    onBulkHideSelected,
    onBulkPurgeSelected,
    toggleProtokollMark,
    recipient,
    setStatus,
    setStatusMsg,
    onAddSenderToContactBook: addInboxSenderToContactBook,
    onSarqNakWire,
    localPurgeBusy,
    pinnedPinnwandIds,
    onTogglePinnedPinnwand: togglePinnedPinnwand,
    showPinnwandPinActions: channelMode != null && isPinnwandChannel(channelMode),
    showPhonebookButton: false,
    onContactsChanged: refreshContactDirectory,
    onMailboxPanelStatus: (msg, kind) => {
      if (kind === 'success') toast.success(msg)
      else toast.error(msg)
    },
    onApplySendRecipient: (addr) => {
      setRecipient(addr)
      selectInboxPartnerForSend(addr)
    },
    onOpenPhonebook: () => setPhonebookOpen(true),
    onOpenPartnerSetup: openPartnerSetupPanel,
    messagingPersistenceMode,
    showInboxIotaFilter: uiCaps.showInboxIotaFilter,
    showIotaExpertInboxActions: uiCaps.expertTools,
  } satisfies ChatViewInboxPanelProps

  const telegramComposer = useChatViewTelegramComposer({
    isPrivate,
    composerDelivery,
    recipient,
    partner,
    encrypted,
    message,
    apiStatus,
    contactDirectory: directory,
    myAddress,
    sending,
    attachedTxtFile,
    attachedBlobBase64,
    attachedAudioBase64,
    hasLoraAttachment: attachedLora != null,
    onMessageChange: setMessage,
    clearAttachments: clearCompactAttachment,
    onStatusFeedback: (msg, st = 'success') => {
      setStatus(st)
      setStatusMsg(msg)
    },
    onTelegramDelivered: ({ recipientKey, text }) => {
      recordTelegramOutgoing(appendMeshMessage, myAddress, recipientKey, text)
    },
  })

  const sendPanelProps = {
    ...asComposerDraft(message, recipient, setMessage, setRecipient),
    ...asSendTransportRead(encrypted, forcedTransport),
    ...asSendMeshMirrorDelay(meshSelfArchiveAfterLoRa, setMeshSelfArchiveAfterLoRa),
    isPrivate,
    sending,
    loraOnlineFallbackOffer,
    onConfirmLoraOnline: confirmLoraSendViaOnline,
    onDismissLoraOnlineFallback: dismissLoraOnlineFallback,
    apiStatus,
    onSend: handleSend,
    onCancelSend: cancelSend,
    status,
    statusMsg,
    offlineMailboxQueuePending,
    offlineMailboxQueueUntrustedTimeCount,
    offlineMailboxQueueBackoffCount,
    offlineMailboxQueueErrorHint,
    offlineMailboxQueueItems,
    onRemoveOfflineMailboxQueueItems: removeOfflineMailboxQueueItems,
    meshPlaintextToNodeEnabled,
    onMeshPlaintextToNodeEnabledChange: setMeshPlaintextToNodeEnabled,
    meshPlaintextNodeId,
    onMeshPlaintextNodeIdChange: setMeshPlaintextNodeId,
    meshtasticChannelIndex,
    onMeshtasticChannelIndexChange: setMeshtasticChannelIndex,
    showMeshtasticChannelIndexInput: uiCaps.expertTools,
    ...asVoiceRecordSendPanel(
      {
        voicePhase,
        voiceActiveKind,
        voiceProgress01,
        voiceMaxSeconds,
        voiceEmergencyMaxSeconds,
        sosVoiceFollowsOnline,
        onVoiceToggle,
        onVoiceEmergencyToggle,
        voiceNormalBlockedStart,
        voiceEmergencyBlockedStart,
        voiceBusy,
        voiceRecording,
      },
      sosVoiceAwaitingSend
    ),
    forcedTransport,
    compactFileRef,
    compactBusy,
    attachmentPipelineHint,
    onFileChange: handleCompactAttachmentPick,
    ingestChatAttachmentFile,
    compactMeta,
    attachedBlobBase64,
    attachedLora,
    attachedTxtFile,
    attachedAudioBase64,
    clearCompactAttachment,
    compactPreviewUrl,
    loraPreviewUrl,
    loraMeshProgressLine,
    onManualRefresh: async () => {
      await refreshApiStatus()
      await loadMessages('reset')
    },
    contactDirectory: directory,
    isGroupChannel: isGroup,
    groupMailboxSendAll: isGroup && readGroupMailboxSendAll(),
    groupMemberCount: isGroup && activeGroup ? groupMailboxTargetCount(activeGroup, myAddress) : 0,
    partner,
    onPartnerChange: setPartner,
    myAddress,
    onStatusFeedback: (msg, st = 'success') => {
      setStatus(st)
      setStatusMsg(msg)
    },
    composerDelivery,
    messagingPersistenceMode,
    onTelegramSend: telegramComposer.handleTelegramOnly,
    canSendTelegram: telegramComposer.canSendTelegramOnly,
    telegramBusy: telegramComposer.telegramOnlyBusy,
    onNavigateHomeWhenLocked: vaultBannerActions?.onNavigateHomeWhenLocked,
    composerMailboxObjectId,
    onComposerMailboxObjectIdChange: setComposerMailboxObjectId,
    encryptedRecipientHandshakeStatus: encryptedRecipientHandshake.status,
    encryptedHandshakeBlocksSend: encryptedRecipientHandshake.blocksSend,
    onEncryptedHandshakeForRecipient: handleEncryptedHandshakeForComposerRecipient,
    onEncryptedAcceptHandshakeForRecipient: handleEncryptedAcceptForComposerRecipient,
    showPath4Checkbox: uiCaps.expertTools,
    onOpenPhonebook: isPrivate || isGroup ? () => setPhonebookOpen(true) : undefined,
  } satisfies ChatViewSendPanelProps

  const showEncryptedPartnerPanel =
    composerDelivery === 'chain' &&
    (isGroup || (isPrivate && encryptedRecipientHandshake.status !== 'ready')) &&
    encrypted &&
    forcedTransport === 'internet'

  const showPartnerSetupPanel =
    (isPrivate || isGroup) &&
    composerDelivery === 'chain' &&
    (showSetup || forcedTransport === 'mesh' || forcedTransport === 'adhoc')

  const transportCardProps = {
    ...asSendTransportChoice(
      encrypted,
      setEncrypted,
      forcedTransport,
      setForcedTransport,
      messagingPersistenceMode,
      setMessagingPersistenceMode
    ),
    isPrivate,
    apiStatus,
    partner,
    meshBleSupported: meshtastic.bleSupported,
    meshBleConnected: meshtastic.connected,
    onOpenPartnerSetup: openPartnerSetupPanel,
    channelMode,
    myAddressLine: isPrivate ? myAddress : undefined,
    contactDirectory: directory,
    onContactsChanged: refreshContactDirectory,
    onRefreshApiStatus: refreshApiStatus,
    onMailboxStatus: (msg: string, kind: 'success' | 'error') => {
      setStatus(kind)
      setStatusMsg(msg)
      if (kind === 'success') toast.success(msg)
      else toast.error(msg)
    },
    encryptedPartner: showEncryptedPartnerPanel
      ? {
          partner,
          onPartnerChange: setPartner,
          sending,
          onHandshake: handleHandshake,
          onConnectAcceptPartner: handleConnectAcceptPartner,
          onConnectDeployment: handleConnectDeployment,
          onConnectAcceptForAddress: handleConnectAcceptForAddress,
          directory,
          isGroupMode: isGroup,
          groupMemberAddresses: activeGroup?.memberAddresses ?? [],
          connectedAddresses: apiStatus?.connectedAddresses ?? [],
          onHandshakeForAddress: handleHandshakeForAddress,
          myAddress: myAddress.trim(),
          onPeeringStatus: (msg) => {
            setStatusMsg(msg)
            if (msg.includes('gespeichert') || msg.includes('übernommen')) toast.success(msg)
            else if (msg.includes('fehl') || msg.includes('Kein')) toast.message(msg)
            else toast.info(msg)
          },
        }
      : undefined,
  } satisfies ChatViewTransportCardProps

  return (
    <div className="space-y-8">
      <ChatViewChatHeader
        isPrivate={isPrivate}
        encrypted={encrypted}
        apiStatus={apiStatus}
        onRefreshStatus={refreshApiStatus}
        basisUnreachable={basisUnreachable}
        statusCacheAgeMinutes={statusCacheAgeMinutes}
        offlineStatus={offlineStatus}
        meshBleConnected={meshtastic.connected}
        role={role}
        deviceTimeTrustWarn={deviceTimeTrustWarn}
        vaultBannerActions={vaultBannerActions}
        channelMode={channelMode}
        onChannelModeChange={onChannelModeChange}
        sendPath={{
          visible: isPrivate || !encrypted,
          channelMode: channelMode ?? 'private',
          encrypted,
          forcedTransport,
          onForcedTransportChange: setForcedTransport,
          onEncryptedChange: setEncrypted,
          myAddressLine: isPrivate ? myAddress : undefined,
          showAdhocTransport: uiCaps.showAdhocTransport,
          composerDelivery,
          onComposerDeliveryChange: setComposerDelivery,
        }}
        showDirectIotaPath={isPrivate && uiCaps.iotaTransportUi}
      />

      {uiCaps.showProminentOfflineQueueBanner ? (
        <ChatViewOfflineQueueStrip
          pending={offlineMailboxQueuePending}
          errorHint={offlineMailboxQueueErrorHint}
          onManualRefresh={refreshApiStatus}
          alwaysVisible
        />
      ) : null}

      {isGroup ? (
        <ChatViewGroupPanel
          contactDirectory={directory}
          myAddressLine={myAddress}
          onGroupsChanged={refreshMessengerGroups}
          onOpenPhonebook={() => setPhonebookOpen(true)}
        />
      ) : null}

      {channelMode != null && isPinnwandChannel(channelMode) ? (
        <ChatViewPinnwandContextCard apiStatus={apiStatus} myAddressLine={myAddress} />
      ) : null}

      {isPrivate && uiCaps.showPackageIdBanner ? (
        <ChatViewPackageIdBanner
          visible={packageIdMismatch && !!apiStatus?.packageId?.trim()}
          serverPackageId={apiStatus?.packageId?.trim() ?? ''}
          busy={packageIdBusy}
          onSyncToServer={() => void syncCanonicalPackageIdFromServer()}
        />
      ) : null}

      {(isPrivate || isGroup) && composerDelivery === 'chain' ? (
        <ChatViewTransportCard {...transportCardProps} />
      ) : null}

      {showPartnerSetupPanel ? (
        <ChatViewSetupPanel
          partner={partner}
          onPartnerChange={setPartner}
          sending={sending}
          onHandshake={handleHandshake}
          onConnect={handleConnectDeployment}
          isGroupMode={isGroup}
          groupMemberAddresses={activeGroup?.memberAddresses ?? []}
          connectedAddresses={apiStatus?.connectedAddresses ?? []}
          onHandshakeForAddress={handleHandshakeForAddress}
          encrypted={encrypted}
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
          directory={directory}
          refreshContactDirectory={refreshContactDirectory}
          contactBleAddress={contactBleAddress}
          onContactBleAddressChange={setContactBleAddress}
          contactBleUuid={contactBleUuid}
          onContactBleUuidChange={setContactBleUuid}
          contactMeshNodeId={contactMeshNodeId}
          onContactMeshNodeIdChange={setContactMeshNodeId}
          contactBleBusy={contactBleBusy}
          setContactBleBusy={setContactBleBusy}
          meshExportPw={meshExportPw}
          onMeshExportPwChange={setMeshExportPw}
          meshImportPw={meshImportPw}
          onMeshImportPwChange={setMeshImportPw}
          meshImportJson={meshImportJson}
          onMeshImportJsonChange={setMeshImportJson}
          meshSyncBusy={meshSyncBusy}
          setMeshSyncBusy={setMeshSyncBusy}
          meshSyncMsg={meshSyncMsg}
          setMeshSyncMsg={setMeshSyncMsg}
          role={role}
          activePackageId={apiStatus?.packageId}
          serverMailboxIdMasked={apiStatus?.mailboxIdMasked}
          mailboxConfigured={apiStatus?.mailboxConfigured}
          inboxPackageFilter={inboxPackageFilter}
          onInboxPackageFilterChange={setInboxPackageFilter}
          packageIdSuggestions={packageIdSuggestions}
          onRefreshPackageIdSuggestions={refreshPackageIdSuggestions}
          onApplyPackageIdBackend={applyPackageIdBackend}
          onApplyInboxPackageFilterOnly={applyInboxPackageFilterOnly}
          packageIdBusy={packageIdBusy}
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

      <section className="space-y-3 border-t border-border pt-6" aria-labelledby="chat-compose-heading">
        <h2 id="chat-compose-heading" className="text-sm font-semibold tracking-tight text-foreground">
          Nachricht verfassen
        </h2>
        <ChatViewSendPanel {...sendPanelProps} />
      </section>

      <ChatViewInboxPanel {...inboxPanelProps} />

      <ChatViewMorgPkgImportsSheet
        open={morgPkgImportsOpen}
        onOpenChange={setMorgPkgImportsOpen}
        records={morgPkgImports}
        contactDirectory={directory}
        onRemove={removeMorgPkgImport}
        onForwardItem={onForwardMorgPkgItem}
      />

      {(isPrivate || isGroup) ? (
        <ChatViewPhonebookSheet
          open={phonebookOpen}
          onOpenChange={setPhonebookOpen}
          directory={directory}
          refreshContactDirectory={refreshContactDirectory}
          connectedAddresses={apiStatus?.connectedAddresses ?? []}
          onSelectContact={applyPhonebookContact}
          teamMailboxCreateAllowed={canCreateTeamMailbox(apiStatus)}
          allowInitialProfileImport={canAccessEinsatzleitung(role)}
          onOpenSettings={onOpenSettings}
          setStatusMsg={(msg) => {
            setStatus('success')
            setStatusMsg(msg)
            setTimeout(() => setStatus('idle'), 5000)
          }}
        />
      ) : null}

      {uiCaps.expertTools ? <ChatViewRelaySubmitButton hideMenuTrigger /> : null}
    </div>
  )
}
