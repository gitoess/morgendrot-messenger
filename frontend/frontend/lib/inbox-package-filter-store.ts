/**
 * Temporärer Posteingang-Package-Filter — teilbar zwischen Einstellungen und Chat.
 * Dauerhaftes /set-package-id bleibt über API; dies ist nur die View-Filter-Session.
 */

export const INBOX_PACKAGE_FILTER_LS_KEY = 'morgendrot.inboxPackageFilter.v1'
export const INBOX_PACKAGE_FILTER_CHANGED = 'morgendrot:inbox-package-filter'

const HEX64 = /^0x[a-f0-9]{64}$/

function norm(raw: string): string {
  const t = raw.trim().toLowerCase()
  return HEX64.test(t) ? t : ''
}

export function readInboxPackageFilterStore(): string {
  if (typeof window === 'undefined') return ''
  try {
    return norm(window.localStorage.getItem(INBOX_PACKAGE_FILTER_LS_KEY) || '')
  } catch {
    return ''
  }
}

export function writeInboxPackageFilterStore(
  packageId: string,
  opts?: { emit?: boolean }
): void {
  if (typeof window === 'undefined') return
  const next = norm(packageId)
  try {
    if (!next) window.localStorage.removeItem(INBOX_PACKAGE_FILTER_LS_KEY)
    else window.localStorage.setItem(INBOX_PACKAGE_FILTER_LS_KEY, next)
  } catch {
    /* ignore */
  }
  if (opts?.emit === false) return
  try {
    window.dispatchEvent(new CustomEvent(INBOX_PACKAGE_FILTER_CHANGED, { detail: next }))
  } catch {
    /* ignore */
  }
}
