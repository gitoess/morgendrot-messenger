'use client'

import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import type { ChatViewEncryptedPartnerPanelProps } from '@/frontend/components/chat-view-encrypted-partner-panel'
import type { ChatViewMessengerPorts } from '@/frontend/features/messenger-ports'

export type ChatViewEncryptedPartnerPanelPropsDeps = {
  messengerPorts: Pick<
    ChatViewMessengerPorts,
    | 'sendTransportRead'
    | 'composerPartner'
    | 'composerSendPath'
    | 'inboxFeedRead'
    | 'contactDirectoryRead'
    | 'connectionStatusRead'
    | 'handshakeActions'
  >
  sending: boolean
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
    inboxFeedRead,
    contactDirectoryRead,
    connectionStatusRead,
    handshakeActions,
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

  const onPeeringStatus = useCallback(
    (msg: string) => {
      deps.setStatusMsg(msg)
      if (msg.includes('gespeichert') || msg.includes('übernommen')) toast.success(msg)
      else if (msg.includes('fehl') || msg.includes('Kein')) toast.message(msg)
      else toast.info(msg)
    },
    [deps.setStatusMsg]
  )

  const encryptedPartnerPanelProps: ChatViewEncryptedPartnerPanelProps | null = showEncryptedPartnerPanel
    ? {
        partner: composerPartner.partner,
        onPartnerChange: composerPartner.onPartnerChange,
        sending: deps.sending,
        onHandshake: handshakeActions.onHandshake,
        onConnectAcceptPartner: handshakeActions.onConnectAcceptPartner,
        onConnectDeployment: handshakeActions.onConnectDeployment,
        onConnectAcceptForAddress: handshakeActions.onConnectAcceptForAddress,
        directory: contactDirectoryRead.directory,
        isGroupMode: composerSendPath.isGroup,
        groupMemberAddresses: deps.activeGroupMemberAddresses ?? [],
        connectedAddresses: [...connectionStatusRead.connectedAddresses],
        onHandshakeForAddress: handshakeActions.onHandshakeForAddress,
        myAddress: inboxFeedRead.myAddress.trim(),
        onPeeringStatus,
      }
    : null

  return { showEncryptedPartnerPanel, encryptedPartnerPanelProps }
}
