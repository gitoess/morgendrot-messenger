'use client'

import { useState } from 'react'
import { Siren } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApiStatus } from '@/frontend/lib/api/status'
import type { ContactMeshEntryClient } from '@/frontend/lib/api/contacts'
import { setDashboardSosPending } from '@/frontend/lib/dashboard-sos-pending'
import { ChatViewSosEmergencySheet } from '@/frontend/components/chat-view-sos-emergency-sheet'

/**
 * SOS-Einstieg (Morgendrot). IOTA-Edition: `hideSos`.
 * Ist: Text-Hilferuf → Sheet → Composer (ein Sendepfad). Kein Auto-112.
 * Fan-out aller Wege = Spec-Ziel, noch nicht Ist.
 */
export function DashboardSosEmergencyButton(p: {
  onOpenMessages: () => void
  className?: string
  apiStatus?: ApiStatus | null
  contactDirectory?: Record<string, ContactMeshEntryClient>
  myAddress?: string
}) {
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        title="SOS — Hilferuf (Text), MORG_EMERGENCY_V1. Kein automatischer 112-Ruf."
        onClick={() => setSheetOpen(true)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300/95 transition-colors hover:border-red-400/60 hover:bg-red-500/15 hover:text-red-200',
          p.className
        )}
      >
        <Siren className="h-3.5 w-3.5 shrink-0" aria-hidden />
        SOS — Hilferuf
      </button>
      <ChatViewSosEmergencySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        apiStatus={p.apiStatus}
        contactDirectory={p.contactDirectory}
        myAddress={p.myAddress}
        onConfirmText={(fullPlaintext) => {
          setDashboardSosPending(fullPlaintext)
          setSheetOpen(false)
          p.onOpenMessages()
        }}
      />
    </>
  )
}
