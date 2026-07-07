'use client'

import { Users } from 'lucide-react'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import { HandoffProvisionedHelpersPanel } from '@/frontend/components/handoff-provisioned-helpers-panel'
import { EinsatzleitungHelferOverviewPanel } from '@/frontend/components/einsatzleitung-helfer-overview-panel'
import { EinsatzleitungTeamOverviewPanel } from '@/frontend/components/einsatzleitung-team-overview-panel'

/**
 * „Mein Team" — Übersicht direkt in der Einsatzleitung:
 * provisionierte Helfer (Registry), Roster/Kontakte, Team-Postfächer.
 * Erstellung neuer Helfer bleibt separat unter „Helfer einrichten".
 */
export function EinsatzleitungMeinTeamPanel(p: {
  apiStatus?: ApiStatus | null
  contactDirectory: Record<string, ContactMeshEntryClient>
  onContactsChanged: () => void
  onOpenMailboxes?: () => void
}) {
  return (
    <section id="mein-team" className="scroll-mt-4 space-y-4 rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Users className="h-4 w-4 text-emerald-500" aria-hidden />
        Mein Team
      </p>

      <HandoffProvisionedHelpersPanel />

      <EinsatzleitungHelferOverviewPanel
        apiStatus={p.apiStatus ?? null}
        contactDirectory={p.contactDirectory}
        onContactsChanged={p.onContactsChanged}
      />

      <EinsatzleitungTeamOverviewPanel
        serverMailboxId={p.apiStatus?.mailboxId}
        onOpenMailboxes={p.onOpenMailboxes}
      />
    </section>
  )
}
