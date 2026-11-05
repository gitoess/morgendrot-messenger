/**
 * § H.24b P0 — Datenmodell + Parser für Einsatz-/Package-Profile.
 *
 * SSOT: `docs/PACKAGE-PROFILE-WECHSEL-SPEC.md` §3.1b / §7.6.
 * Quelle: `public/package-profiles.manifest.json` (Bundle-Vorlage, `REPLACE_*`-Platzhalter
 * bis nach `create_globals` echte IDs eingetragen sind).
 *
 * Diese Scheibe ist **rein clientseitig**: Typ, Validierung, Loader. **Kein** Wechsel-UX,
 * **kein** Server-Hot-Swap (§7.5) — das sind spätere Phasen P1b/P2.
 */

import {
  parseMessengerCapabilitiesOverride,
  type MessengerCapabilitiesOverride,
} from '@morgendrot/shared/messenger-capabilities-matrix'

const HEX64 = /^0x[a-f0-9]{64}$/i
/** Slug: Buchstabe/Ziffer am Anfang, dann Buchstaben/Ziffern/`-`/`_`, max. 64. */
const PROFILE_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i

/** Ein Einsatzprofil (Organisation/Deploy), nicht ein Chat-Raum — siehe Spec §1. */
export type PackageProfile = {
  id: string
  label: string
  description?: string
  color?: string
  icon?: string
  /** true = im Bundle mitgeliefert (Standard-Profil). */
  bundled: boolean
  /** true = darf clientseitig nicht bearbeitet werden (z. B. bundled). */
  readOnly: boolean
  packageId?: string
  mailboxId?: string
  vaultRegistryId?: string
  commandRegistryId?: string
  rpcUrl?: string
  apiBaseUrl?: string
  /** § H.24a — optionaler Capability-Override, wenn dieses Profil aktiv ist. */
  capabilities?: MessengerCapabilitiesOverride
  /** true, wenn `packageId` **und** `mailboxId` gültige 0x-64-Hex sind (keine `REPLACE_*`-Platzhalter). */
  resolved: boolean
}

export type PackageProfilesManifest = {
  version: number
  meta?: { title?: string; description?: string }
  profiles: PackageProfile[]
}

function trimmedString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

function hex64(v: unknown): string | undefined {
  const s = trimmedString(v)
  return s && HEX64.test(s) ? s.toLowerCase() : undefined
}

function httpUrl(v: unknown): string | undefined {
  const s = trimmedString(v)
  if (!s) return undefined
  return /^https?:\/\/[^\s]+$/i.test(s) ? s : undefined
}

/** Ein Profil-Rohobjekt validieren/normalisieren. Ungültig (kein id/label) → null. */
export function parsePackageProfile(raw: unknown): PackageProfile | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>

  const id = trimmedString(o.id)
  const label = trimmedString(o.label)
  if (!id || !PROFILE_ID_RE.test(id) || !label) return null

  const packageId = hex64(o.packageId)
  const mailboxId = hex64(o.mailboxId)

  const profile: PackageProfile = {
    id,
    label,
    bundled: o.bundled === true,
    readOnly: o.readOnly === true,
    resolved: Boolean(packageId && mailboxId),
  }

  const description = trimmedString(o.description)
  if (description) profile.description = description
  const color = trimmedString(o.color)
  if (color) profile.color = color
  const icon = trimmedString(o.icon)
  if (icon) profile.icon = icon
  if (packageId) profile.packageId = packageId
  if (mailboxId) profile.mailboxId = mailboxId
  const vaultRegistryId = hex64(o.vaultRegistryId)
  if (vaultRegistryId) profile.vaultRegistryId = vaultRegistryId
  const commandRegistryId = hex64(o.commandRegistryId)
  if (commandRegistryId) profile.commandRegistryId = commandRegistryId
  const rpcUrl = httpUrl(o.rpcUrl)
  if (rpcUrl) profile.rpcUrl = rpcUrl
  const apiBaseUrl = httpUrl(o.apiBaseUrl)
  if (apiBaseUrl) profile.apiBaseUrl = apiBaseUrl
  const capabilities = parseMessengerCapabilitiesOverride(o.capabilities)
  if (capabilities) profile.capabilities = capabilities

  return profile
}

/**
 * Ganzes Manifest parsen. Ungültige Einträge werden verworfen, Duplikate (gleiche `id`,
 * case-insensitiv) übersprungen (erster gewinnt). `_`-präfixierte Doku-Keys werden ignoriert
 * (sie sind schlicht keine bekannten Felder).
 */
export function parsePackageProfilesManifest(raw: unknown): PackageProfilesManifest {
  const empty: PackageProfilesManifest = { version: 0, profiles: [] }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return empty
  const o = raw as Record<string, unknown>

  const version =
    typeof o.version === 'number' && Number.isFinite(o.version) ? o.version : 0

  const rawProfiles = Array.isArray(o.profiles) ? o.profiles : []
  const seen = new Set<string>()
  const profiles: PackageProfile[] = []
  for (const entry of rawProfiles) {
    const p = parsePackageProfile(entry)
    if (!p) continue
    const key = p.id.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    profiles.push(p)
  }

  const manifest: PackageProfilesManifest = { version, profiles }
  const meta = o.meta
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const m = meta as Record<string, unknown>
    const title = trimmedString(m.title)
    const description = trimmedString(m.description)
    if (title || description) {
      manifest.meta = { ...(title ? { title } : {}), ...(description ? { description } : {}) }
    }
  }
  return manifest
}

/** Nur einsatzbereite Profile (gültige `packageId` + `mailboxId`). */
export function resolvedPackageProfiles(profiles: PackageProfile[]): PackageProfile[] {
  return profiles.filter((p) => p.resolved)
}

/** `packageId` (lowercase) → `mailboxId` für alle einsatzbereiten Profile. */
export function packageMailboxMap(profiles: PackageProfile[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const p of profiles) {
    if (p.resolved && p.packageId && p.mailboxId) map[p.packageId] = p.mailboxId
  }
  return map
}

const MANIFEST_URL = '/package-profiles.manifest.json'
let manifestCache: PackageProfilesManifest | null = null

/** Manifest aus dem Bundle laden + parsen (Browser). Ergebnis wird gecacht. */
export async function loadPackageProfilesManifest(opts?: {
  force?: boolean
}): Promise<PackageProfilesManifest> {
  if (manifestCache && !opts?.force) return manifestCache
  if (typeof window === 'undefined') return { version: 0, profiles: [] }
  try {
    const r = await fetch(MANIFEST_URL, { cache: 'no-store' })
    if (!r.ok) return { version: 0, profiles: [] }
    const j = (await r.json()) as unknown
    manifestCache = parsePackageProfilesManifest(j)
    return manifestCache
  } catch {
    return { version: 0, profiles: [] }
  }
}

/** Test-Hilfe: Modul-Cache zurücksetzen. */
export function __resetPackageProfilesManifestCache(): void {
  manifestCache = null
}
