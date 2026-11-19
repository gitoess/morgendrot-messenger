import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { parseJsonObjectRecord } from '@/frontend/lib/api-response-guard'
import { API_BASE, getApiBase } from '@/frontend/lib/api/api-base'
import type { ApiStatus } from '@/frontend/lib/api/api-status-types'
import { getOwnerIotaBalanceMist } from '@morgendrot/core/iota'
import { tryCreateBrowserDirectIotaClient } from '@/frontend/lib/direct-iota-rpc'
import { getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import { getDirectChainFieldIdsFromLs } from '@/frontend/lib/direct-iota-chain-context'
import { mistToIotaDecimal } from '@/frontend/lib/nft-vault-balance'
import { readNetworkProfilesState } from '@/frontend/lib/einsatz-network-profiles'

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

function resolveOwnerAddress(explicit?: string | null): string {
  const candidates = [
    explicit,
    getDirectIotaSessionSignerAddress(),
    getDirectChainFieldIdsFromLs().senderAddress,
  ]
  for (const raw of candidates) {
    const v = (raw || '').trim()
    if (/^0x[a-fA-F0-9]{64}$/i.test(v)) return v
  }
  return ''
}

/** Solo/APK ohne Morgendrot-API: Saldo direkt am Fullnode. */
export async function fetchWalletBalancesViaDirectRpc(
  ownerAddress?: string | null
): Promise<WalletBalancesFetchResult> {
  const address = resolveOwnerAddress(ownerAddress)
  if (!address) {
    return { ok: false, error: 'Keine Wallet-Adresse — zuerst Seed/Wallet entsperren.' }
  }
  const client = tryCreateBrowserDirectIotaClient()
  if (!client) {
    return { ok: false, error: 'Keine Direkt-RPC-URL (Puls / Wo senden?).' }
  }
  try {
    const mist = await getOwnerIotaBalanceMist(client, address)
    const bal = { mist: mist.toString(), displayIota: mistToIotaDecimal(mist) }
    const active = readNetworkProfilesState().active === 'mainnet' ? 'mainnet' : 'testnet'
    return {
      ok: true,
      address,
      message: 'Saldo per Direkt-RPC',
      walletNativeIotaBalance: bal,
      walletNativeIotaBalanceNetwork: active,
      walletNativeIotaBalanceTestnet: active === 'testnet' ? bal : undefined,
      walletNativeIotaBalanceMainnet: active === 'mainnet' ? bal : undefined,
      walletNativeIotaBalanceFetchFailed: false,
      walletNativeIotaBalanceTestnetFetchFailed: false,
      walletNativeIotaBalanceMainnetFetchFailed: false,
    }
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}

async function fetchWalletBalancesViaApi(): Promise<WalletBalancesFetchResult> {
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

/** API zuerst; ohne Basis / bei Fehler → Direkt-RPC (Solo/APK). */
export async function fetchWalletBalances(): Promise<WalletBalancesFetchResult> {
  const hasBasis = Boolean(getApiBase().trim())
  if (hasBasis) {
    const viaApi = await fetchWalletBalancesViaApi()
    if (viaApi.ok) return viaApi
  }
  return fetchWalletBalancesViaDirectRpc()
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
  if (balances.address && !next.myAddressFull) {
    next.myAddressFull = balances.address
    next.myAddress = `${balances.address.slice(0, 10)}…${balances.address.slice(-6)}`
  }
  return next
}
