import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { parseJsonObjectRecord } from '@/frontend/lib/api-response-guard'
import { API_BASE } from '@/frontend/lib/api/api-base'
import type { ApiStatus } from '@/frontend/lib/api/api-status-types'

export type WalletBalancesFetchResult =
  | ({ ok: true } & Pick<
      ApiStatus,
      | 'walletNativeIotaBalance'
      | 'walletNativeIotaBalanceFetchFailed'
      | 'walletNativeIotaBalanceNetwork'
      | 'walletNativeIotaBalanceTestnet'
      | 'walletNativeIotaBalanceMainnet'
      | 'walletNativeIotaBalanceTestnetFetchFailed'
      | 'walletNativeIotaBalanceMainnetFetchFailed'
    > & { address?: string | null; message?: string })
  | { ok: false; error: string }

export async function fetchWalletBalances(): Promise<WalletBalancesFetchResult> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/wallet-balances', {
      signal: AbortSignal.timeout(15_000),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const p = parseJsonObjectRecord(fr.text)
    if (!p.ok) return { ok: false, error: 'Ungültige Antwort vom Backend.' }
    const data = p.data
    if (data.ok !== true) {
      return { ok: false, error: typeof data.error === 'string' ? data.error : 'Saldo-Abfrage fehlgeschlagen.' }
    }
    return {
      ok: true,
      address: typeof data.address === 'string' ? data.address : null,
      message: typeof data.message === 'string' ? data.message : undefined,
      walletNativeIotaBalance: data.walletNativeIotaBalance as ApiStatus['walletNativeIotaBalance'],
      walletNativeIotaBalanceFetchFailed: data.walletNativeIotaBalanceFetchFailed === true,
      walletNativeIotaBalanceNetwork: data.walletNativeIotaBalanceNetwork as ApiStatus['walletNativeIotaBalanceNetwork'],
      walletNativeIotaBalanceTestnet: data.walletNativeIotaBalanceTestnet as ApiStatus['walletNativeIotaBalanceTestnet'],
      walletNativeIotaBalanceMainnet: data.walletNativeIotaBalanceMainnet as ApiStatus['walletNativeIotaBalanceMainnet'],
      walletNativeIotaBalanceTestnetFetchFailed: data.walletNativeIotaBalanceTestnetFetchFailed === true,
      walletNativeIotaBalanceMainnetFetchFailed: data.walletNativeIotaBalanceMainnetFetchFailed === true,
    }
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}

/** Saldo-Felder aus `/api/wallet-balances` in einen ApiStatus-Partial mergen. */
export function mergeWalletBalancesIntoApiStatus(
  base: ApiStatus | null | undefined,
  balances: Extract<WalletBalancesFetchResult, { ok: true }>
): ApiStatus {
  const next: ApiStatus = { ...(base || {}), backendOnline: base?.backendOnline ?? true }
  if (balances.walletNativeIotaBalance !== undefined) {
    next.walletNativeIotaBalance = balances.walletNativeIotaBalance
  }
  if (balances.walletNativeIotaBalanceFetchFailed) {
    next.walletNativeIotaBalanceFetchFailed = true
  }
  if (balances.walletNativeIotaBalanceNetwork) {
    next.walletNativeIotaBalanceNetwork = balances.walletNativeIotaBalanceNetwork
  }
  if (balances.walletNativeIotaBalanceTestnet !== undefined) {
    next.walletNativeIotaBalanceTestnet = balances.walletNativeIotaBalanceTestnet
  }
  if (balances.walletNativeIotaBalanceMainnet !== undefined) {
    next.walletNativeIotaBalanceMainnet = balances.walletNativeIotaBalanceMainnet
  }
  if (balances.walletNativeIotaBalanceTestnetFetchFailed) {
    next.walletNativeIotaBalanceTestnetFetchFailed = true
  }
  if (balances.walletNativeIotaBalanceMainnetFetchFailed) {
    next.walletNativeIotaBalanceMainnetFetchFailed = true
  }
  return next
}
