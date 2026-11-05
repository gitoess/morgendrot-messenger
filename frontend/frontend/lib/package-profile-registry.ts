/**
 * § H.24b P1b — Client-Registry für Einsatz-/Package-Profile.
 *
 * SSOT: `docs/PACKAGE-PROFILE-WECHSEL-SPEC.md` §3.1 (Ebene B), §3.2 (Wechsel-UX), §7.5.
 *
 * Aufgabe dieser Scheibe (rein clientseitig, **kein** UI, **kein** Server-Hot-Swap):
 *  - bundled Profile aus dem Manifest (`package-profile.ts`) + benutzerdefinierte aus localStorage
 *    zu **einer** Liste zusammenführen (bundled gewinnt bei id-Kollision, ist read-only),
 *  - **aktives Profil** merken/auflösen,
 *  - Profile anlegen/entfernen (nur nicht-bundled),
 *  - **Wechsel-Warnungstext** (§3.2) bauen.
 *
 * UI („Einsatz wechseln“-Button, Modal, Banner) ist Phase **P2**.
 */

import {
  parseMessengerCapabilitiesOverride,
} from '@morgendrot/shared/messenger-capabilities-matrix'
import {
  loadPackageProfilesManifest,
  parsePackageProfile,
  type PackageProfile,
} from '@/frontend/lib/package-profile'

const LS_KEY = 'morgendrot.packageProfiles.registry.v1'
export const PACKAGE_PROFILE_REGISTRY_CHANGED = 'morgendrot:package-profile-registry-changed'

/** Sync-Snapshot des aktiven Profils (für Capabilities, Posteingang, Banner ohne async Manifest). */
export type ActiveProfileSnapshot = Pick<
  PackageProfile,
  'id' | 'label' | 'color' | 'packageId' | 'mailboxId' | 'resolved' | 'capabilities' | 'apiBaseUrl'
>

/** Persistierter Client-Zustand: nur benutzerdefinierte Profile + aktive id. Bundled kommen aus dem Manifest. */
export type PackageProfileRegistryState = {
  activeProfileId?: string
  /** Gesetzt bei Aktivierung — für Adoption (Capabilities, Inbox, Banner). */
  activeProfileSnapshot?: ActiveProfileSnapshot
  userProfiles: PackageProfile[]
}

export function defaultRegistryState(): PackageProfileRegistryState {
  return { userProfiles: [] }
}

function asUserProfile(p: PackageProfile): PackageProfile {
  return { ...p, bundled: false, readOnly: false }
}

function asBundledProfile(p: PackageProfile): PackageProfile {
  return { ...p, bundled: true, readOnly: true }
}

function parseActiveProfileSnapshot(raw: unknown): ActiveProfileSnapshot | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id.trim() : ''
  const label = typeof o.label === 'string' ? o.label.trim() : ''
  if (!id || !label) return undefined
  const packageId =
    typeof o.packageId === 'string' && /^0x[a-f0-9]{64}$/i.test(o.packageId.trim())
      ? o.packageId.trim().toLowerCase()
      : undefined
  const mailboxId =
    typeof o.mailboxId === 'string' && /^0x[a-f0-9]{64}$/i.test(o.mailboxId.trim())
      ? o.mailboxId.trim().toLowerCase()
      : undefined
  const resolved = o.resolved === true || Boolean(packageId && mailboxId)
  const snap: ActiveProfileSnapshot = { id, label, resolved }
  const color = typeof o.color === 'string' ? o.color.trim() : ''
  if (color) snap.color = color
  if (packageId) snap.packageId = packageId
  if (mailboxId) snap.mailboxId = mailboxId
  const apiBaseUrl = typeof o.apiBaseUrl === 'string' ? o.apiBaseUrl.trim() : ''
  if (/^https?:\/\/[^\s]+$/i.test(apiBaseUrl)) snap.apiBaseUrl = apiBaseUrl
  const capabilities = parseMessengerCapabilitiesOverride(o.capabilities)
  if (capabilities) snap.capabilities = capabilities
  return snap
}

