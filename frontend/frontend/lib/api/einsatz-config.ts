import { API_BASE } from '@/frontend/lib/api/api-base'

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
    const res = await fetch(`${API_BASE}/api/upgrade-package`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: opts?.packageDir ?? 'move-test' }),
    })
    const j = (await res.json()) as UpgradeMovePackageResult & { message?: string }
    if (!res.ok || !j.ok) {
      return { ok: false, error: j.error || `HTTP ${res.status}` }
    }
    return { ok: true, packageId: j.packageId, message: j.message }
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
    const res = await fetch(`${API_BASE}/api/einsatz-config-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const j = (await res.json()) as ApplyEinsatzConfigResult
    if (!res.ok || !j.ok) {
      return {
        ok: false,
        error: j.error || `HTTP ${res.status}`,
        errors: j.errors,
        applied: j.applied,
      }
    }
    return j
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
