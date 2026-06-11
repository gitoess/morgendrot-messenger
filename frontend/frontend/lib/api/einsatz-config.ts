import { getApiBase } from '@/frontend/lib/api/api-base'
import { fetchApiText } from '@/frontend/lib/api-fetch-text'

export type UpgradeMovePackageResult =
  | { ok: true; packageId: string; message?: string }
  | { ok: false; error: string }

export type ApplyEinsatzConfigResult =
  | { ok: true; applied?: string[]; message?: string }
  | { ok: false; error: string; errors?: string[]; applied?: string[] }

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
