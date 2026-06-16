'use client'

import { useMemo } from 'react'
import type { ChatViewChatHeaderProps } from '@/frontend/components/chat-view-chat-header'
import type { ChatViewMessengerPorts } from '@/frontend/features/messenger-ports'
import type { OfflineStatusSnapshot } from '@/frontend/hooks/use-offline-status'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import type { ComposerDeliveryChannel } from '@/frontend/lib/composer-delivery-channel'
import type { ChatViewVaultBannerActions } from '@/frontend/components/chat-view-chat-header'

export type ChatViewShellPropsDeps = {
  messengerPorts: Pick<
    ChatViewMessengerPorts,
    | 'connectionStatusRead'
    | 'contactDirectoryRead'
    | 'composerSendPath'
    | 'sendTransportRead'
    | 'sendTransportChoice'
    | 'inboxFeedRead'
    | 'inboxViewUi'
    | 'offlineMailboxQueueRead'
  >
  isPrivate: boolean
  isGroup: boolean
  encrypted: boolean
  role: string
  forcedTransport: ForcedTransport
  setForcedTransport: (t: ForcedTransport) => void
  setEncrypted: (v: boolean) => void
  composerDelivery: ComposerDeliveryChannel
  setComposerDelivery: (d: ComposerDeliveryChannel) => void
  channelMode?: MessengerChatChannel
  onChannelModeChange?: (c: MessengerChatChannel) => void
  vaultBannerActions?: ChatViewVaultBannerActions
  offlineStatus?: OfflineStatusSnapshot
  meshBleConnected: boolean
  refreshApiStatus?: () => void | Promise<void>
  showAdhocTransport: boolean
  packageIdBusy: boolean
  syncCanonicalPackageIdFromServer: () => void | Promise<void>
  showPackageIdBanner: boolean
}

export function useChatViewShellProps(deps: ChatViewShellPropsDeps) {
  const {
    connectionStatusRead,
    contactDirectoryRead,
    composerSendPath,
    sendTransportRead,
    inboxFeedRead,
    inboxViewUi,
    offlineMailboxQueueRead,
  } = deps.messengerPorts

  const chatHeaderProps: ChatViewChatHeaderProps = useMemo(
    () => ({
      isPrivate: deps.isPrivate,
      encrypted: deps.encrypted,
      apiStatus: connectionStatusRead.apiStatus,
      onRefreshStatus: deps.refreshApiStatus,
      basisUnreachable: connectionStatusRead.basisUnreachable ?? false,
      statusCacheAgeMinutes: connectionStatusRead.statusCacheAgeMinutes,
      offlineStatus: deps.offlineStatus,
      meshBleConnected: deps.meshBleConnected,
      role: deps.role,
      deviceTimeTrustWarn: connectionStatusRead.deviceTimeTrustWarn,
      vaultBannerActions: deps.vaultBannerActions,
      channelMode: deps.channelMode,
      onChannelModeChange: deps.onChannelModeChange,
      sendPath: {
        visible: deps.isPrivate || deps.isGroup || !deps.encrypted,
        channelMode: deps.channelMode ?? 'private',
        encrypted: deps.encrypted,
        forcedTransport: deps.forcedTransport,
        onForcedTransportChange: deps.setForcedTransport,
        onEncryptedChange: deps.setEncrypted,
        myAddressLine: deps.isPrivate ? inboxFeedRead.myAddress : undefined,
        showAdhocTransport: deps.showAdhocTransport,
        composerDelivery: deps.composerDelivery,
        onComposerDeliveryChange: deps.setComposerDelivery,
        apiStatus: connectionStatusRead.apiStatus,
      },
      pinnwandTabUnreadCount:
        deps.channelMode !== 'pinnwand' ? inboxViewUi.inboxOverviewUnreadCounts?.lagebild ?? 0 : 0,
    }),
    [
      deps.isPrivate,
      deps.isGroup,
      deps.encrypted,
      deps.role,
      deps.forcedTransport,
      deps.setForcedTransport,
      deps.setEncrypted,
      deps.composerDelivery,
      deps.setComposerDelivery,
      deps.channelMode,
      deps.onChannelModeChange,
      deps.vaultBannerActions,
      deps.offlineStatus,
      deps.meshBleConnected,
      deps.refreshApiStatus,
      deps.showAdhocTransport,
      connectionStatusRead,
      inboxFeedRead.myAddress,
      inboxViewUi.inboxOverviewUnreadCounts,
    ]
  )

  const offlineQueueStripProps = useMemo(
    () => ({
      pending: offlineMailboxQueueRead.pending,
      errorHint: offlineMailboxQueueRead.errorHint,
      onManualRefresh: deps.refreshApiStatus,
      alwaysVisible: true as const,
    }),
    [offlineMailboxQueueRead.pending, offlineMailboxQueueRead.errorHint, deps.refreshApiStatus]
  )

  const packageIdBannerProps = useMemo(
    () => ({
      visible:
        deps.showPackageIdBanner &&
        connectionStatusRead.packageIdMismatch &&
        !!connectionStatusRead.apiStatus?.packageId?.trim(),
      serverPackageId: connectionStatusRead.apiStatus?.packageId?.trim() ?? '',
      busy: deps.packageIdBusy,
      onSyncToServer: () => void deps.syncCanonicalPackageIdFromServer(),
    }),
    [
      deps.showPackageIdBanner,
      deps.packageIdBusy,
      deps.syncCanonicalPackageIdFromServer,
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
