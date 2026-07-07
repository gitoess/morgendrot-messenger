'use client'

/**
 * Standalone-APK Erststart: Einsatz (Boss-Handoff) vs. Privat/Solo ohne Boss.
 * @see docs/HANDOFF-UND-MODUS-ZIELBILD.md §3
 */
import {
  readLocalHandoffAppliedSnapshot,
  saveLocalHandoffAppliedSnapshot,
  type LocalHandoffAppliedSnapshot,
} from '@/frontend/lib/handoff-local-apply'
import { syncLocalHandoffSnapshotToChainContext } from '@/frontend/lib/handoff-device-bootstrap'
import {
  setDirectMailboxDrainEnabled,
  setIotaSubmitMode,
  getIotaSubmitMode,
  isDirectMailboxDrainEnabled,
} from '@/frontend/lib/direct-iota-plain-submit'
import { setDirectChainOptimisticFlagsEnabled, getDirectChainIdsReadiness } from '@/frontend/lib/direct-iota-chain-context'
import { hasPersistedDirectIotaSessionSigner } from '@/frontend/lib/direct-iota-mnemonic-session'
import { isStandaloneMessengerWithoutBasis } from '@/frontend/lib/standalone-device-mode'
import { ensureI18nInitialized, i18n } from '@/frontend/lib/i18n/client'
import {
  readOnboardingProgress,
  startOnboarding,
} from '@/frontend/lib/onboarding-progress-store'
import { ensureBossRoleOnServer } from '@/frontend/lib/onboarding-boss-bootstrap'

export const STANDALONE_ONBOARDING_PATH_LS_KEY = 'morgendrot.standaloneOnboardingPath.v1'

export type StandaloneOnboardingPath = 'boss' | 'einsatz' | 'solo'

const LS_ONBOARDING_PATH = STANDALONE_ONBOARDING_PATH_LS_KEY

export const STANDALONE_ONBOARDING_CHANGED_EVENT = 'morgendrot.standaloneOnboardingChanged' as const
export const STANDALONE_SOLO_WALLET_SETUP_REQUEST_EVENT = 'morgendrot.standaloneSoloWalletSetupRequest' as const

export function readStandaloneOnboardingPath(): StandaloneOnboardingPath | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LS_ONBOARDING_PATH)?.trim()
    if (raw === 'boss' || raw === 'einsatz' || raw === 'solo') return raw
    return null
  } catch {
    return null
  }
}

export function setStandaloneOnboardingPath(path: StandaloneOnboardingPath): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_ONBOARDING_PATH, path)
  } catch {
    /* ignore */
  }
  notifyStandaloneOnboardingChanged()
}

export function isStandaloneSoloPath(): boolean {
  return readStandaloneOnboardingPath() === 'solo'
}

export function isStandaloneBossPath(): boolean {
  return readStandaloneOnboardingPath() === 'boss'
}

export function isStandaloneEinsatzPath(): boolean {
  return readStandaloneOnboardingPath() === 'einsatz'
}

export function notifyStandaloneOnboardingChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(STANDALONE_ONBOARDING_CHANGED_EVENT))
  window.dispatchEvent(new CustomEvent('morgendrot.apiBaseChanged'))
}

export function requestStandaloneSoloWalletSetup(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(STANDALONE_SOLO_WALLET_SETUP_REQUEST_EVENT))
}

/** Noch kein gewählter Startpfad (Standalone oder Desktop ohne Einsatz-Rolle). */
export function needsFirstStartChoice(apiRole?: string | null): boolean {
  if (readStandaloneOnboardingPath()) return false
  if (readLocalHandoffAppliedSnapshot()) return false
  if (hasPersistedDirectIotaSessionSigner()) return false
  if (readOnboardingProgress()?.finishedAtMs) return false

  if (isStandaloneMessengerWithoutBasis()) return true

  const role = (apiRole || '').trim().toLowerCase()
  if (role === 'boss' || role === 'kommandant' || role === 'arbeiter') return false
  return role === '' || role === 'messenger' || role === 'user'
}

/** @deprecated Nutze needsFirstStartChoice — bleibt für Standalone-Kompatibilität. */
export function needsStandaloneOnboardingChoice(): boolean {
  return needsFirstStartChoice()
}

export function buildStandaloneBossProfileSnapshot(): LocalHandoffAppliedSnapshot {
  ensureI18nInitialized()
  return {
    savedAtMs: Date.now(),
    handoffLabel: i18n.t('profileLabelBoss', { ns: 'standalone', defaultValue: 'Einsatzleitung' }),
    role: 'boss',
    deploymentProfile: 'einsatz',
    transportProfile: 'mesh-first',
    uiVariant: 'messenger',
    simpleMode: false,
  }
}

export function buildStandaloneSoloProfileSnapshot(): LocalHandoffAppliedSnapshot {
  ensureI18nInitialized()
  return {
    savedAtMs: Date.now(),
    handoffLabel: i18n.t('profileLabelSolo', { ns: 'standalone' }),
    role: 'messenger',
    deploymentProfile: 'consumer',
    transportProfile: 'iota-anchored',
    uiVariant: 'messenger',
    simpleMode: true,
  }
}

function applyStandaloneDirectIotaDefaults(): void {
  setIotaSubmitMode('client')
  setDirectMailboxDrainEnabled(true)
  setDirectChainOptimisticFlagsEnabled(true)
}

/** Privat/Solo: Consumer-Profil lokal anlegen — Wallet über Startkarte/Tresor, Wizard optional. */
export function beginStandaloneSoloOnboarding(): void {
  setStandaloneOnboardingPath('solo')
  startOnboarding('wanderer')
  const snapshot = buildStandaloneSoloProfileSnapshot()
  saveLocalHandoffAppliedSnapshot(snapshot)
  applyStandaloneDirectIotaDefaults()
  syncLocalHandoffSnapshotToChainContext(snapshot)
}

/** Einsatzleitung (Boss bei 0): Profil lokal — Wizard optional unter Einstellungen / Einrichtungs-Karte. */
export function beginStandaloneBossOnboarding(): void {
  setStandaloneOnboardingPath('boss')
  const snapshot = buildStandaloneBossProfileSnapshot()
  saveLocalHandoffAppliedSnapshot(snapshot)
  syncLocalHandoffSnapshotToChainContext(snapshot)
  startOnboarding('boss')
  void ensureBossRoleOnServer()
}

/** Einsatz-Helfer: Pfad merken — Handoff-ZIP folgt separat; Wizard optional. */
export function beginStandaloneEinsatzOnboarding(): void {
  setStandaloneOnboardingPath('einsatz')
  startOnboarding('helper')
}

/**
 * mesh-first-Profil schaltet beim Chat-Start sonst auf Funk — Solo/Standalone-Direkt-RPC bleibt Online.
 */
export function shouldApplyMeshFirstTransportDefault(transportProfile?: string | null): boolean {
  if (transportProfile !== 'mesh-first') return false
  if (isStandaloneSoloPath()) return false
  if (!isStandaloneMessengerWithoutBasis()) return true
  return !(
    getIotaSubmitMode() === 'client' &&
    isDirectMailboxDrainEnabled() &&
    getDirectChainIdsReadiness().ready
  )
}
