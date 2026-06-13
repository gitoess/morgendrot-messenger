import { getApiBase } from '@/frontend/lib/api/api-base'
import { fetchApiText } from '@/frontend/lib/api-fetch-text'

export type UpgradeMovePackageResult =
  | { ok: true; packageId: string; message?: string }
  | { ok: false; error: string }

export type ApplyEinsatzConfigResult =
  | { ok: true; applied?: string[]; message?: string }
  | { ok: false; error: string; errors?: string[]; applied?: string[] }

export type DeployMainnetPackageResult =
  | {
      ok: true
      packageId: string
      mailboxId?: string
      vaultRegistryId?: string
      commandRegistryId?: string
      mainnetRpcUrl: string
      message?: string
    }
  | { ok: false; error: string }

const DEPLOY_MAINNET_TIMEOUT_MS = 12 * 60 * 1000

function deployMainnetAbortSignal(): AbortSignal | undefined {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(DEPLOY_MAINNET_TIMEOUT_MS)
  }
  if (typeof AbortController === 'undefined') return undefined
  const ctrl = new AbortController()
  setTimeout(() => ctrl.abort(), DEPLOY_MAINNET_TIMEOUT_MS)
  return ctrl.signal
}

function parseDeployMainnetJson(text: string, status: number): { ok?: boolean; error?: string } & Record<string, unknown> {
  try {
    return JSON.parse(text) as { ok?: boolean; error?: string } & Record<string, unknown>
  } catch {
    if (status === 404) {
      return { ok: false, error: 'Deploy-API nicht gefunden — Boss-Backend neu starten (npm run dev).' }
    }
    return { ok: false, error: `Unerwartete Server-Antwort (HTTP ${status}). Backend neu starten?` }
  }
}

/** POST /api/upgrade-package — In-Place Move-Upgrade (gleiche PACKAGE_ID). */
export async function postUpgradeMovePackage(opts?: {
  packageDir?: string
}): Promise<UpgradeMovePackageResult> {
  try {
    const fr = await fetchApiText(getApiBase(), '/api/upgrade-package', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: opts?.packageDir ?? 'move-test' }),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const j = JSON.parse(fr.text) as { ok?: boolean; error?: string; packageId?: string; message?: string }
    if (!fr.response.ok || !j.ok) {
      return { ok: false, error: j.error || `HTTP ${fr.response.status}` }
    }
    return { ok: true, packageId: j.packageId || '', message: j.message }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** POST /api/deploy-mainnet-package — Move auf Mainnet + create_globals (Boss-PC, IOTA-CLI). */
export async function postDeployMainnetPackage(opts?: {
  rpcUrl?: string
  packageDir?: string
}): Promise<DeployMainnetPackageResult> {
  try {
    const fr = await fetchApiText(getApiBase(), '/api/deploy-mainnet-package', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rpcUrl: opts?.rpcUrl?.trim() || undefined,
        path: opts?.packageDir ?? 'move-test',
      }),
      signal: deployMainnetAbortSignal(),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const j = parseDeployMainnetJson(fr.text, fr.response.status) as {
      ok?: boolean
      error?: string
      packageId?: string
      mailboxId?: string
      vaultRegistryId?: string
      commandRegistryId?: string
      mainnetRpcUrl?: string
      message?: string
    }
    if (!fr.response.ok || !j.ok) {
      const err =
        j.error ||
        (fr.response.status === 403
          ? 'Nur Boss/Kommandant — oder Boss-Backend neu starten.'
          : fr.response.status === 404
            ? 'Deploy-API nicht gefunden — Boss-Backend neu starten (npm run dev).'
            : `HTTP ${fr.response.status}`)
      return { ok: false, error: err }
    }
    if (!j.packageId?.trim()) {
      return { ok: false, error: 'Deploy ohne Package-ID zurückgegeben.' }
    }
    return {
      ok: true,
      packageId: j.packageId.trim(),
      mailboxId: j.mailboxId?.trim() || undefined,
      vaultRegistryId: j.vaultRegistryId?.trim() || undefined,
      commandRegistryId: j.commandRegistryId?.trim() || undefined,
      mainnetRpcUrl: j.mainnetRpcUrl?.trim() || opts?.rpcUrl?.trim() || '',
      message: j.message,
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'TimeoutError') {
      return {
        ok: false,
        error: 'Deploy dauert länger als erwartet — Boss-Terminal prüfen, ob Publish noch läuft.',
      }
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** POST /api/einsatz-config-apply — TTL/Purge in Boss-Server-.env. */
export async function postApplyEinsatzConfig(body: {
  defaultTtlDays?: number
  enablePurge?: boolean
}): Promise<ApplyEinsatzConfigResult> {
  try {
    const fr = await fetchApiText(getApiBase(), '/api/einsatz-config-apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const j = JSON.parse(fr.text) as {
      ok?: boolean
      error?: string
      errors?: string[]
      applied?: string[]
      message?: string
    }
    if (!fr.response.ok || !j.ok) {
      return {
        ok: false,
        error: j.error || `HTTP ${fr.response.status}`,
        errors: j.errors,
        applied: j.applied,
      }
    }
    return { ok: true, applied: j.applied, message: j.message }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
