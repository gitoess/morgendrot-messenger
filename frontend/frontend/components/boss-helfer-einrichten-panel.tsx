'use client'

import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import { BossHandoffExportPanel } from '@/frontend/components/boss-handoff-export-panel'
import { DashboardEinsatzParameterPanel } from '@/frontend/components/dashboard-einsatz-konfiguration'

export function BossHelferEinrichtenPanel(p: {
  apiStatus?: ApiStatus | null
  contactDirectory?: Record<string, ContactMeshEntryClient>
  onRefreshStatus?: () => void | Promise<void>
}) {
  return (
    <section id="helfer-einrichten" className="scroll-mt-4 space-y-4 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold text-foreground">Helfer einrichten</p>
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
