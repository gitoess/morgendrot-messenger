'use client'

import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import type { ChatViewEncryptedPartnerPanelProps } from '@/frontend/components/chat-view-encrypted-partner-panel'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import type { ComposerDeliveryChannel } from '@/frontend/lib/composer-delivery-channel'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'

export type ChatViewEncryptedPartnerPanelPropsDeps = {
  channelMode?: MessengerChatChannel
  isGroup: boolean
  composerDelivery: ComposerDeliveryChannel
  encrypted: boolean
  forcedTransport: ForcedTransport
  partner: string
  onPartnerChange: (v: string) => void
  sending: boolean
  onHandshake: () => void
  onConnectAcceptPartner: () => void
  onConnectDeployment: () => void
  onConnectAcceptForAddress: (address: string) => void | Promise<void>
  directory: Record<string, ContactMeshEntryClient>
  activeGroupMemberAddresses?: string[]
  connectedAddresses?: string[]
  onHandshakeForAddress: (address: string) => void | Promise<void>
  myAddress: string
  setStatusMsg: (v: string) => void
}

export function useChatViewEncryptedPartnerPanelProps(deps: ChatViewEncryptedPartnerPanelPropsDeps): {
  showEncryptedPartnerPanel: boolean
  encryptedPartnerPanelProps: ChatViewEncryptedPartnerPanelProps | null
} {
  const showEncryptedPartnerPanel = useMemo(
    () =>
      (deps.channelMode === 'private' || deps.isGroup) &&
      deps.composerDelivery === 'chain' &&
      deps.encrypted &&
      deps.forcedTransport === 'internet',
    [deps.channelMode, deps.isGroup, deps.composerDelivery, deps.encrypted, deps.forcedTransport]
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
        partner: deps.partner,
        onPartnerChange: deps.onPartnerChange,
        sending: deps.sending,
        onHandshake: deps.onHandshake,
        onConnectAcceptPartner: deps.onConnectAcceptPartner,
        onConnectDeployment: deps.onConnectDeployment,
        onConnectAcceptForAddress: deps.onConnectAcceptForAddress,
        directory: deps.directory,
        isGroupMode: deps.isGroup,
        groupMemberAddresses: deps.activeGroupMemberAddresses ?? [],
        connectedAddresses: deps.connectedAddresses ?? [],
        onHandshakeForAddress: deps.onHandshakeForAddress,
        myAddress: deps.myAddress.trim(),
        onPeeringStatus,
      }
    : null

  return { showEncryptedPartnerPanel, encryptedPartnerPanelProps }
}
