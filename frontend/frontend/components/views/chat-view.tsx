'use client'

import { useChatViewCore } from '@/frontend/hooks/use-chat-view-core'
import { ChatViewMainContent } from '@/frontend/components/chat-view-main-content'

interface ChatViewProps {
  variant: 'private-chat' | 'pinnwand'
  role?: string
  myAddress?: string
}

/**
 * Messenger-Chat: nur Verdrahtung (Variante → Core-Hook → Hauptlayout).
 */
export function ChatView({ variant, role = '', myAddress = '' }: ChatViewProps) {
  const isPrivate = variant === 'private-chat'
  const core = useChatViewCore({ isPrivate, role, myAddress })
  return <ChatViewMainContent {...core} />
}
