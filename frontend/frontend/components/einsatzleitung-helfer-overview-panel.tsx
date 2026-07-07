'use client'

import { FileJson, Users } from 'lucide-react'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import { EinsatzleitungTeamRosterPanel } from '@/frontend/components/einsatzleitung-team-roster-panel'

/**
 * Roster & Telefonbuch-Kontakte — Teil von „Mein Team" in der Einsatzleitung.
 * Provisionierte Helfer (Registry) stehen separat im HandoffProvisionedHelpersPanel.
 */
export function EinsatzleitungHelferOverviewPanel(p: {
  apiStatus?: ApiStatus | null
  contactDirectory: Record<string, ContactMeshEntryClient>
  onContactsChanged: () => void
}) {
  const contactCount = Object.keys(p.contactDirectory).filter((a) => /^0x[a-fA-F0-9]{64}$/i.test(a)).length

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Users className="h-4 w-4" aria-hidden />
          Roster &amp; Kontakte
        </h3>
        <span className="text-xs text-muted-foreground">{contactCount} im Telefonbuch</span>
      </div>
      <EinsatzleitungTeamRosterPanel apiStatus={p.apiStatus} contactDirectory={p.contactDirectory} />
      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <FileJson className="h-3 w-3" aria-hidden />
        Helfer-Daten (Funk-ID, Telegram) kommen zurück per Team-Update oder manuell ins Telefonbuch —
        verteilen unter „Helfer einrichten“ → Telefonbuch.
      </p>
    </div>
  )
}
