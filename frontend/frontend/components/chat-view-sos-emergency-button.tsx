'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { ChatSendHandleOptions } from '@/frontend/features/send/chat-send-handle-options'
import type { ApiStatus } from '@/frontend/lib/api/status'
import type { ContactMeshEntryClient } from '@/frontend/lib/api/contacts'
import { ChatViewSosEmergencySheet } from '@/frontend/components/chat-view-sos-emergency-sheet'

export type ChatViewSosEmergencyButtonProps = {
  visible: boolean
  sending?: boolean
  message: string
  onSend: (opts?: ChatSendHandleOptions) => void | Promise<void>
  variant?: 'compact' | 'hero'
  className?: string
  apiStatus?: ApiStatus | null
  contactDirectory?: Record<string, ContactMeshEntryClient>
  myAddress?: string
}

export function ChatViewSosEmergencyButton(p: ChatViewSosEmergencyButtonProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  if (!p.visible) return null

  const hero = p.variant === 'hero'

  return (
    <>
      <button
        type="button"
        disabled={p.sending}
        title="SOS — Hilferuf (Text), MORG_EMERGENCY_V1. Kein automatischer 112-Ruf."
        onClick={() => setSheetOpen(true)}
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
      <ChatViewSosEmergencySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        initialText={p.message}
        apiStatus={p.apiStatus}
        contactDirectory={p.contactDirectory}
        myAddress={p.myAddress}
        sending={p.sending}
        onConfirmSend={async (fullPlaintext) => {
          await p.onSend({ emergencyWire: 'text', composerOverride: fullPlaintext })
          setSheetOpen(false)
        }}
      />
    </>
  )
}
