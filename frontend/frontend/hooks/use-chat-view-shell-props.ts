'use client'

import { useMemo } from 'react'
import type { ChatViewChatHeaderProps } from '@/frontend/components/chat-view-chat-header'
import type { ChatViewMessengerPorts } from '@/frontend/features/messenger-ports'
import type { OfflineStatusSnapshot } from '@/frontend/hooks/use-offline-status'
import type { ChatViewVaultBannerActions } from '@/frontend/components/chat-view-chat-header'
import type { ChatViewMyWalletIdInlineProps } from '@/frontend/components/chat-view-my-wallet-id-inline'
import type { ChatViewSendPathCompactProps } from '@/frontend/components/chat-view-send-path-compact'
import { lookupContactEntry } from '@/frontend/lib/contact-display'

export type ChatViewShellPropsDeps = {
  messengerPorts: Pick<
    ChatViewMessengerPorts,
    | 'connectionStatusRead'
    | 'contactDirectoryRead'
    | 'composerSendPath'
    | 'composerDraft'
    | 'sendTransportChoice'
    | 'inboxFeedRead'
    | 'inboxViewUi'
    | 'offlineMailboxQueueRead'
    | 'meshDevice'
    | 'packageExpert'
    | 'shellRouting'
  >
  vaultBannerActions?: ChatViewVaultBannerActions
  offlineStatus?: OfflineStatusSnapshot
  showAdhocTransport: boolean
  showPackageIdBanner: boolean
  peeringQr?: Pick<ChatViewMyWalletIdInlineProps, 'displayName' | 'onPeeringImported' | 'onPeeringStatus'>
  onOpenSettings?: () => void
}

