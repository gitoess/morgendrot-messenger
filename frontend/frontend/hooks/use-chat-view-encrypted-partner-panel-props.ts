'use client'

import { useMemo } from 'react'
import type { ChatViewEncryptedPartnerPanelProps } from '@/frontend/components/chat-view-encrypted-partner-panel'
import type { ChatViewMessengerPorts } from '@/frontend/features/messenger-ports'

export type ChatViewEncryptedPartnerPanelPropsDeps = {
  messengerPorts: Pick<
    ChatViewMessengerPorts,
    | 'sendTransportRead'
    | 'composerPartner'
    | 'composerSendPath'
    | 'contactDirectoryRead'
    | 'connectionStatusRead'
    | 'handshakeActions'
    | 'attachmentBar'
  >
  activeGroupMemberAddresses?: string[]
  setStatusMsg: (v: string) => void
}

export function useChatViewEncryptedPartnerPanelProps(deps: ChatViewEncryptedPartnerPanelPropsDeps): {
  showEncryptedPartnerPanel: boolean
  encryptedPartnerPanelProps: ChatViewEncryptedPartnerPanelProps | null
} {
  const {
    sendTransportRead,
    composerPartner,
    composerSendPath,
    contactDirectoryRead,
    connectionStatusRead,
    handshakeActions,
    attachmentBar,
  } = deps.messengerPorts

  const showEncryptedPartnerPanel = useMemo(
    () =>
      (composerSendPath.channelMode === 'private' || composerSendPath.isGroup) &&
      composerSendPath.composerDelivery === 'chain' &&
      sendTransportRead.encrypted &&
      sendTransportRead.forcedTransport === 'internet',
    [
      composerSendPath.channelMode,
      composerSendPath.isGroup,
      composerSendPath.composerDelivery,
      sendTransportRead.encrypted,
      sendTransportRead.forcedTransport,
    ]
  )

  const encryptedPartnerPanelProps: ChatViewEncryptedPartnerPanelProps | null = showEncryptedPartnerPanel
    ? {
        partner: composerPartner.partner,
        onPartnerChange: composerPartner.onPartnerChange,
        sending: attachmentBar.sending,
        onHandshake: handshakeActions.onHandshake,
        onConnectAcceptPartner: handshakeActions.onConnectAcceptPartner,
        onConnectDeployment: handshakeActions.onConnectDeployment,
        onConnectAcceptForAddress: handshakeActions.onConnectAcceptForAddress,
        directory: contactDirectoryRead.directory,
        isGroupMode: composerSendPath.isGroup,
        groupMemberAddresses: deps.activeGroupMemberAddresses ?? [],
        connectedAddresses: [...connectionStatusRead.connectedAddresses],
        onHandshakeForAddress: handshakeActions.onHandshakeForAddress,
      }
    : null

  return { showEncryptedPartnerPanel, encryptedPartnerPanelProps }
}
