'use client'

import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import { EinsatzleitungHub } from '@/frontend/components/einsatzleitung-hub'
import { EinsatzleitungErweitertPanel } from '@/frontend/components/einsatzleitung-erweitert-panel'
import { BossHelferEinrichtenPanel } from '@/frontend/components/boss-helfer-einrichten-panel'

export type EinsatzleitungViewProps = {
  apiSnapshot?: ApiStatus | null
  contactDirectory: Record<string, ContactMeshEntryClient>
  refreshContactDirectory: () => void
  onRefreshStatus?: () => void | Promise<void>
}

export function EinsatzleitungView(p: EinsatzleitungViewProps) {
  const isBoss = (p.apiSnapshot?.role || '').trim().toLowerCase() === 'boss'

  return (
    <div className="space-y-4 pb-4">
      <EinsatzleitungHub apiStatus={p.apiSnapshot ?? null} />

      {isBoss ? (
        <>
          <BossHelferEinrichtenPanel
            apiStatus={p.apiSnapshot ?? null}
            contactDirectory={p.contactDirectory}
            onRefreshStatus={p.onRefreshStatus}
          />
          <EinsatzleitungErweitertPanel
            apiStatus={p.apiSnapshot ?? null}
            onRefreshStatus={p.onRefreshStatus}
          />
        </>
      ) : null}
    </div>
  )
}