export function toActiveProfileSnapshot(p: PackageProfile): ActiveProfileSnapshot {
  return {
    id: p.id,
    label: p.label,
    ...(p.color ? { color: p.color } : {}),
    ...(p.packageId ? { packageId: p.packageId } : {}),
    ...(p.mailboxId ? { mailboxId: p.mailboxId } : {}),
    resolved: p.resolved,
    ...(p.capabilities ? { capabilities: p.capabilities } : {}),
    ...(p.apiBaseUrl ? { apiBaseUrl: p.apiBaseUrl } : {}),
  }
}

/** Sync: aktives Profil-Snapshot (Capabilities, Inbox-Package, Banner). */
export function readActiveProfileSnapshot(): ActiveProfileSnapshot | undefined {
  return readRegistryState().activeProfileSnapshot
}

export function readRegistryState(): PackageProfileRegistryState {
  if (typeof window === 'undefined') return defaultRegistryState()
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return defaultRegistryState()
    const j = JSON.parse(raw) as Partial<PackageProfileRegistryState>
    const userProfiles: PackageProfile[] = []
    const seen = new Set<string>()
    for (const entry of Array.isArray(j.userProfiles) ? j.userProfiles : []) {
      const p = parsePackageProfile(entry)
      if (!p) continue
      const key = p.id.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      userProfiles.push(asUserProfile(p))
    }
    const activeProfileId =
      typeof j.activeProfileId === 'string' && j.activeProfileId.trim()
        ? j.activeProfileId.trim()
        : undefined
    const activeProfileSnapshot = parseActiveProfileSnapshot(j.activeProfileSnapshot)
    return { activeProfileId, activeProfileSnapshot, userProfiles }
  } catch {
    return defaultRegistryState()
  }
}

export function notifyRegistryChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(PACKAGE_PROFILE_REGISTRY_CHANGED))
}

export function writeRegistryState(state: PackageProfileRegistryState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
  notifyRegistryChanged()
}

/**
 * Bundled + benutzerdefinierte Profile zu einer geordneten Liste (bundled zuerst) zusammenführen.
 * Bei id-Kollision (case-insensitiv) gewinnt das bundled Profil; das benutzerdefinierte wird verworfen.
 */
export function combineProfiles(
  bundled: PackageProfile[],
  state: PackageProfileRegistryState
): PackageProfile[] {
  const out: PackageProfile[] = []
  const seen = new Set<string>()
  for (const p of bundled) {
    const key = p.id.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(asBundledProfile(p))
  }
  for (const p of state.userProfiles) {
    const key = p.id.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(asUserProfile(p))
  }
  return out
}

/** Das aktive Profil auflösen (oder undefined, wenn keine gültige aktive id gesetzt ist). */
export function activeProfile(
  combined: PackageProfile[],
  state: PackageProfileRegistryState
): PackageProfile | undefined {
  if (!state.activeProfileId) return undefined
  const key = state.activeProfileId.toLowerCase()
  return combined.find((p) => p.id.toLowerCase() === key)
}

export type RegistryMutation =
  | { ok: true; state: PackageProfileRegistryState }
  | { ok: false; error: string }

/**
 * Benutzerdefiniertes Profil anlegen/aktualisieren. `bundledIds` schützt vor Überschreiben
 * eines Bundle-Profils (read-only, §7.6). Vorhandene benutzerdefinierte id wird ersetzt.
 */
export function addUserProfile(
  state: PackageProfileRegistryState,
  raw: unknown,
  opts?: { bundledIds?: string[] }
): RegistryMutation {
  const parsed = parsePackageProfile(raw)
  if (!parsed) return { ok: false, error: 'Ungültiges Profil (id/label fehlen oder id-Slug ungültig).' }
  const profile = asUserProfile(parsed)
  const key = profile.id.toLowerCase()
  const bundledIds = (opts?.bundledIds ?? []).map((s) => s.toLowerCase())
  if (bundledIds.includes(key)) {
    return { ok: false, error: `id „${profile.id}“ ist von einem Bundle-Profil belegt.` }
  }
  const userProfiles = state.userProfiles.filter((p) => p.id.toLowerCase() !== key)
  userProfiles.push(profile)
  return { ok: true, state: { ...state, userProfiles } }
}

