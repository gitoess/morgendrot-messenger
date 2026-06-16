'use client'

import { useEffect, useState } from 'react'
import { useChatViewCore } from '@/frontend/hooks/use-chat-view-core'
import { ChatViewMainContent } from '@/frontend/components/chat-view-main-content'
import type { ChatViewVaultBannerActions } from '@/frontend/components/chat-view-chat-header'
import { isDialogChannel, type MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
import type { PendingHandshakesPollState } from '@/frontend/hooks/use-chat-view-pending-handshakes'

export type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'

interface ChatViewProps {
  variant: 'private-chat' | 'pinnwand'
  role?: string
  myAddress?: string
  vaultBannerActions?: ChatViewVaultBannerActions
  /** App-weites Polling (Dashboard) — Toast/Badge auch ohne geöffneten Posteingang. */
  pendingHandshakes?: PendingHandshakesPollState
  /** Boss/Kommandant: zentraler Einsatzleitung-Tab. */
  onOpenEinsatzleitung?: () => void
  /** Bottom-Nav: Telefonbuch-Sheet öffnen. */
  phonebookNavRequest?: number
  onOpenSettings?: () => void
}

/**
 * Messenger-Chat: Dashboard-Kachel „Nachrichten“ öffnet immer `private-chat`; gespeicherte Sessions
 * mit `pinnwand` setzen den Kanal beim Mount. Umschalten: **`channel`** → `isPrivate` fürs Core-Hook.
 */
export function ChatView({ variant, role = '', myAddress = '', vaultBannerActions, pendingHandshakes, onOpenEinsatzleitung, phonebookNavRequest, onOpenSettings }: ChatViewProps) {
  const [channel, setChannel] = useState<MessengerChatChannel>(() =>
    variant === 'pinnwand' ? 'pinnwand' : 'private'
  )
  useEffect(() => {
    setChannel(variant === 'pinnwand' ? 'pinnwand' : 'private')
  }, [variant])
  const isPrivate = isDialogChannel(channel)
  const core = useChatViewCore({ channelMode: channel, role, myAddress })
  return (
    <ChatViewMainContent
      {...core}
      vaultBannerActions={vaultBannerActions}
      onChannelModeChange={setChannel}
      pendingHandshakes={pendingHandshakes}
      onOpenEinsatzleitung={onOpenEinsatzleitung}
      phonebookNavRequest={phonebookNavRequest}
      onOpenSettings={onOpenSettings}
    />
  )
}
