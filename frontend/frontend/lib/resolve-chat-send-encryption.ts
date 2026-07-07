'use client'

import type { ChatSendHandleOptions } from '@/frontend/features/send/chat-send-handle-options'

/** § H.3n B2.5 / MORG-EMERGENCY-SOS §9 — SOS immer unverschlüsselt (Schloss ignorieren). */
export function resolveChatSendEncryption(p: {
  encrypted: boolean
  emergencyWire?: ChatSendHandleOptions['emergencyWire']
}): boolean {
  if (p.emergencyWire === 'text' || p.emergencyWire === 'voice') return false
  return p.encrypted
}
