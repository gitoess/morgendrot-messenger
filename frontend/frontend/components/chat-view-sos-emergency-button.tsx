'use client'

import { cn } from '@/lib/utils'
import type { ChatSendHandleOptions } from '@/frontend/features/send/chat-send-handle-options'

export type ChatViewSosEmergencyButtonProps = {
  visible: boolean
  sending?: boolean
  message: string
  onSend: (opts?: ChatSendHandleOptions) => void | Promise<void>
  variant?: 'compact' | 'hero'
  className?: string
}

function prepareSttDictation(): void {
  const composer = document.getElementById('chat-composer-message') as HTMLTextAreaElement | null
  composer?.focus()
  composer?.click()
  window.alert(
    'Sprach-zu-Text: OS-Diktat jetzt manuell starten.\n\n' +
      'Windows: Win+H manuell drücken\n' +
      'Android: Mikrofon in der Tastaturleiste manuell tippen'
  )
}

export function ChatViewSosEmergencyButton(p: ChatViewSosEmergencyButtonProps) {
  if (!p.visible) return null

  const hero = p.variant === 'hero'

  return (
    <button
      type="button"
      disabled={p.sending}
      title="SOS — Hilferuf (Text), MORG_EMERGENCY_V1. Kein automatischer 112-Ruf."
      onClick={() => {
        if (!p.message.trim()) {
          prepareSttDictation()
          return
        }
        if (
          !window.confirm(
            'Echten Hilferuf (SOS) senden?\n\n' +
              'Die Nachricht geht an deinen Chat-Empfänger (Funk oder Online — wie eingestellt), mit Notfall-Kennzeichnung MORG_EMERGENCY_V1. ' +
              'Kein automatischer 112-Ruf.\n\n' +
              'Nur nutzen, wenn wirklich Hilfe nötig ist.'
          )
        ) {
          return
        }
        void p.onSend({ emergencyWire: 'text' })
      }}
      className={cn(
        'border-2 border-red-600/70 bg-red-600/95 font-bold tracking-tight text-white shadow-sm transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50',
        hero
          ? 'w-full rounded-xl px-4 py-4 text-base sm:text-lg'
          : 'rounded-lg px-3 py-2 text-xs',
        p.className
      )}
    >
      SOS — Hilferuf
    </button>
  )
}
