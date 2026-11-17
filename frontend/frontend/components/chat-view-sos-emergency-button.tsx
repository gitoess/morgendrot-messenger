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

  return (
    <>
      <button
        type="button"
        disabled={p.sending}
        title="SOS — Hilferuf (Text), MORG_EMERGENCY_V1. Kein automatischer 112-Ruf."
        onClick={() => setSheetOpen(true)}
        className={cn(
          'font-medium text-muted-foreground/70 underline-offset-2 transition-colors hover:text-red-400/80 hover:underline disabled:cursor-not-allowed disabled:opacity-50',
          'rounded-md px-2 py-0.5 text-[11px]',
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
