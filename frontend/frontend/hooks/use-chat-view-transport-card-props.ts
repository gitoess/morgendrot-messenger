'use client'

import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import type { ChatViewTransportCardProps } from '@/frontend/components/chat-view-transport-card'
import type { ChatViewEncryptedPartnerPanelProps } from '@/frontend/components/chat-view-encrypted-partner-panel'
import type { ChatViewMessengerPorts } from '@/frontend/features/messenger-ports'

export type ChatViewTransportCardPropsDeps = {
  messengerPorts: Pick<
    ChatViewMessengerPorts,
    | 'sendTransportChoice'
    | 'composerPartner'
    | 'composerSendPath'
    | 'inboxFeedRead'
    | 'contactDirectoryRead'
    | 'connectionStatusRead'
  >
  meshBleSupported?: boolean
  meshBleConnected?: boolean
  onOpenPartnerSetup?: () => void
  refreshContactDirectory: () => void
  refreshApiStatus?: () => void | Promise<void>
  setStatus: (v: 'idle' | 'success' | 'error') => void
  setStatusMsg: (v: string) => void
  encryptedPartnerPanelProps: ChatViewEncryptedPartnerPanelProps | null
}

export function useChatViewTransportCardProps(
  deps: ChatViewTransportCardPropsDeps
): ChatViewTransportCardProps {
  const {
    sendTransportChoice,
    composerPartner,
    composerSendPath,
    inboxFeedRead,
    contactDirectoryRead,
    connectionStatusRead,
  } = deps.messengerPorts

  const onMailboxStatus = useCallback(
    (msg: string, kind: 'success' | 'error') => {
      deps.setStatus(kind)
      deps.setStatusMsg(msg)
      if (kind === 'success') toast.success(msg)
      else toast.error(msg)
    },
    [deps.setStatus, deps.setStatusMsg]
  )

  return useMemo(
    () =>
      ({
        ...sendTransportChoice,
        isPrivate: composerSendPath.isPrivate,
        apiStatus: connectionStatusRead.apiStatus,
        partner: composerPartner.partner,
        meshBleSupported: deps.meshBleSupported,
        meshBleConnected: deps.meshBleConnected,
        onOpenPartnerSetup: deps.onOpenPartnerSetup,
        channelMode: composerSendPath.channelMode,
        myAddressLine: composerSendPath.isPrivate ? inboxFeedRead.myAddress : undefined,
        contactDirectory: contactDirectoryRead.directory,
        onContactsChanged: deps.refreshContactDirectory,
        onRefreshApiStatus: deps.refreshApiStatus,
        onMailboxStatus,
        encryptedPartner: deps.encryptedPartnerPanelProps ?? undefined,
      }) satisfies ChatViewTransportCardProps,
    [
      sendTransportChoice,
      composerSendPath.isPrivate,
      composerSendPath.channelMode,
      connectionStatusRead.apiStatus,
      composerPartner.partner,
      deps.meshBleSupported,
      deps.meshBleConnected,
      deps.onOpenPartnerSetup,
      inboxFeedRead.myAddress,
      contactDirectoryRead.directory,
      deps.refreshContactDirectory,
      deps.refreshApiStatus,
      deps.encryptedPartnerPanelProps,
      onMailboxStatus,
    ]
  )
}
