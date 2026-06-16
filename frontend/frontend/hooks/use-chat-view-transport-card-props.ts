'use client'

import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import type { ChatViewTransportCardProps } from '@/frontend/components/chat-view-transport-card'
import type { ChatViewEncryptedPartnerPanelProps } from '@/frontend/components/chat-view-encrypted-partner-panel'
import { asSendTransportChoice } from '@/frontend/features/messenger-ports'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
import type { MessagingPersistenceMode } from '@/frontend/lib/messaging-persistence-mode'

export type ChatViewTransportCardPropsDeps = {
  encrypted: boolean
  setEncrypted: (v: boolean) => void
  forcedTransport: ForcedTransport
  setForcedTransport: (v: ForcedTransport) => void
  messagingPersistenceMode: MessagingPersistenceMode
  setMessagingPersistenceMode: (v: MessagingPersistenceMode) => void
  isPrivate: boolean
  apiStatus: ApiStatus | null
  partner: string
  meshBleSupported?: boolean
  meshBleConnected?: boolean
  onOpenPartnerSetup?: () => void
  channelMode?: MessengerChatChannel
  myAddress: string
  directory: Record<string, ContactMeshEntryClient>
  refreshContactDirectory: () => void
  refreshApiStatus?: () => void | Promise<void>
  setStatus: (v: 'idle' | 'success' | 'error') => void
  setStatusMsg: (v: string) => void
  encryptedPartnerPanelProps: ChatViewEncryptedPartnerPanelProps | null
}

export function useChatViewTransportCardProps(
  deps: ChatViewTransportCardPropsDeps
): ChatViewTransportCardProps {
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
        ...asSendTransportChoice(
          deps.encrypted,
          deps.setEncrypted,
          deps.forcedTransport,
          deps.setForcedTransport,
          deps.messagingPersistenceMode,
          deps.setMessagingPersistenceMode
        ),
        isPrivate: deps.isPrivate,
        apiStatus: deps.apiStatus,
        partner: deps.partner,
        meshBleSupported: deps.meshBleSupported,
        meshBleConnected: deps.meshBleConnected,
        onOpenPartnerSetup: deps.onOpenPartnerSetup,
        channelMode: deps.channelMode,
        myAddressLine: deps.isPrivate ? deps.myAddress : undefined,
        contactDirectory: deps.directory,
        onContactsChanged: deps.refreshContactDirectory,
        onRefreshApiStatus: deps.refreshApiStatus,
        onMailboxStatus,
        encryptedPartner: deps.encryptedPartnerPanelProps ?? undefined,
      }) satisfies ChatViewTransportCardProps,
    [
      deps.encrypted,
      deps.setEncrypted,
      deps.forcedTransport,
      deps.setForcedTransport,
      deps.messagingPersistenceMode,
      deps.setMessagingPersistenceMode,
      deps.isPrivate,
      deps.apiStatus,
      deps.partner,
      deps.meshBleSupported,
      deps.meshBleConnected,
      deps.onOpenPartnerSetup,
      deps.channelMode,
      deps.myAddress,
      deps.directory,
      deps.refreshContactDirectory,
      deps.refreshApiStatus,
      deps.encryptedPartnerPanelProps,
      onMailboxStatus,
    ]
  )
}
