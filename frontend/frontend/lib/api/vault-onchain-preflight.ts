import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { parseOkEnvelopePassthrough } from '@/frontend/lib/api-simple-ok-envelope'
import { API_BASE } from '@/frontend/lib/api/api-base'

export type VaultOnchainPreflight = {
  ok: boolean
  network: 'testnet' | 'mainnet' | 'unknown'
  rpcUrl: string
  packageId: string
  vaultRegistryId: string
  myAddress: string
  packageExists: boolean
  registryExists: boolean
  vaultOnChain: boolean
  issues: string[]
  hints: string[]
}

export async function fetchVaultOnchainPreflight(): Promise<{
  ok: boolean
  preflight?: VaultOnchainPreflight
  error?: string
}> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/vault-onchain-preflight')
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Preflight nicht lesbar.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    const pre = b.preflight as VaultOnchainPreflight | undefined
    return { ok: pre?.ok === true, preflight: pre, error: pre && !pre.ok ? pre.issues.join(' ') : undefined }
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}
