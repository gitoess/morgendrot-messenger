'use client'

import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import { EinsatzleitungHelferFlowPanel } from '@/frontend/components/einsatzleitung-helfer-flow-panel'
import { EinsatzleitungHelferOverviewPanel } from '@/frontend/components/einsatzleitung-helfer-overview-panel'
import { EinsatzleitungTeamOverviewPanel } from '@/frontend/components/einsatzleitung-team-overview-panel'
import { EinsatzleitungMeshtasticHintPanel } from '@/frontend/components/einsatzleitung-meshtastic-hint-panel'
import { BossHandoffExportPanel } from '@/frontend/components/boss-handoff-export-panel'
import { DashboardEinsatzParameterPanel } from '@/frontend/components/dashboard-einsatz-konfiguration'

export function BossHelferEinrichtenPanel(p: {
  apiStatus?: ApiStatus | null
  contactDirectory?: Record<string, ContactMeshEntryClient>
  onRefreshStatus?: () => void | Promise<void>
  onOpenMailboxes?: () => void
  onContactsChanged?: () => void
}) {
  return (
    <section id="helfer-einrichten" className="scroll-mt-4 space-y-4 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold text-foreground">Helfer einrichten</p>

      <EinsatzleitungHelferFlowPanel />

      <EinsatzleitungHelferOverviewPanel
        contactDirectory={p.contactDirectory ?? {}}
        onContactsChanged={p.onContactsChanged ?? (() => {})}
      />

      <EinsatzleitungTeamOverviewPanel
        serverMailboxId={p.apiStatus?.mailboxId}
        onOpenMailboxes={p.onOpenMailboxes}
      />

      <EinsatzleitungMeshtasticHintPanel />

      <BossHandoffExportPanel
        apiSnapshot={p.apiStatus ?? null}
        contactDirectory={p.contactDirectory}
        embedded
        layout="compact"
      />

      <DashboardEinsatzParameterPanel
        apiStatus={p.apiStatus ?? null}
        contactDirectory={p.contactDirectory}
        onRefreshStatus={p.onRefreshStatus}
        inline
      />
    </section>
  )
}
