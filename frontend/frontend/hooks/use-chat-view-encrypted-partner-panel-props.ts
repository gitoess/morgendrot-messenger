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
  >
  onPartnerChange: (v: string) => void
  sending: boolean
  onHandshake: () => void
  onConnectAcceptPartner: () => void
  onConnectDeployment: () => void
  onConnectAcceptForAddress: (address: string) => void | Promise<void>
  activeGroupMemberAddresses?: string[]
  onHandshakeForAddress: (address: string) => void | Promise<void>
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
        onPartnerChange: deps.onPartnerChange,
        sending: deps.sending,
        onHandshake: deps.onHandshake,
        onConnectAcceptPartner: deps.onConnectAcceptPartner,
        onConnectDeployment: deps.onConnectDeployment,
        onConnectAcceptForAddress: deps.onConnectAcceptForAddress,
        directory: contactDirectoryRead.directory,
        isGroupMode: composerSendPath.isGroup,
        groupMemberAddresses: deps.activeGroupMemberAddresses ?? [],
        connectedAddresses: [...connectionStatusRead.connectedAddresses],
        onHandshakeForAddress: deps.onHandshakeForAddress,
        myAddress: inboxFeedRead.myAddress.trim(),
        onPeeringStatus,
      }
    : null

  return { showEncryptedPartnerPanel, encryptedPartnerPanelProps }
}
