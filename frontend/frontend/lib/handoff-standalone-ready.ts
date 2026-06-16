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
import { readLocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'
import {
  parseHandoffEnvLines,
  readHandoffEnvBackup,
  syncLocalHandoffSnapshotToChainContext,
} from '@/frontend/lib/handoff-device-bootstrap'
import { DIRECT_IOTA_UI_CHANGED } from '@/frontend/lib/direct-iota-ui-events'
import { getIncludeSdkMnemonicInBackup } from '@/frontend/lib/vault-sdk-mnemonic-preference'

export const STANDALONE_HANDOFF_APPLIED_EVENT = 'morgendrot.standaloneHandoffApplied' as const
export const HELPER_SEED_SETUP_REQUEST_EVENT = 'morgendrot.helperSeedSetupRequest' as const

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

export function shouldShowHelperSeedSetupDialog(): boolean {
  const r = getStandaloneHelperReadiness()
  return r.standaloneMode && r.hasHandoff && r.needsMnemonic && !isStandaloneSoloPath()
}

export function maybeRequestHelperSeedSetup(): void {
  if (typeof window === 'undefined') return
  if (shouldShowHelperSeedSetupDialog()) {
    window.dispatchEvent(new CustomEvent(HELPER_SEED_SETUP_REQUEST_EVENT))
  }
}

export function notifyStandaloneWalletActivated(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(DIRECT_IOTA_UI_CHANGED))
  window.dispatchEvent(new CustomEvent('morgendrot.apiBaseChanged'))
}

export function getStandaloneHelperReadiness(): StandaloneHelperReadiness {
  const standaloneMode = isStandaloneMessengerWithoutBasis()
  const handoff = readLocalHandoffAppliedSnapshot()
  const chain = getDirectChainIdsReadiness()
  const hasHandoff = Boolean(handoff)
  const needsMnemonic = !getDirectIotaSessionSignerAddress()
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
  if (password.length >= 8 && getIncludeSdkMnemonicInBackup()) {
    await persistDirectIotaSessionSignerEncrypted({
      signerImportRaw: mnemonic,
      password,
    })
  }

  const handoff = readLocalHandoffAppliedSnapshot()
  const envBackup = readHandoffEnvBackup()
  if (handoff) {
    const env = envBackup ? parseHandoffEnvLines(envBackup) : undefined
    syncLocalHandoffSnapshotToChainContext(handoff, env)
    if (env) seedPartnersFromHandoffEnv(env)
  }

  const ecdh = await ensureStandaloneChatEcdhKeypair()
  if (!ecdh.ok) {
    return { ok: false, error: ecdh.error }
  }

  notifyStandaloneWalletActivated()
  return { ok: true, address: applied.address }
}
