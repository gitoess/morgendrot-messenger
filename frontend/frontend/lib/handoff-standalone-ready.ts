'use client'

/**
 * Standalone-APK / Helfer: Handoff → nur noch Mnemonic — Rest aus ZIP vorkonfiguriert.
 */
import { isStandaloneMessengerWithoutBasis } from '@/frontend/lib/dashboard-basis-offline-hint'
import { isStandaloneSoloPath, readStandaloneOnboardingPath, setStandaloneOnboardingPath } from '@/frontend/lib/standalone-onboarding'
import { standaloneT } from '@/frontend/lib/i18n/standalone-tt'
import { ensureI18nInitialized } from '@/frontend/lib/i18n/client'
import { addConnectedPeerToLocalSnapshot } from '@/frontend/lib/connected-peers-snapshot'
import { getDirectChainIdsReadiness, persistDirectChainFieldIds } from '@/frontend/lib/direct-iota-chain-context'
import {
  ensureStandaloneChatEcdhKeypair,
} from '@/frontend/lib/direct-chat-ecdh-session'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import {
  applyDirectIotaMnemonicSession,
  getDirectIotaSessionSignerAddress,
  persistDirectIotaSessionSignerEncrypted,
} from '@/frontend/lib/direct-iota-mnemonic-session'
import {
  getIotaSubmitMode,
  isDirectMailboxDrainEnabled,
  listDirectIotaSetupGaps,
} from '@/frontend/lib/direct-iota-plain-submit'
import { readLocalHandoffAppliedSnapshot, type LocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'
import {
  parseHandoffEnvLines,
  readHandoffEnvBackup,
  syncLocalHandoffSnapshotToChainContext,
} from '@/frontend/lib/handoff-device-bootstrap'
import { DIRECT_IOTA_UI_CHANGED } from '@/frontend/lib/direct-iota-ui-events'
import { getIncludeSdkMnemonicInBackup } from '@/frontend/lib/vault-sdk-mnemonic-preference'

export const STANDALONE_HANDOFF_APPLIED_EVENT = 'morgendrot.standaloneHandoffApplied' as const
export const HELPER_SEED_SETUP_REQUEST_EVENT = 'morgendrot.helperSeedSetupRequest' as const
/** Wallet auf APK/Standalone entsperrt — UI-Overlays bereinigen (nur nach Dialog-Close feuern). */
export const STANDALONE_WALLET_UNLOCKED_EVENT = 'morgendrot.standaloneWalletUnlocked' as const
const LS_HELPER_WALLET_ACTIVATED = 'morgendrot.handoff.helperWalletActivated.v1'

type HelperWalletActivatedMarker = {
  handoffSavedAtMs: number
}

function readHelperWalletActivatedForCurrentHandoff(): boolean {
  if (typeof window === 'undefined') return false
  const handoff = readLocalHandoffAppliedSnapshot()
  if (!handoff) return false
  try {
    const raw = window.localStorage.getItem(LS_HELPER_WALLET_ACTIVATED)
    if (!raw) return false
    const parsed = JSON.parse(raw) as HelperWalletActivatedMarker
    return parsed.handoffSavedAtMs === handoff.savedAtMs
  } catch {
    return false
  }
}

function markHelperWalletActivatedForCurrentHandoff(): void {
  if (typeof window === 'undefined') return
  const handoff = readLocalHandoffAppliedSnapshot()
  if (!handoff) return
  try {
    window.localStorage.setItem(
      LS_HELPER_WALLET_ACTIVATED,
      JSON.stringify({ handoffSavedAtMs: handoff.savedAtMs } satisfies HelperWalletActivatedMarker)
    )
  } catch {
    /* ignore */
  }
}

function resolveNeedsMnemonicForHandoff(handoff: LocalHandoffAppliedSnapshot | null): boolean {
  if (isHelperHandoffProfileForSeedSetup(handoff)) {
    return !readHelperWalletActivatedForCurrentHandoff()
  }
  return !getDirectIotaSessionSignerAddress()
}

export type StandaloneHelperReadiness = {
  standaloneMode: boolean
  hasHandoff: boolean
  handoffLabel?: string
  configuredFromHandoff: {
    packageId: boolean
    mailboxId: boolean
    rpcUrl: boolean
    drain: boolean
    directMode: boolean
  }
  needsMnemonic: boolean
  readyForChat: boolean
  remainingStepLabels: string[]
}

function seedPartnersFromHandoffEnv(env: Record<string, string>): void {
  const add = (raw?: string) => {
    const t = String(raw || '').trim()
    if (t) addConnectedPeerToLocalSnapshot(t)
  }
  add(env.BOSS_ADDRESS)
  add(env.PARTNER_ADDRESS)
  const multi = env.PARTNER_ADDRESSES?.trim()
  if (multi) {
    for (const part of multi.split(',')) add(part)
  }
}

export function notifyStandaloneHandoffApplied(): void {
  if (typeof window === 'undefined') return
  if (!readStandaloneOnboardingPath() && !isStandaloneSoloPath()) {
    setStandaloneOnboardingPath('einsatz')
  }
  window.dispatchEvent(new CustomEvent(STANDALONE_HANDOFF_APPLIED_EVENT))
  window.dispatchEvent(new Event(DIRECT_IOTA_UI_CHANGED))
  window.dispatchEvent(new CustomEvent('morgendrot.apiBaseChanged'))
  maybeRequestHelperSeedSetup()
}

export function isHelperHandoffProfileForSeedSetup(handoff: LocalHandoffAppliedSnapshot | null): boolean {
  if (!handoff) return false
  const role = (handoff.role || '').trim().toLowerCase()
  if (role === 'boss' || role === 'kommandant') return false
  if (handoff.simpleMode === true) return true
  if (handoff.uiVariant === 'messenger') return true
  if (role === 'messenger' || role === 'arbeiter' || role === 'lock') return true
  return !role
}

export function shouldShowHelperSeedSetupDialog(): boolean {
  const r = getStandaloneHelperReadiness()
  if (isStandaloneSoloPath()) return false
  if (!r.hasHandoff || !r.needsMnemonic) return false
  if (r.standaloneMode) return true
  return isHelperHandoffProfileForSeedSetup(readLocalHandoffAppliedSnapshot())
}

export function maybeRequestHelperSeedSetup(): void {
  if (typeof window === 'undefined') return
  if (shouldShowHelperSeedSetupDialog()) {
    window.dispatchEvent(new CustomEvent(HELPER_SEED_SETUP_REQUEST_EVENT))
  }
}

/** Nur lokale Marker — ohne Status-Poll während Tresor-Dialog noch offen ist. */
export function markStandaloneWalletActivatedLocal(): void {
  if (typeof window === 'undefined') return
  if (isHelperHandoffProfileForSeedSetup(readLocalHandoffAppliedSnapshot())) {
    markHelperWalletActivatedForCurrentHandoff()
  }
}

/** Nach geschlossenem Tresor: UI/Status aktualisieren. */
export function notifyStandaloneWalletActivated(): void {
  if (typeof window === 'undefined') return
  markStandaloneWalletActivatedLocal()
  window.dispatchEvent(new Event(DIRECT_IOTA_UI_CHANGED))
  window.dispatchEvent(new CustomEvent('morgendrot.apiBaseChanged'))
}

export function getStandaloneHelperReadiness(): StandaloneHelperReadiness {
  const standaloneMode = isStandaloneMessengerWithoutBasis()
  const handoff = readLocalHandoffAppliedSnapshot()
  const chain = getDirectChainIdsReadiness()
  const hasHandoff = Boolean(handoff)
  const needsMnemonic = resolveNeedsMnemonicForHandoff(handoff)
  const configuredFromHandoff = {
    packageId: !chain.missing.includes('Package-ID'),
    mailboxId: !chain.missing.includes('Mailbox-ID'),
    rpcUrl: Boolean(getConfiguredDirectIotaRpcUrl()),
    drain: isDirectMailboxDrainEnabled(),
    directMode: getIotaSubmitMode() === 'client',
  }
  const readyForChat =
    standaloneMode &&
    hasHandoff &&
    !needsMnemonic &&
    chain.ready &&
    configuredFromHandoff.drain &&
    configuredFromHandoff.rpcUrl

  const remainingStepLabels: string[] = []
  ensureI18nInitialized()
  const tt = standaloneT
  if (!hasHandoff) {
    if (isStandaloneSoloPath()) {
      remainingStepLabels.push(tt('readiness.setupWallet'))
    } else {
      remainingStepLabels.push(tt('readiness.importHandoff'))
    }
  } else if (needsMnemonic) {
    remainingStepLabels.push(
      isStandaloneSoloPath() ? tt('readiness.enterMnemonicSolo') : tt('readiness.enterMnemonicBoss')
    )
  } else if (!readyForChat) {
    if (isStandaloneSoloPath()) {
      remainingStepLabels.push(tt('readiness.setupChain'))
    } else {
      for (const gap of listDirectIotaSetupGaps()) {
        if (!remainingStepLabels.includes(gap)) remainingStepLabels.push(gap)
      }
    }
  }

  return {
    standaloneMode,
    hasHandoff,
    handoffLabel: handoff?.handoffLabel,
    configuredFromHandoff,
    needsMnemonic,
    readyForChat,
    remainingStepLabels,
  }
}

/** Mnemonic anwenden, Ketten-Snapshot + optional ECDH für Standalone-Helfer. */
export async function activateStandaloneHelperWallet(opts: {
  mnemonic: string
  password?: string
}): Promise<{ ok: true; address: string } | { ok: false; error: string }> {
  const mnemonic = String(opts.mnemonic || '').trim()
  if (!mnemonic) return { ok: false, error: 'Mnemonic fehlt.' }

  const applied = applyDirectIotaMnemonicSession(mnemonic)
  if (!applied.ok) return applied

  persistDirectChainFieldIds({ senderAddress: applied.address })

  const password = String(opts.password || '').trim()

  const handoff = readLocalHandoffAppliedSnapshot()
  const envBackup = readHandoffEnvBackup()
  if (handoff) {
    const env = envBackup ? parseHandoffEnvLines(envBackup) : undefined
    syncLocalHandoffSnapshotToChainContext(handoff, env)
    if (env) seedPartnersFromHandoffEnv(env)
  }

  if (password.length >= 8 && getIncludeSdkMnemonicInBackup()) {
    const pwd = password
    const mem = mnemonic
    window.setTimeout(() => {
      void persistDirectIotaSessionSignerEncrypted({ signerImportRaw: mem, password: pwd }).then((saved) => {
        if (!saved.ok) console.warn('[standalone] Session-Signer lokal speichern fehlgeschlagen:', saved.error)
      })
    }, 400)
  }

  markStandaloneWalletActivatedLocal()

  if (typeof window !== 'undefined') {
    const runEcdh = () => void ensureStandaloneChatEcdhKeypair()
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(runEcdh, { timeout: 4000 })
    } else {
      globalThis.setTimeout(runEcdh, 1500)
    }
  }

  return { ok: true, address: applied.address }
}
