'use client'

import type { ApiStatus } from '@/frontend/lib/api'

export type BossWizardDeployNetwork = {
  id: 'testnet' | 'mainnet'
  label: string
  rpcHint: string
  deployButtonLabel: string
}

/** Netzwerk für `/api/deploy-package` — folgt der Basis-RPC (nicht Browser-Mainnet-Profil). */
export function resolveBossWizardDeployNetwork(api?: ApiStatus | null): BossWizardDeployNetwork {
  const rpc = (api?.rpcUrlLabel || '').trim()
  const vaultNet = (api?.vaultStatus?.network || '').trim().toLowerCase()
  const mainnet = vaultNet === 'mainnet' || /mainnet/i.test(rpc)
  const id: 'testnet' | 'mainnet' = mainnet ? 'mainnet' : 'testnet'
  const label = id === 'mainnet' ? 'Produktion (Mainnet)' : 'Übung (Testnet)'
  const rpcHint = rpc || (id === 'mainnet' ? 'Mainnet-RPC' : 'Testnet-RPC')
  return {
    id,
    label,
    rpcHint,
    deployButtonLabel:
      id === 'mainnet'
        ? 'Messenger-Contract anlegen (Mainnet)'
        : 'Messenger-Contract anlegen (Testnet)',
  }
}
