/**
 * Optional: API-Tresor nach Abwesenheit automatisch sperren.
 * Default 0 = aus — Sperren nur per Abmelden / „Sitzung beenden“.
 * Reload (F5) sperrt nicht.
 */

export const VAULT_IDLE_LOCK_MINUTES_LS_KEY = 'morgendrot.vaultIdleLockMinutes.v1'

export const VAULT_IDLE_LOCK_MINUTE_OPTIONS = [0, 5, 15, 30, 60] as const

export type VaultIdleLockMinutes = (typeof VAULT_IDLE_LOCK_MINUTE_OPTIONS)[number]

export function parseVaultIdleLockMinutes(raw: string | null | undefined): VaultIdleLockMinutes {
  const n = Number(String(raw ?? '').trim())
  if (!Number.isFinite(n) || n <= 0) return 0
  if ((VAULT_IDLE_LOCK_MINUTE_OPTIONS as readonly number[]).includes(n)) {
    return n as VaultIdleLockMinutes
  }
  return 0
}

export function readVaultIdleLockMinutes(): VaultIdleLockMinutes {
  if (typeof window === 'undefined') return 0
  try {
    return parseVaultIdleLockMinutes(window.localStorage.getItem(VAULT_IDLE_LOCK_MINUTES_LS_KEY))
  } catch {
    return 0
  }
}

export function writeVaultIdleLockMinutes(minutes: VaultIdleLockMinutes): void {
  if (typeof window === 'undefined') return
  try {
    if (minutes <= 0) window.localStorage.removeItem(VAULT_IDLE_LOCK_MINUTES_LS_KEY)
    else window.localStorage.setItem(VAULT_IDLE_LOCK_MINUTES_LS_KEY, String(minutes))
  } catch {
    /* ignore */
  }
}
