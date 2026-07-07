'use client'

import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import { canAccessEinsatzleitung } from '@/frontend/lib/messenger-role-capabilities'
import { EinsatzleitungHub } from '@/frontend/components/einsatzleitung-hub'
import {
  LazyBossHelferEinrichtenPanel,
  LazyEinsatzleitungErweitertPanel,
  LazyEinsatzleitungMeinTeamPanel,
} from '@/frontend/components/lazy/messenger-scope-b'
import { EinsatzEndPanel } from '@/frontend/components/einsatz-end-panel'
import { EinsatzChainModeBanner } from '@/frontend/components/einsatz-chain-mode-banner'
import { EinsatzleitungJoinRequestsPanel } from '@/frontend/components/einsatzleitung-join-requests-panel'

export type EinsatzleitungViewProps = {
  apiSnapshot?: ApiStatus | null
  contactDirectory: Record<string, ContactMeshEntryClient>
  refreshContactDirectory: () => void
  onRefreshStatus?: () => void | Promise<void>
  onOpenSettings?: () => void
}

export function EinsatzleitungView(p: EinsatzleitungViewProps) {
  const role = (p.apiSnapshot?.role || '').trim()
  const isLead = canAccessEinsatzleitung(role)

  return (
    <div className="space-y-4 pb-4">
      <EinsatzleitungHub apiStatus={p.apiSnapshot ?? null} />

      <EinsatzChainModeBanner rpcUrl={p.apiSnapshot?.rpcUrlLabel || p.apiSnapshot?.network} />

      {isLead ? (
        <>
          <EinsatzleitungJoinRequestsPanel
            apiStatus={p.apiSnapshot ?? null}
            contactDirectory={p.contactDirectory}
            onContactsChanged={p.refreshContactDirectory}
          />
          <LazyEinsatzleitungMeinTeamPanel
            apiStatus={p.apiSnapshot ?? null}
            contactDirectory={p.contactDirectory}
            onContactsChanged={p.refreshContactDirectory}
            onOpenMailboxes={p.onOpenSettings}
          />
          <LazyBossHelferEinrichtenPanel
            apiStatus={p.apiSnapshot ?? null}
            contactDirectory={p.contactDirectory}
            onRefreshStatus={p.onRefreshStatus}
            onContactsChanged={p.refreshContactDirectory}
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
