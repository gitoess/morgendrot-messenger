import type { ApiStatus } from '@/frontend/lib/api/status'

export type WalletIotaBalance = { mist: string; displayIota: string }

export type WalletNetworkId = 'testnet' | 'mainnet'

/** Saldo für Testnet oder Mainnet — auch wenn gerade das andere Netz aktiv ist. */
export function pickWalletBalanceForNetwork(
  api?: ApiStatus | null,
  network: WalletNetworkId = 'testnet'
): WalletIotaBalance | null | undefined {
  if (!api) return undefined
  const direct =
    network === 'testnet' ? api.walletNativeIotaBalanceTestnet : api.walletNativeIotaBalanceMainnet
  if (direct !== undefined) return direct
  const active = api.walletNativeIotaBalanceNetwork
  if (active === network && api.walletNativeIotaBalance !== undefined) {
    return api.walletNativeIotaBalance
  }
  const hasSplit =
    api.walletNativeIotaBalanceTestnet !== undefined ||
    api.walletNativeIotaBalanceMainnet !== undefined
  if (!hasSplit && api.walletNativeIotaBalance !== undefined && network === 'testnet') {
    return api.walletNativeIotaBalance
  }
  if (!active && api.walletNativeIotaBalance !== undefined) {
    const rpc = (api.rpcUrlLabel || api.einsatzConfig?.mainnetRpcUrlLabel || '').toLowerCase()
    const looksTestnet = rpc.includes('testnet') || rpc.includes('devnet')
    if (network === 'testnet' && looksTestnet) return api.walletNativeIotaBalance
    if (network === 'mainnet' && !looksTestnet && rpc) return api.walletNativeIotaBalance
  }
  return undefined
}

export function walletBalanceFetchFailedForNetwork(
  api?: ApiStatus | null,
  network: WalletNetworkId = 'testnet'
): boolean {
  if (!api) return false
  if (network === 'testnet') {
    return api.walletNativeIotaBalanceTestnetFetchFailed === true
  }
  return api.walletNativeIotaBalanceMainnetFetchFailed === true
}

/** `true` = Gas da, `false` = leer, `undefined` = unbekannt. */
export function walletHasGasForNetwork(
  api?: ApiStatus | null,
  network: WalletNetworkId = 'testnet'
): boolean | undefined {
  const bal = pickWalletBalanceForNetwork(api, network)
  if (bal === undefined) {
    if (walletBalanceFetchFailedForNetwork(api, network)) return undefined
    return undefined
  }
  if (bal === null) return false
  try {
    return BigInt(bal.mist) > 0n
  } catch {
    return undefined
  }
}
