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
import type { ChatViewCoreState } from '@/frontend/hooks/use-chat-view-core'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
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
import { canFetchHandshakesViaDirectIota } from '@/frontend/lib/direct-iota-handshake-fetch'
import { hasCachedHandshakeOffers } from '@/frontend/lib/handshake-offers-cache'
import type { PendingHandshakesPollState } from '@/frontend/hooks/use-chat-view-pending-handshakes'
import { useOfflineStatus } from '@/frontend/hooks/use-offline-status'
import { useChatViewSendPanelProps } from '@/frontend/hooks/use-chat-view-send-panel-props'
import { useChatViewSetupPanelProps } from '@/frontend/hooks/use-chat-view-setup-panel-props'
import { useChatViewPinnwandFeedPanelProps } from '@/frontend/hooks/use-chat-view-pinnwand-feed-panel-props'
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
    shellRouting,
    connectionStatusRead,
    contactDirectoryRead,
    inboxViewUi,
    inboxPanelRead,
    inboxPreviewRead,
    morgPkgArchive,
    meshSendOptions,
    composerDraft,
    composerPartner,
    composerSendPath,
    sendTransportRead,
    sendTransportChoice,
    sendMeshFunkOptions,
    sendActions,
    inboxActions,
    packageExpert,
    meshSetup,
  } = messengerPorts
  const {
    channelMode,
    isPrivate,
    isGroup,
    activeGroup,
    refreshMessengerGroups,
    role,
    myAddress,
  } = shellRouting
  const {
    apiStatus,
    basisUnreachable,
    statusCacheAgeMinutes,
    deviceTimeTrustWarn,
    connectedAddresses: handshakeConnectedAddresses,
  } = connectionStatusRead
  const { directory, isMeshVerifiedForAddress, refreshContactDirectory } = contactDirectoryRead
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
  } = inboxViewUi

  const { enabled: clientExpertMode } = useMessengerClientExpertMode()

  const [phonebookOpen, setPhonebookOpen] = useState(false)
  useEffect(() => {
    if (phonebookOpen) refreshContactDirectory()
  }, [phonebookOpen, refreshContactDirectory])

  useEffect(() => {
    if (phonebookNavRequest != null && phonebookNavRequest > 0) setPhonebookOpen(true)
  }, [phonebookNavRequest])

  const pendingHandshakeRefreshKey = `${[...handshakeConnectedAddresses].join('|')}|${apiStatus?.locked === true ? 'locked' : 'open'}`

  const composeReply = useMemo(
    () => ({
      onChannelModeChange,
      setForcedTransport,
      setComposerDelivery,
      setPartner,
      setRecipient,
      setEncrypted,
      setComposerMailboxObjectId: composerSendPath.onComposerMailboxObjectIdChange,
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

  const applyPhonebookContact = useCallback(
    (storageKey: string, entry: ContactMeshEntryClient) => {
      const applied = applyPhonebookContactToComposer(storageKey, entry, {
        setPartner,
        setRecipient,
        setMeshPlaintextNodeId,
        setMeshPlaintextToNodeEnabled,
        setContactBleUuid: meshSetup.onContactBleUuidChange,
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
      meshSetup.onContactBleUuidChange,
      selectInboxPartnerForSend,
      setComposerDelivery,
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
    vaultBannerActions,
    offlineStatus,
    showAdhocTransport: uiCaps.showAdhocTransport,
    showPackageIdBanner: uiCaps.showPackageIdBanner,
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
  })

  const { sendPanelProps } = useChatViewSendPanelProps({
    messengerPorts: panelMessengerPorts,
    activeGroup,
    expertTools: uiCaps.expertTools,
    pinnwandBroadcastAddress: pinnwandCaps.broadcastAddress,
    canPostToPinnwand: pinnwandCaps.canPost,
    vaultBannerActions,
    onOpenPhonebook: isPrivate || isGroup ? () => setPhonebookOpen(true) : undefined,
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

      {channelMode === 'private' && composerDelivery === 'chain' ? (
        <ChatViewTransportCard {...transportCardProps} />
      ) : null}

      {showPartnerSetupPanel ? <ChatViewSetupPanel {...setupPanelProps} /> : null}

      <ContactAddAliasDialog {...contactAliasDialog} />

      {onPinnwandTab ? (
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

          {inboxOverviewChipsVisible && (inboxPanelRead.inboxUnreadThreadOptions?.length ?? 0) > 0 ? (
            <ChatViewInboxUnreadThreadsStrip
              threads={[...(inboxPanelRead.inboxUnreadThreadOptions ?? [])]}
              onOpenThread={(address) => {
                setInboxOverviewCategory('direkt')
                selectInboxPartnerForSend(address)
              }}
            />
          ) : null}

          <ChatViewInboxPanel {...inboxPanelProps} />
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
    </div>
  )
}
