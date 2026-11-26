'use client'

import type { ApiStatus } from '@/frontend/lib/api'
import type { ContactMeshEntryClient } from '@/frontend/lib/api/contacts'
import { DashboardBossQuickActions } from '@/frontend/components/dashboard-boss-quick-actions'

export function DashboardMessengerBossHome(p: {
  onOpenMessages: () => void
  onOpenIota: () => void
  onOpenEinsatzleitung: () => void
  showEinsatzleitung?: boolean
  apiSnapshot?: (ApiStatus & { error?: string }) | null
  contactDirectory?: Record<string, ContactMeshEntryClient>
  myAddress?: string
}) {
  return (
    <div className="space-y-5">
      <DashboardBossQuickActions
        onOpenMessages={p.onOpenMessages}
        onOpenIota={p.onOpenIota}
        onOpenEinsatzleitung={p.onOpenEinsatzleitung}
        showEinsatzleitung={p.showEinsatzleitung}
        sosApiStatus={p.apiSnapshot}
        sosContactDirectory={p.contactDirectory}
        sosMyAddress={p.myAddress || p.apiSnapshot?.myAddressFull || p.apiSnapshot?.myAddress || undefined}
      />
    </div>
  )
}
