/**
 * Package-ID → MAILBOX_ID aus `public/package-profiles.manifest.json` (H.24b-Vorbereitung).
 * Wichtig: Posteingang scannt immer ein Mailbox-**Objekt**; PACKAGE_ID allein reicht nicht für alte Deploys.
 */

let cacheByPackage: Record<string, string> | null = null

async function loadManifestMailboxMap(): Promise<Record<string, string>> {
  if (cacheByPackage) return cacheByPackage
  if (typeof window === 'undefined') return {}
  try {
    const r = await fetch('/package-profiles.manifest.json', { cache: 'no-store' })
    if (!r.ok) return {}
    const j = (await r.json()) as {
      profiles?: Array<{ packageId?: string; mailboxId?: string }>
    }
    const map: Record<string, string> = {}
    for (const p of j.profiles ?? []) {
      const pkg = (p.packageId ?? '').trim().toLowerCase()
      const mb = (p.mailboxId ?? '').trim()
      if (/^0x[a-f0-9]{64}$/i.test(pkg) && /^0x[a-f0-9]{64}$/i.test(mb)) {
        map[pkg] = mb
      }
    }
    cacheByPackage = map
    return map
  } catch {
    return {}
  }
}

/** Liefert die zum Profil gehörende MAILBOX_ID, falls im Manifest hinterlegt. */
export async function lookupMailboxIdForPackage(packageId: string): Promise<string | undefined> {
  const pkg = packageId.trim().toLowerCase()
  if (!/^0x[a-f0-9]{64}$/.test(pkg)) return undefined
  const map = await loadManifestMailboxMap()
  return map[pkg]
}