/** Benutzerdefiniertes Profil entfernen. War es aktiv, wird die aktive id geleert. */
export function removeUserProfile(
  state: PackageProfileRegistryState,
  id: string
): PackageProfileRegistryState {
  const key = id.trim().toLowerCase()
  const userProfiles = state.userProfiles.filter((p) => p.id.toLowerCase() !== key)
  const clearing = state.activeProfileId && state.activeProfileId.toLowerCase() === key
  return {
    activeProfileId: clearing ? undefined : state.activeProfileId,
    activeProfileSnapshot: clearing ? undefined : state.activeProfileSnapshot,
    userProfiles,
  }
}

/** Aktives Profil setzen — nur wenn die id in der kombinierten Liste existiert. */
export function setActiveProfile(
  state: PackageProfileRegistryState,
  id: string,
  combined: PackageProfile[]
): RegistryMutation {
  const key = id.trim().toLowerCase()
  const target = combined.find((p) => p.id.toLowerCase() === key)
  if (!target) return { ok: false, error: `Profil „${id}“ nicht in der Registry.` }
  return {
    ok: true,
    state: {
      ...state,
      activeProfileId: target.id,
      activeProfileSnapshot: toActiveProfileSnapshot(target),
    },
  }
}

/** Kurzform einer 0x-64-Hex-ID für Anzeige: `0xf817…e504`. */
export function shortPackageId(packageId?: string): string {
  const s = (packageId ?? '').trim()
  if (!/^0x[a-f0-9]{64}$/i.test(s)) return '— (nicht konfiguriert)'
  return `${s.slice(0, 6)}…${s.slice(-4)}`
}

export type PackageSwitchWarning = {
  title: string
  targetLine: string
  lines: string[]
  cancelLabel: string
  confirmLabel: string
  /** true, wenn das Ziel-Profil noch keine gültigen IDs hat (§7.6 „Profil veraltet/Platzhalter“). */
  unresolved: boolean
}

/** Pflicht-Warntext beim Einsatzwechsel (Spec §3.2). */
export function buildSwitchWarning(target: PackageProfile): PackageSwitchWarning {
  const lines = [
    'Private Mailboxes des vorherigen Einsatzes sind hier nicht verfügbar.',
    'Handshakes gelten pro Einsatz — ggf. erneut verbinden.',
    'Der Posteingang zeigt nur Nachrichten dieses Packages.',
    'Telefonbuch-Kontakte bleiben dieselben; Kontakt-Mailbox-IDs können pro Einsatz unterschiedlich sein.',
  ]
  if (!target.resolved) {
    lines.push('Achtung: Dieses Profil hat noch keine gültigen IDs — Wechsel erst nach Konfiguration sinnvoll.')
  }
  return {
    title: 'Achtung — Einsatz wechseln',
    targetLine: `Du wechselst zu: „${target.label}“ (Package ${shortPackageId(target.packageId)}).`,
    lines,
    cancelLabel: 'Abbrechen',
    confirmLabel: 'Einsatz wechseln',
    unresolved: !target.resolved,
  }
}

export type LoadedPackageProfileRegistry = {
  profiles: PackageProfile[]
  state: PackageProfileRegistryState
  active?: PackageProfile
}

/** Manifest (bundled) + persistierten Client-Zustand laden und zur kombinierten Registry auflösen. */
export async function loadPackageProfileRegistry(opts?: {
  force?: boolean
}): Promise<LoadedPackageProfileRegistry> {
  const manifest = await loadPackageProfilesManifest(opts)
  const state = readRegistryState()
  const profiles = combineProfiles(manifest.profiles, state)
  return { profiles, state, active: activeProfile(profiles, state) }
}
