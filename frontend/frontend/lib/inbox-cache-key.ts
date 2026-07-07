/** Wallet-spezifischer Offline-Posteingang (localStorage). */
export const INBOX_CACHE_KEY_PREFIX = 'morgendrot.inbox.cache.v2:'

/** Legacy ohne Wallet-Segment — beim Wipe mit entfernen. */
export const INBOX_CACHE_KEY_PREFIX_LEGACY = 'morgendrot.inbox.cache.v1:'

export function isInboxCacheStorageKey(key: string): boolean {
  return key.startsWith(INBOX_CACHE_KEY_PREFIX) || key.startsWith(INBOX_CACHE_KEY_PREFIX_LEGACY)
}

function normPackageOrMailbox(value: string | undefined, fallback: string): string {
  const t = (value ?? '').trim().toLowerCase()
  return t || fallback
}

function normWalletScope(myAddress: string | undefined): string {
  const a = (myAddress ?? '').trim().toLowerCase()
  return /^0x[a-f0-9]{64}$/.test(a) ? a : 'anon'
}

/** Schlüssel: Package + aktive Send-Mailbox + eigene Wallet (Eingang/Ausgang-Bezug). */
export function buildInboxCacheKey(p: {
  packageId?: string
  activeMailboxId?: string
  myAddress?: string
}): string {
  const pkg = normPackageOrMailbox(p.packageId, '__default__')
  const mb = normPackageOrMailbox(p.activeMailboxId, '__server__')
  const wallet = normWalletScope(p.myAddress)
  return `${INBOX_CACHE_KEY_PREFIX}${pkg}:${mb}:${wallet}`
}

/** Nur Package + Wallet — kein Mailbox-Wechsel (sonst Posteingang-Flash). */
export function buildInboxWalletScopeKey(p: { packageId?: string; myAddress?: string }): string {
  const pkg = normPackageOrMailbox(p.packageId, '__default__')
  const wallet = normWalletScope(p.myAddress)
  return `${pkg}:${wallet}`
}
