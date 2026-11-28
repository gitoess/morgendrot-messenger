/**
 * Call-Package für Stealth MoveCalls (`store_stealth_*` / `purge_stealth_*`).
 * Stamm-`PACKAGE_ID` (Mailbox-Typen) darf nach Upgrade **nicht** überschrieben werden —
 * siehe `docs/DEPLOY-MOVE-UPGRADE-VS-PUBLISH.md` / Spec § Call-Package vs. Stamm.
 */

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

/** Letztes Upgrade mit Stealth-Funs (Move.toml `published-at`, 2026-11-28). */
export const STEALTH_CALL_PACKAGE_ID_DEFAULT =
  '0xa3e70f179178054b565788d49ad34df9a9ffecdcda9e92fdde173b404e800c51'

const LS_OVERRIDE = 'morgendrot.stealth.callPackageId.v1'

/** Experte: optionaler Override; leer → Default. */
export function readStealthCallPackageIdOverride(): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(LS_OVERRIDE)?.trim() ?? ''
  } catch {
    return ''
  }
}

export function writeStealthCallPackageIdOverride(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const t = id.trim()
    if (!t) window.localStorage.removeItem(LS_OVERRIDE)
    else window.localStorage.setItem(LS_OVERRIDE, t)
  } catch {
    /* ignore */
  }
}

/** MoveCall-Target für Stealth — Override wenn gültig, sonst Default. */
export function getStealthCallPackageId(): string {
  const o = readStealthCallPackageIdOverride()
  if (HEX64.test(o)) return o
  return STEALTH_CALL_PACKAGE_ID_DEFAULT
}
