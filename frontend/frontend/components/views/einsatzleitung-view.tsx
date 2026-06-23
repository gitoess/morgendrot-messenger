'use client'

import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import { EinsatzleitungHub } from '@/frontend/components/einsatzleitung-hub'
import {
  LazyBossHelferEinrichtenPanel,
  LazyEinsatzleitungErweitertPanel,
} from '@/frontend/components/lazy/messenger-scope-b'
import { EinsatzEndPanel } from '@/frontend/components/einsatz-end-panel'
import { EinsatzChainModeBanner } from '@/frontend/components/einsatz-chain-mode-banner'
import { EinsatzleitungJoinRequestsPanel } from '@/frontend/components/einsatzleitung-join-requests-panel'

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

      <EinsatzChainModeBanner rpcUrl={p.apiSnapshot?.rpcUrlLabel || p.apiSnapshot?.network} />

      {isBoss ? (
        <>
          <EinsatzleitungJoinRequestsPanel apiStatus={p.apiSnapshot ?? null} />
          <LazyBossHelferEinrichtenPanel
            apiStatus={p.apiSnapshot ?? null}
            contactDirectory={p.contactDirectory}
            onRefreshStatus={p.onRefreshStatus}
          />
          <LazyEinsatzleitungErweitertPanel
            apiStatus={p.apiSnapshot ?? null}
            onRefreshStatus={p.onRefreshStatus}
          />
        </>
      ) : null}

      <EinsatzEndPanel
        apiStatus={p.apiSnapshot ?? null}
        backendOnline={p.apiSnapshot?.backendOnline === true || p.apiSnapshot?.backendRunning === true}
        onCompleted={p.onRefreshStatus}
      />
    </div>
  )
}
