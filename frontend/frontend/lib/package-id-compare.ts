/**
 * Abgleich Posteingangs-Package-ID (explizites UI-Feld) mit GET /api/status → packageId.
 * Leeres Feld = Backend-Default (.morgendrot-package-id / .env) → kein Banner (kein Konflikt zweier expliziter Werte).
 */

const PKG_RE = /^0x[a-fA-F0-9]{64}$/

export function normalizePackageIdHex(s: string | undefined): string | null {
  if (s == null) return null
  const t = s.trim().toLowerCase()
  return PKG_RE.test(t) ? t : null
}

/** true: Nutzer hat eine gültige lokale ID gesetzt, die von der kanonischen Server-ID abweicht. */
export function shouldShowPackageIdMismatchBanner(
  localFilterRaw: string,
  serverPackageId: string | undefined,
  basisUnreachable: boolean
): boolean {
  if (basisUnreachable) return false
  const server = normalizePackageIdHex(serverPackageId)
  if (!server) return false
  const local = normalizePackageIdHex(localFilterRaw)
  if (!local) return false
  return local !== server
}
