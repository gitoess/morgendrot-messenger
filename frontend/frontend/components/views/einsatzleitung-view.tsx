'use client'

import { useState } from 'react'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import { EinsatzleitungHub } from '@/frontend/components/einsatzleitung-hub'
import { DashboardEinsatzKonfiguration } from '@/frontend/components/dashboard-einsatz-konfiguration'
import { LanInstallQrPanel } from '@/frontend/components/lan-install-qr-panel'
import { BossDeviceProvisionWizard } from '@/frontend/components/boss-device-provision-wizard'
import { BossHandoffExportPanel } from '@/frontend/components/boss-handoff-export-panel'

export type EinsatzleitungViewProps = {
  apiSnapshot?: ApiStatus | null
  contactDirectory: Record<string, ContactMeshEntryClient>
  refreshContactDirectory: () => void
  onRefreshStatus?: () => void | Promise<void>
}

export function EinsatzleitungView(p: EinsatzleitungViewProps) {
  const [statusMsg, setStatusMsg] = useState('')
  const isBoss = (p.apiSnapshot?.role || '').trim().toLowerCase() === 'boss'

  return (
    <div className="space-y-8 pb-4">
      <EinsatzleitungHub apiStatus={p.apiSnapshot ?? null} />

      {isBoss ? (
        <DashboardEinsatzKonfiguration
          apiStatus={p.apiSnapshot ?? null}
          contactDirectory={p.contactDirectory}
          onRefreshStatus={p.onRefreshStatus}
        />
      ) : null}

      {isBoss ? (
        <BossDeviceProvisionWizard
          apiSnapshot={p.apiSnapshot ?? null}
          contactDirectory={p.contactDirectory}
        />
      ) : null}

      {isBoss ? (
        <section id="einsatz-handoff-export" className="scroll-mt-4 rounded-xl border border-purple-500/25 bg-card p-4">
          <BossHandoffExportPanel
            apiSnapshot={p.apiSnapshot ?? null}
            contactDirectory={p.contactDirectory}
            embedded
          />
        </section>
      ) : null}

      {isBoss ? (
        <section id="einsatz-helfer-qr" className="scroll-mt-4">
          <LanInstallQrPanel variant="embedded" onStatus={(msg) => setStatusMsg(msg)} />
        </section>
      ) : null}

      {statusMsg ? (
        <p className="text-xs text-muted-foreground" role="status">
          {statusMsg}
        </p>
      ) : null}
    </div>
  )
}
