'use client'

import { cn } from '@/lib/utils'
import type { ApiStatus } from '@/frontend/lib/api'
import type { OfflineStatusSnapshot } from '@/frontend/hooks/use-offline-status'
import { DashboardBossQuickActions } from '@/frontend/components/dashboard-boss-quick-actions'
import { DashboardPwaInstallCard } from '@/frontend/components/dashboard-pwa-install-card'
import { DashboardIotaTransferCard } from '@/frontend/components/dashboard-iota-transfer-card'
import { OfflineStatusCard } from '@/frontend/components/offline-status-card'
import { shouldShowDashboardPwaInstallCard } from '@/frontend/lib/should-show-pwa-install'

export function DashboardMessengerBossHome(p: {
  apiSnapshot: (ApiStatus & { error?: string }) | null
  offlineStatus: OfflineStatusSnapshot
  hasValidMyAddressForBalance: boolean
  onRefreshStatus: () => void
  addressSuggestions: string[]
  onOpenMessages: () => void
  onOpenEinsatzleitung: () => void
  onOpenVault: () => void
  onOpenSettings: () => void
  onEnableQueueOptIn: () => void
}) {
  const showPwa = shouldShowDashboardPwaInstallCard()

  return (
    <div className="space-y-5">
      <div
        className={cn(
          'flex flex-col gap-3 sm:flex-row sm:items-stretch',
          !showPwa && 'sm:block'
        )}
      >
        {showPwa ? <DashboardPwaInstallCard inline /> : null}
        <div className="min-w-0 flex-1">
          <DashboardIotaTransferCard
            compact
            myAddressFull={p.apiSnapshot?.myAddressFull}
            walletNativeIotaBalance={p.apiSnapshot?.walletNativeIotaBalance ?? undefined}
            walletNativeIotaBalanceFetchFailed={p.apiSnapshot?.walletNativeIotaBalanceFetchFailed}
            hasValidMyAddressForBalance={p.hasValidMyAddressForBalance}
            onRefreshStatus={p.onRefreshStatus}
            addressSuggestions={p.addressSuggestions}
          />
        </div>
      </div>

      <OfflineStatusCard
        variant="compact"
        className="mb-0"
        status={p.offlineStatus}
        onTestConnection={p.onRefreshStatus}
        onResync={() => {
          void p.onRefreshStatus()
        }}
        onEnableQueueOptIn={p.onEnableQueueOptIn}
        onOpenHandoffImport={p.onOpenSettings}
      />

      <DashboardBossQuickActions
        onOpenMessages={p.onOpenMessages}
        onOpenEinsatzleitung={p.onOpenEinsatzleitung}
        onOpenVault={p.onOpenVault}
      />
    </div>
  )
}
