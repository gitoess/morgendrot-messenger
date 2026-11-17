'use client'

import { cn } from '@/lib/utils'
import {
  ChatViewSosEmergencyButton,
  type ChatViewSosEmergencyButtonProps,
} from '@/frontend/components/chat-view-sos-emergency-button'
import {
  ChatViewSendPathCompact,
  type ChatViewSendPathCompactProps,
} from '@/frontend/components/chat-view-send-path-compact'

export type ChatViewComposerChromeProps = {
  sendPath?: ChatViewSendPathCompactProps | null
  sosEmergency?: ChatViewSosEmergencyButtonProps
  className?: string
}

/** SOS klein unter dem Composer. */
export function ChatViewComposerChrome(p: ChatViewComposerChromeProps) {
  const { sosEmergency, className } = p
  if (!sosEmergency?.visible) return null

  return (
    <div className={cn('flex justify-end px-1 pt-1', className)}>
      <ChatViewSosEmergencyButton {...sosEmergency} variant="compact" />
    </div>
  )
}
