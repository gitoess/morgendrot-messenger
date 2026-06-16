import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { parseOkEnvelopePassthrough } from '@/frontend/lib/api-simple-ok-envelope'
import { API_BASE } from '@/frontend/lib/api/api-base'
import { executeCommand } from '@/frontend/lib/api/execute-command'
import type { VaultOnchainPreflight } from '@/frontend/lib/api/vault-onchain-preflight'

export type VaultChainConfigSyncResult = {
  ok: boolean
  applied?: string[]
  skipped?: string[]
  preflight?: VaultOnchainPreflight
  message?: string
  error?: string
}

async function syncViaCommand(dryRun: boolean): Promise<VaultChainConfigSyncResult> {
  const r = (await executeCommand('/vault-sync-chain-config', dryRun ? ['dry-run'] : [])) as {
    ok?: boolean
    message?: string
    applied?: string[]
    skipped?: string[]
    preflight?: VaultOnchainPreflight
    error?: string
  }
  return {
    ok: r?.ok === true,
    message: typeof r?.message === 'string' ? r.message : undefined,
    applied: Array.isArray(r?.applied) ? r.applied : undefined,
    skipped: Array.isArray(r?.skipped) ? r.skipped : undefined,
    preflight: r?.preflight,
    error: r?.error,
  }
}

export async function syncVaultChainConfig(opts?: {
  apply?: boolean
  dryRun?: boolean
}): Promise<VaultChainConfigSyncResult> {
  const dryRun = opts?.dryRun === true
  try {
    const fr = await fetchApiText(API_BASE, '/api/vault-sync-chain-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apply: opts?.apply !== false, dryRun }),
    })
    if (fr.ok && fr.response.status !== 404 && !/Route nicht gefunden/i.test(fr.text)) {
      const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Chain-Sync fehlgeschlagen.' })
      if (r.ok) {
        const b = r.body
        return {
          ok: b.ok === true,
          applied: Array.isArray(b.applied) ? (b.applied as string[]) : undefined,
          skipped: Array.isArray(b.skipped) ? (b.skipped as string[]) : undefined,
          preflight: b.preflight as VaultOnchainPreflight | undefined,
        }
      }
      if (r.error && !/Route nicht gefunden/i.test(r.error)) {
        return { ok: false, error: r.error }
      }
    }
    return await syncViaCommand(dryRun)
  } catch (error) {
    const cmd = await syncViaCommand(dryRun)
    if (cmd.ok || cmd.message) return cmd
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}
