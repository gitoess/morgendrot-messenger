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
          'mx-auto w-full max-w-md rounded-xl border-2 border-red-600/70 bg-red-600/95 px-4 py-4 text-base font-bold tracking-tight text-white shadow-md transition-colors hover:bg-red-500 sm:text-lg',
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