export function useChatViewShellProps(deps: ChatViewShellPropsDeps) {
  const {
    connectionStatusRead,
    contactDirectoryRead,
    composerSendPath,
    composerDraft,
    sendTransportChoice,
    inboxFeedRead,
    inboxViewUi,
    offlineMailboxQueueRead,
    meshDevice,
    packageExpert,
    shellRouting,
  } = deps.messengerPorts

  const sendPathProps: ChatViewSendPathCompactProps = useMemo(
    () => ({
      visible: shellRouting.channelMode !== 'notes',
      channelMode: shellRouting.channelMode,
      encrypted: sendTransportChoice.encrypted,
      forcedTransport: sendTransportChoice.forcedTransport,
      onForcedTransportChange: sendTransportChoice.onForcedTransportChange,
      onEncryptedChange: sendTransportChoice.onEncryptedChange,
      showAdhocTransport: deps.showAdhocTransport,
      composerDelivery: composerSendPath.composerDelivery,
      onComposerDeliveryChange: composerSendPath.onComposerDeliveryChange,
      apiStatus: connectionStatusRead.apiStatus,
      onChannelModeChange: shellRouting.onChannelModeChange,
    }),
    [
      shellRouting.channelMode,
      shellRouting.onChannelModeChange,
      deps.showAdhocTransport,
      connectionStatusRead.apiStatus,
      composerSendPath.composerDelivery,
      composerSendPath.onComposerDeliveryChange,
      sendTransportChoice.encrypted,
      sendTransportChoice.forcedTransport,
      sendTransportChoice.onForcedTransportChange,
      sendTransportChoice.onEncryptedChange,
    ]
  )

  const chatHeaderProps: ChatViewChatHeaderProps = useMemo(
    () => ({
      isPrivate: shellRouting.isPrivate,
      encrypted: sendTransportChoice.encrypted,
      apiStatus: connectionStatusRead.apiStatus,
      onRefreshStatus: connectionStatusRead.refreshApiStatus,
      basisUnreachable: connectionStatusRead.basisUnreachable ?? false,
      statusCacheAgeMinutes: connectionStatusRead.statusCacheAgeMinutes,
      statusPollAttempted: connectionStatusRead.statusPollAttempted,
      offlineStatus: deps.offlineStatus,
      meshBleConnected: meshDevice.connected,
      role: shellRouting.role,
      deviceTimeTrustWarn: connectionStatusRead.deviceTimeTrustWarn,
      vaultBannerActions: deps.vaultBannerActions,
      channelMode: shellRouting.channelMode,
      onChannelModeChange: shellRouting.onChannelModeChange,
      sendPath: sendPathProps,
      onOpenSettings: deps.onOpenSettings,
      pinnwandTabUnreadCount:
        shellRouting.channelMode !== 'pinnwand' ? inboxViewUi.inboxOverviewUnreadCounts?.lagebild ?? 0 : 0,
    }),
    [
      shellRouting.isPrivate,
      shellRouting.role,
      shellRouting.channelMode,
      shellRouting.onChannelModeChange,
      deps.vaultBannerActions,
      deps.offlineStatus,
      deps.onOpenSettings,
      meshDevice.connected,
      connectionStatusRead,
      sendTransportChoice.encrypted,
      sendPathProps,
      inboxViewUi.inboxOverviewUnreadCounts?.lagebild,
    ]
  )

  const offlineQueueStripProps = useMemo(
    () => ({
      pending: offlineMailboxQueueRead.pending,
      errorHint: offlineMailboxQueueRead.errorHint,
      onManualRefresh: connectionStatusRead.refreshApiStatus,
      alwaysVisible: true as const,
    }),
    [offlineMailboxQueueRead.pending, offlineMailboxQueueRead.errorHint, connectionStatusRead.refreshApiStatus]
  )

  const packageIdBannerProps = useMemo(
    () => ({
      visible:
        deps.showPackageIdBanner &&
        connectionStatusRead.packageIdMismatch &&
        !!connectionStatusRead.apiStatus?.packageId?.trim(),
      serverPackageId: connectionStatusRead.apiStatus?.packageId?.trim() ?? '',
      busy: packageExpert.packageIdBusy,
      onSyncToServer: () => void packageExpert.syncCanonicalPackageIdFromServer(),
    }),
    [
      deps.showPackageIdBanner,
      packageExpert.packageIdBusy,
      packageExpert.syncCanonicalPackageIdFromServer,
      connectionStatusRead.packageIdMismatch,
      connectionStatusRead.apiStatus?.packageId,
    ]
  )

  const pinnwandInboxStripProps = useMemo(
    () => ({
      contactDirectory: contactDirectoryRead.directory,
      apiStatus: connectionStatusRead.apiStatus,
      unreadCount:
        shellRouting.channelMode !== 'pinnwand' ? inboxViewUi.inboxOverviewUnreadCounts?.lagebild ?? 0 : 0,
    }),
    [
      contactDirectoryRead.directory,
      connectionStatusRead.apiStatus,
      shellRouting.channelMode,
      inboxViewUi.inboxOverviewUnreadCounts,
    ]
  )

  const phonebookShellProps = useMemo(
    () => ({
      directory: contactDirectoryRead.directory,
      connectedAddresses: [...connectionStatusRead.connectedAddresses],
    }),
    [contactDirectoryRead.directory, connectionStatusRead.connectedAddresses]
  )

  const groupPanelDirectory = contactDirectoryRead.directory

  const myDataPanelProps = useMemo(
    () => ({
      myAddressLine: inboxFeedRead.myAddress,
      displayName: deps.peeringQr?.displayName,
      myTelegramChatId: lookupContactEntry(contactDirectoryRead.directory, inboxFeedRead.myAddress)
        ?.telegramChatId,
      onPeeringImported: deps.peeringQr?.onPeeringImported,
      onPeeringStatus: deps.peeringQr?.onPeeringStatus,
    }),
    [
      inboxFeedRead.myAddress,
      contactDirectoryRead.directory,
      deps.peeringQr,
    ]
  )

  return {
    chatHeaderProps,
    offlineQueueStripProps,
    packageIdBannerProps,
    pinnwandInboxStripProps,
    phonebookShellProps,
    groupPanelDirectory,
    myDataPanelProps,
  }
}
