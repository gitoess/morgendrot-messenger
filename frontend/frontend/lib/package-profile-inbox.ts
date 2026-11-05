/**
 * § H.24b Adoption — Posteingang-Package aus aktivem Einsatzprofil (§3.3).
 */

import { readActiveProfileSnapshot } from '@/frontend/lib/package-profile-registry'
import { readBootstrapCachedApiStatus } from '@/frontend/lib/api'

const HEX64 = /^0x[a-f0-9]{64}$/i

/** Effektive Package-ID für Posteingang-Fetch: Filter > aktives Profil (nur wenn = Server) > API-Status. */
export function resolveEffectiveInboxPackageId(opts: {
  inboxFilter?: string
  apiPackageId?: string
}): string | undefined {
  const filter = (opts.inboxFilter ?? '').trim()
  if (HEX64.test(filter)) return filter.toLowerCase()
  const api = (opts.apiPackageId ?? readBootstrapCachedApiStatus()?.packageId ?? '')
    .trim()
    .toLowerCase()
  const snap = readActiveProfileSnapshot()
  const profilePkg =
    snap?.resolved && snap.packageId && HEX64.test(snap.packageId)
      ? snap.packageId.toLowerCase()
      : undefined
  /** Profil nur wenn es zur laufenden Basis passt — sonst fehlen Nachrichten am PC. */
  if (profilePkg && HEX64.test(api)) {
    return profilePkg === api ? profilePkg : api
  }
  if (profilePkg) return profilePkg
  if (HEX64.test(api)) return api
  return undefined
}

/** Shared-Mailbox des aktiven Profils (Manifest/Profil), falls gesetzt. */
export function resolveActiveProfileMailboxId(): string | undefined {
  const snap = readActiveProfileSnapshot()
  const mb = (snap?.mailboxId ?? '').trim()
  return HEX64.test(mb) ? mb : undefined
}
