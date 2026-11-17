'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { setDashboardSosPending } from '@/frontend/lib/dashboard-sos-pending'
import { ChatViewSosEmergencySheet } from '@/frontend/components/chat-view-sos-emergency-sheet'

export function DashboardSosEmergencyButton(p: {
  onOpenMessages: () => void
  className?: string
}) {
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        title="SOS — Hilferuf (Text), MORG_EMERGENCY_V1. Kein automatischer 112-Ruf."
        onClick={() => setSheetOpen(true)}
        className={cn(
          'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium text-muted-foreground/70 underline-offset-2 transition-colors hover:text-red-400/80 hover:underline',
          p.className
        )}
      >
        SOS — Hilferuf
      </button>
      <ChatViewSosEmergencySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onConfirmText={(fullPlaintext) => {
          setDashboardSosPending(fullPlaintext)
          setSheetOpen(false)
          p.onOpenMessages()
        }}
      />
    </>
  )
}
