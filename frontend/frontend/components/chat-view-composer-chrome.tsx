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

/** SOS direkt über dem Composer (Sendepfad im Kopf). */
export function ChatViewComposerChrome(p: ChatViewComposerChromeProps) {
  const { sosEmergency, className } = p
  if (!sosEmergency?.visible) return null

  return (
    <div className={cn('rounded-xl border border-border/50 bg-card/40 p-3 sm:p-4', className)}>
      {sosEmergency.visible ? (
        <ChatViewSosEmergencyButton {...sosEmergency} variant="hero" className="shadow-md" />
      ) : null}
    </div>
  )
}
