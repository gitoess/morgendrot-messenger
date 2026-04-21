'use client'

import { useEffect, useState } from 'react'
import { useChatViewCore } from '@/frontend/hooks/use-chat-view-core'
import { ChatViewMainContent } from '@/frontend/components/chat-view-main-content'
import type { ChatViewVaultBannerActions } from '@/frontend/components/chat-view-chat-header'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'

export type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'

interface ChatViewProps {
  variant: 'private-chat' | 'pinnwand'
  role?: string
  myAddress?: string
  vaultBannerActions?: ChatViewVaultBannerActions
}

/**
 * Messenger-Chat: Dashboard-Kachel „Nachrichten“ öffnet immer `private-chat`; gespeicherte Sessions
 * mit `pinnwand` setzen den Kanal beim Mount. Umschalten: **`channel`** → `isPrivate` fürs Core-Hook.
 */
export function ChatView({ variant, role = '', myAddress = '', vaultBannerActions }: ChatViewProps) {
  const [channel, setChannel] = useState<MessengerChatChannel>(() =>
    variant === 'pinnwand' ? 'pinnwand' : 'private'
  )
  useEffect(() => {
    setChannel(variant === 'pinnwand' ? 'pinnwand' : 'private')
  }, [variant])
  const isPrivate = channel === 'private'
  const core = useChatViewCore({ isPrivate, role, myAddress })
  return (
    <ChatViewMainContent
      {...core}
      vaultBannerActions={vaultBannerActions}
      channelMode={channel}
      onChannelModeChange={setChannel}
    />
  )
}
