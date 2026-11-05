'use client'

/**
 * § H.24b P3 — Client-Namespaces pro Einsatzprofil (mittlere Daten-Trennung, Spec §3.3 / §7.2).
 *
 * Prinzip: Telefonbuch/Basis-Kontakte bleiben **global**; private Mailboxes, Handshakes,
 * aktive Mailbox und Posteingang-Fetch sind **pro Profil**. Solange **kein** Profil aktiv ist,
 * bleibt der Legacy-Key unverändert (rückwärtskompatibel — „alles global heute“, §3.3).
 *
 * Diese Scheibe liefert das **Fundament** (Key-Bildung + Scope-Klassifikation + scoped
 * localStorage-Helfer). Die einzelnen Stores übernehmen es **inkrementell**.
 */

import { readRegistryState } from '@/frontend/lib/package-profile-registry'

/** Kein aktives Profil → Legacy-/globaler Namensraum. */
export const GLOBAL_PROFILE_NAMESPACE = 'default'

export type ProfileDataScope = 'global' | 'per-profile'

/** Domänen-Klassifikation nach Spec §3.3. */
export const PROFILE_DATA_SCOPE: Record<string, ProfileDataScope> = {
  telefonbuch: 'global',
  contacts: 'global',
  /** Kontakt-Send-Slot + vier Mailbox-Slots pro Wallet (Spec §3.3 Override). */
  contactMailboxSlots: 'per-profile',
  privateMailboxes: 'per-profile',
  handshakes: 'per-profile',
  peerMap: 'per-profile',
  activeMailbox: 'per-profile',
  inbox: 'per-profile',
}

export function scopeForDomain(domain: string): ProfileDataScope {
  return PROFILE_DATA_SCOPE[domain] ?? 'per-profile'
}

export function isPerProfileDomain(domain: string): boolean {
  return scopeForDomain(domain) === 'per-profile'
}

/** Normalisiert eine Profil-id zu einem stabilen Namespace-Token. */
export function profileNamespaceToken(profileId?: string): string {
  const id = (profileId ?? '').trim().toLowerCase()
  return id || GLOBAL_PROFILE_NAMESPACE
}

/**
 * Bildet den effektiven localStorage-Key. Ohne aktives Profil (Token = `default`)
 * bleibt der Basis-Key **unverändert** — bestehende Daten wandern nicht.
 */
export function namespacedKey(baseKey: string, profileId?: string): string {
  const token = profileNamespaceToken(profileId)
  if (token === GLOBAL_PROFILE_NAMESPACE) return baseKey
  return `${baseKey}::einsatz=${token}`
}

/** Aktive Profil-id aus der Registry (oder undefined). */
export function activeProfileId(): string | undefined {
  return readRegistryState().activeProfileId
}

/**
 * Effektiver Key für eine Domäne + Basis-Key. `global`-Domänen ignorieren das aktive Profil.
 * `per-profile`-Domänen werden mit dem aktiven Profil (falls vorhanden) genamespaced.
 */
export function scopedKey(domain: string, baseKey: string): string {
  if (!isPerProfileDomain(domain)) return baseKey
  return namespacedKey(baseKey, activeProfileId())
}

function safeLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** localStorage-get über den effektiven (ggf. genamespacten) Key. */
export function readScoped(domain: string, baseKey: string): string | null {
  const ls = safeLocalStorage()
  if (!ls) return null
  try {
    return ls.getItem(scopedKey(domain, baseKey))
  } catch {
    return null
  }
}

export function writeScoped(domain: string, baseKey: string, value: string): void {
  const ls = safeLocalStorage()
  if (!ls) return
  try {
    ls.setItem(scopedKey(domain, baseKey), value)
  } catch {
    /* ignore */
  }
}

export function removeScoped(domain: string, baseKey: string): void {
  const ls = safeLocalStorage()
  if (!ls) return
  try {
    ls.removeItem(scopedKey(domain, baseKey))
  } catch {
    /* ignore */
  }
}
