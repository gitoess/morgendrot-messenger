'use client'

import { useMemo } from 'react'
import type { ChatViewChatHeaderProps } from '@/frontend/components/chat-view-chat-header'
import type { ChatViewMessengerPorts } from '@/frontend/features/messenger-ports'
import type { OfflineStatusSnapshot } from '@/frontend/hooks/use-offline-status'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
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
  >
  isPrivate: boolean
  isGroup: boolean
  role: string
  channelMode?: MessengerChatChannel
  onChannelModeChange?: (c: MessengerChatChannel) => void
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
  } = deps.messengerPorts

  const chatHeaderProps: ChatViewChatHeaderProps = useMemo(
    () => ({
      isPrivate: deps.isPrivate,
      encrypted: sendTransportChoice.encrypted,
      apiStatus: connectionStatusRead.apiStatus,
      onRefreshStatus: connectionStatusRead.refreshApiStatus,
      basisUnreachable: connectionStatusRead.basisUnreachable ?? false,
      statusCacheAgeMinutes: connectionStatusRead.statusCacheAgeMinutes,
      offlineStatus: deps.offlineStatus,
      meshBleConnected: meshDevice.connected,
      role: deps.role,
      deviceTimeTrustWarn: connectionStatusRead.deviceTimeTrustWarn,
      vaultBannerActions: deps.vaultBannerActions,
      channelMode: deps.channelMode,
      onChannelModeChange: deps.onChannelModeChange,
      sendPath: {
        visible: deps.isPrivate || deps.isGroup || !sendTransportChoice.encrypted,
        channelMode: deps.channelMode ?? 'private',
        encrypted: sendTransportChoice.encrypted,
        forcedTransport: sendTransportChoice.forcedTransport,
        onForcedTransportChange: sendTransportChoice.onForcedTransportChange,
        onEncryptedChange: sendTransportChoice.onEncryptedChange,
        myAddressLine: deps.isPrivate ? inboxFeedRead.myAddress : undefined,
        showAdhocTransport: deps.showAdhocTransport,
        composerDelivery: composerSendPath.composerDelivery,
        onComposerDeliveryChange: composerSendPath.onComposerDeliveryChange,
        apiStatus: connectionStatusRead.apiStatus,
      },
      pinnwandTabUnreadCount:
        deps.channelMode !== 'pinnwand' ? inboxViewUi.inboxOverviewUnreadCounts?.lagebild ?? 0 : 0,
    }),
    [
      deps.isPrivate,
      deps.isGroup,
      deps.role,
      deps.channelMode,
      deps.onChannelModeChange,
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
        deps.channelMode !== 'pinnwand' ? inboxViewUi.inboxOverviewUnreadCounts?.lagebild ?? 0 : 0,
    }),
    [
      contactDirectoryRead.directory,
      connectionStatusRead.apiStatus,
      deps.channelMode,
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
