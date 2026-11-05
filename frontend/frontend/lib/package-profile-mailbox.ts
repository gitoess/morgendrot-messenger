/**
 * Package-ID → MAILBOX_ID aus `public/package-profiles.manifest.json` (H.24b).
 * Wichtig: Posteingang scannt immer ein Mailbox-**Objekt**; PACKAGE_ID allein reicht nicht für alte Deploys.
 *
 * Nutzt den zentralen Parser aus `package-profile.ts` (§ H.24b P0) — keine eigene Parse-Logik.
 */

import {
  loadPackageProfilesManifest,
  packageMailboxMap,
} from '@/frontend/lib/package-profile'

/** Liefert die zum Profil gehörende MAILBOX_ID, falls im Manifest hinterlegt. */
export async function lookupMailboxIdForPackage(packageId: string): Promise<string | undefined> {
  const pkg = packageId.trim().toLowerCase()
  if (!/^0x[a-f0-9]{64}$/.test(pkg)) return undefined
  const manifest = await loadPackageProfilesManifest()
  return packageMailboxMap(manifest.profiles)[pkg]
}
