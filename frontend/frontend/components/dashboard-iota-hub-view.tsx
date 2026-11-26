'use client'

import type { ApiStatus } from '@/frontend/lib/api'
import { DashboardIotaTransferCard } from '@/frontend/components/dashboard-iota-transfer-card'
import { DashboardIotaActivityCard } from '@/frontend/components/dashboard-iota-activity-card'

/**
 * Unteransicht hinter Home-Kachel „IOTA“ — Wallet + Aktivität.
 * Wallet/Aktivität-Inhalt unverändert (Freeze); nur Navigation.
 */
export function DashboardIotaHubView(p: {
  apiSnapshot: (ApiStatus & { error?: string }) | null
  hasValidMyAddressForBalance: boolean
  onRefreshStatus: () => void
  addressSuggestions: string[]
  recipientOptions?: { address: string; label: string; favorite?: boolean }[]
}) {
  return (
    <div className="space-y-4">
      <DashboardIotaTransferCard
        myAddressFull={p.apiSnapshot?.myAddressFull}
        walletNativeIotaBalance={p.apiSnapshot?.walletNativeIotaBalance ?? undefined}
        walletNativeIotaBalanceFetchFailed={p.apiSnapshot?.walletNativeIotaBalanceFetchFailed}
        hasValidMyAddressForBalance={p.hasValidMyAddressForBalance}
        onRefreshStatus={p.onRefreshStatus}
        addressSuggestions={p.addressSuggestions}
        recipientOptions={p.recipientOptions}
        mailboxIds={[
          ...(p.apiSnapshot?.mailboxId ? [p.apiSnapshot.mailboxId] : []),
          ...(p.apiSnapshot?.inboxUnionMailboxIds ?? []),
        ]}
        primaryMailboxId={p.apiSnapshot?.mailboxId || undefined}
      />
      <DashboardIotaActivityCard />
    </div>
  )
}
