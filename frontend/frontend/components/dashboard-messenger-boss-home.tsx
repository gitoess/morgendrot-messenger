'use client'

import type { ApiStatus } from '@/frontend/lib/api'
import { DashboardIotaTransferCard } from '@/frontend/components/dashboard-iota-transfer-card'
import { DashboardIotaActivityCard } from '@/frontend/components/dashboard-iota-activity-card'
import { DashboardSosEmergencyButton } from '@/frontend/components/dashboard-sos-emergency-button'

export function DashboardMessengerBossHome(p: {
  apiSnapshot: (ApiStatus & { error?: string }) | null
  hasValidMyAddressForBalance: boolean
  onRefreshStatus: () => void
  addressSuggestions: string[]
  onOpenMessages: () => void
  onOpenEinsatzleitung: () => void
}) {
  return (
    <div className="space-y-5">
      {/* Große Kacheln Nachrichten/Einsatzleitung entfernt — Nav reicht. */}
      <div className="flex justify-center">
        <DashboardSosEmergencyButton onOpenMessages={p.onOpenMessages} />
      </div>

      <div className="space-y-3">
        <DashboardIotaTransferCard
          compact
          myAddressFull={p.apiSnapshot?.myAddressFull}
          walletNativeIotaBalance={p.apiSnapshot?.walletNativeIotaBalance ?? undefined}
          walletNativeIotaBalanceFetchFailed={p.apiSnapshot?.walletNativeIotaBalanceFetchFailed}
          hasValidMyAddressForBalance={p.hasValidMyAddressForBalance}
          onRefreshStatus={p.onRefreshStatus}
          addressSuggestions={p.addressSuggestions}
        />
        <DashboardIotaActivityCard compact />
      </div>
    </div>
  )
}
