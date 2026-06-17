'use client'

import { cn } from '@/lib/utils'
import type { ApiStatus } from '@/frontend/lib/api'
import { DashboardBossQuickActions } from '@/frontend/components/dashboard-boss-quick-actions'
import { DashboardPwaInstallCard } from '@/frontend/components/dashboard-pwa-install-card'
import { DashboardIotaTransferCard } from '@/frontend/components/dashboard-iota-transfer-card'
import { shouldShowDashboardPwaInstallCard } from '@/frontend/lib/should-show-pwa-install'

export function DashboardMessengerBossHome(p: {
  apiSnapshot: (ApiStatus & { error?: string }) | null
  hasValidMyAddressForBalance: boolean
  onRefreshStatus: () => void
  addressSuggestions: string[]
  onOpenMessages: () => void
  onOpenEinsatzleitung: () => void
}) {
  const showPwa = shouldShowDashboardPwaInstallCard()

  return (
    <div className="space-y-5">
      <DashboardBossQuickActions
        onOpenMessages={p.onOpenMessages}
        onOpenEinsatzleitung={p.onOpenEinsatzleitung}
      />

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
    </div>
  )
}
