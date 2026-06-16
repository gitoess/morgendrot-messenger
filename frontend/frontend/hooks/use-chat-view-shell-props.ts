'use client'

import { useMemo } from 'react'
import type { ChatViewChatHeaderProps } from '@/frontend/components/chat-view-chat-header'
import type { ChatViewMessengerPorts } from '@/frontend/features/messenger-ports'
import type { OfflineStatusSnapshot } from '@/frontend/hooks/use-offline-status'
import type { ChatViewVaultBannerActions } from '@/frontend/components/chat-view-chat-header'

export type ChatViewShellPropsDeps = {
  messengerPorts: Pick<
    ChatViewMessengerPorts,
    | 'connectionStatusRead'
    | 'contactDirectoryRead'
    | 'composerSendPath'
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
}

export function useChatViewShellProps(deps: ChatViewShellPropsDeps) {
  const {
    connectionStatusRead,
    contactDirectoryRead,
    composerSendPath,
    sendTransportChoice,
    inboxFeedRead,
    inboxViewUi,
    offlineMailboxQueueRead,
    meshDevice,
    packageExpert,
    shellRouting,
  } = deps.messengerPorts

  const chatHeaderProps: ChatViewChatHeaderProps = useMemo(
    () => ({
      isPrivate: shellRouting.isPrivate,
      encrypted: sendTransportChoice.encrypted,
      apiStatus: connectionStatusRead.apiStatus,
      onRefreshStatus: connectionStatusRead.refreshApiStatus,
      basisUnreachable: connectionStatusRead.basisUnreachable ?? false,
      statusCacheAgeMinutes: connectionStatusRead.statusCacheAgeMinutes,
      offlineStatus: deps.offlineStatus,
      meshBleConnected: meshDevice.connected,
      role: shellRouting.role,
      deviceTimeTrustWarn: connectionStatusRead.deviceTimeTrustWarn,
      vaultBannerActions: deps.vaultBannerActions,
      channelMode: shellRouting.channelMode,
      onChannelModeChange: shellRouting.onChannelModeChange,
      sendPath: {
        visible: shellRouting.isPrivate || shellRouting.isGroup || !sendTransportChoice.encrypted,
        channelMode: shellRouting.channelMode,
        encrypted: sendTransportChoice.encrypted,
        forcedTransport: sendTransportChoice.forcedTransport,
        onForcedTransportChange: sendTransportChoice.onForcedTransportChange,
        onEncryptedChange: sendTransportChoice.onEncryptedChange,
        myAddressLine: shellRouting.isPrivate ? inboxFeedRead.myAddress : undefined,
        showAdhocTransport: deps.showAdhocTransport,
        composerDelivery: composerSendPath.composerDelivery,
        onComposerDeliveryChange: composerSendPath.onComposerDeliveryChange,
        apiStatus: connectionStatusRead.apiStatus,
      },
      pinnwandTabUnreadCount:
        shellRouting.channelMode !== 'pinnwand' ? inboxViewUi.inboxOverviewUnreadCounts?.lagebild ?? 0 : 0,
    }),
    [
      shellRouting.isPrivate,
      shellRouting.isGroup,
      shellRouting.role,
      shellRouting.channelMode,
      shellRouting.onChannelModeChange,
      deps.vaultBannerActions,
      deps.offlineStatus,
      meshDevice.connected,
      connectionStatusRead.refreshApiStatus,
      deps.showAdhocTransport,
      connectionStatusRead,
      composerSendPath,
      sendTransportChoice,
      inboxFeedRead.myAddress,
      inboxViewUi.inboxOverviewUnreadCounts,
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

  return {
    chatHeaderProps,
    offlineQueueStripProps,
    packageIdBannerProps,
    pinnwandInboxStripProps,
    phonebookShellProps,
    groupPanelDirectory,
  }
}
