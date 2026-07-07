'use client'

/**
 * APK-Start: Autarkie-Defaults (§ H.15, Roadmap Offline-APK Phase 1–2).
 * @see docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md §10
 */
import type { StatusPollClockHint } from '@/frontend/lib/device-time-trust'
import { getApiBase } from '@/frontend/lib/api/api-base'
import type { ApiStatus } from '@/frontend/lib/api/api-status-types'
import { isCapacitorNativePlatform } from '@/frontend/lib/capacitor-platform'
import { getDirectChainIdsReadiness } from '@/frontend/lib/direct-iota-chain-context'
import { syncLocalHandoffSnapshotToChainContext } from '@/frontend/lib/handoff-device-bootstrap'
import { readLocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'
import { broadcastPinnwandStatusFromHandoff } from '@/frontend/lib/broadcast-pinnwand-handoff-status'
import { isStandaloneDeviceMode, shouldPreferStandaloneHandoffStatus } from '@/frontend/lib/standalone-device-mode'
import {
  setDirectMailboxDrainEnabled,
  setIotaSubmitMode,
} from '@/frontend/lib/direct-iota-plain-submit'
import { setDirectChainOptimisticFlagsEnabled } from '@/frontend/lib/direct-iota-chain-context'
import { restoreDirectChatEcdhPrivateFromLocalStorage } from '@/frontend/lib/direct-chat-ecdh-session'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import {
  getDirectIotaSessionSigner,
  getDirectIotaSessionSignerAddress,
  hasPersistedDirectIotaSessionSigner,
} from '@/frontend/lib/direct-iota-mnemonic-session'
import { readStandaloneLocalIdentitySnapshot } from '@/frontend/lib/standalone-local-identity'
import {
  isStandaloneSoloPath,
  readStandaloneOnboardingPath,
} from '@/frontend/lib/standalone-onboarding'
import { resolveMessengerCapabilities } from '@morgendrot/shared/messenger-capabilities-matrix'
import type { LocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'
import { ensureI18nInitialized, i18n } from '@/frontend/lib/i18n/client'
import { standaloneT } from '@/frontend/lib/i18n/standalone-tt'
import {
  MESSAGING_PERSISTENCE_MODE_LS_KEY,
  type MessagingPersistenceMode,
} from '@/frontend/lib/messaging-persistence-mode'

const LS_CAP_BOOT = 'morgendrot.capacitorStandaloneBootstrapped.v1'

function standaloneCapabilitiesForHandoff(handoff: LocalHandoffAppliedSnapshot | null) {
  return resolveMessengerCapabilities({
    roleId: 6,
    simpleMode: handoff?.simpleMode ?? true,
    transportProfile: handoff?.transportProfile ?? 'mesh-first',
    hierarchyRole: handoff?.role ?? 'messenger',
    override: {
      transport: {
        iota: { read: true, write: true },
      },
    },
  })
}

export { isAutarkyModeEnabled, isStandaloneDeviceMode, shouldPreferStandaloneHandoffStatus } from '@/frontend/lib/standalone-device-mode'

export function resolveStandaloneDeviceLocked(): boolean {
  if (typeof window === 'undefined') return false
  if (!isStandaloneDeviceMode()) return false
  if (getApiBase().trim() && !shouldPreferStandaloneHandoffStatus()) return false
  if (getDirectIotaSessionSigner()) return false
  const handoff = readLocalHandoffAppliedSnapshot()
  if (handoff || hasPersistedDirectIotaSessionSigner()) return true
  if (isStandaloneSoloPath()) return true
  return false
}

/** Einmalig beim ersten APK-Start: Direkt-IOTA-Defaults (ohne Server). */
export function bootstrapCapacitorStandaloneSession(): void {
  if (!isCapacitorNativePlatform()) return
  if (typeof window === 'undefined') return

  const handoff = readLocalHandoffAppliedSnapshot()
  if (handoff) {
    syncLocalHandoffSnapshotToChainContext(handoff)
    setIotaSubmitMode('client')
    setDirectMailboxDrainEnabled(true)
    setDirectChainOptimisticFlagsEnabled(true)
  }

  void restoreDirectChatEcdhPrivateFromLocalStorage()

  try {
    if (window.localStorage.getItem(LS_CAP_BOOT) === '1') return
    window.localStorage.setItem('morgendrot.autarkyMode', '1')
    setIotaSubmitMode('client')
    setDirectMailboxDrainEnabled(true)
    setDirectChainOptimisticFlagsEnabled(true)
    const persistMode: MessagingPersistenceMode = 'mailbox'
    window.localStorage.setItem(MESSAGING_PERSISTENCE_MODE_LS_KEY, persistMode)
    window.localStorage.setItem(LS_CAP_BOOT, '1')
  } catch {
    /* ignore */
  }
}

/**
 * Status ohne erreichbare Basis-URL (leere API-Basis in der APK).
 * Nur wenn Handoff/Ketten-IDs + RPC lokal konfiguriert sind.
 */
export function readStandaloneDeviceStatusFallback():
  | { status: ApiStatus; pollClockHint: StatusPollClockHint }
  | null {
  if (typeof window === 'undefined') return null
  if (!isStandaloneDeviceMode()) return null
  const apiBase = getApiBase().trim()
  if (apiBase && !shouldPreferStandaloneHandoffStatus()) return null

  const handoff = readLocalHandoffAppliedSnapshot()
  const chain = getDirectChainIdsReadiness()
  const rpc = getConfiguredDirectIotaRpcUrl()
  if (!handoff && !chain.ready) {
    if (!isCapacitorNativePlatform()) return null
    ensureI18nInitialized()
    const tt = standaloneT
    const onboardingPath = readStandaloneOnboardingPath()
    const solo = isStandaloneSoloPath()
    return {
      status: {
        backendOnline: false,
        backendRunning: false,
        connected: false,
        fromCache: true,
        role: 'messenger',
        deploymentProfile: solo ? 'consumer' : 'einsatz',
        transportProfile: solo ? 'iota-anchored' : 'mesh-first',
        uiVariant: 'messenger',
        simpleMode: true,
        signer: 'sdk',
        useMailbox: true,
        locked: resolveStandaloneDeviceLocked(),
        hasKeys: Boolean(getDirectIotaSessionSigner()),
        configHints: solo
          ? [tt('hints.soloWalletSetup')]
          : onboardingPath === 'einsatz'
            ? [tt('hints.einsatzAwaitHandoff')]
            : [tt('hints.firstStartChoice')],
        capabilities: standaloneCapabilitiesForHandoff(null),
        roleId: 6,
      },
      pollClockHint: { okAtMs: Date.now(), httpDateUtcMs: null },
    }
  }

  const savedAtMs = handoff?.savedAtMs ?? Date.now()
  const broadcastPinnwand = broadcastPinnwandStatusFromHandoff(handoff)
  const missingSigner = chain.missing.includes('Absender (0x)')
  const standaloneLocked = resolveStandaloneDeviceLocked()
  const sessionSignerActive = Boolean(getDirectIotaSessionSigner())
  const identity = readStandaloneLocalIdentitySnapshot()
  const addrFull = getDirectIotaSessionSignerAddress() || identity.myAddress || ''
  ensureI18nInitialized()
  const tt = standaloneT

  return {
    status: {
      backendOnline: false,
      backendRunning: false,
      connected: false,
      fromCache: true,
      fromLocalHandoff: Boolean(handoff),
      locked: standaloneLocked,
      hasKeys: sessionSignerActive,
      cacheSavedAtMs: savedAtMs,
      handoffLabel: handoff?.handoffLabel,
      role: handoff?.role ?? 'messenger',
      deploymentProfile: handoff?.deploymentProfile ?? 'einsatz',
      transportProfile: handoff?.transportProfile ?? 'mesh-first',
      uiVariant: handoff?.uiVariant ?? 'messenger',
      simpleMode: handoff?.simpleMode ?? true,
      packageId: (handoff?.packageId ?? identity.packageId) || undefined,
      mailboxId: (handoff?.mailboxId ?? identity.mailboxId) || undefined,
      myAddress: addrFull ? `${addrFull.slice(0, 10)}…${addrFull.slice(-6)}` : undefined,
      myAddressFull: addrFull || undefined,
      useMailbox: true,
      mailboxConfigured: Boolean(handoff?.mailboxId),
      mailboxStorePlaintext: true,
      messengerCreditsConfigured: false,
      plaintextMode: true,
      signer: 'sdk',
      uiMode: handoff?.simpleMode === false ? 'expert' : 'simple',
      configHints: missingSigner
        ? [tt('hints.handoffOkNeedSeed')]
        : rpc
          ? [tt('hints.standaloneActive')]
          : [tt('hints.missingFullnode')],
      rpcUrlLabel: rpc ?? undefined,
      ...(broadcastPinnwand ? { broadcastPinnwand } : {}),
      capabilities: standaloneCapabilitiesForHandoff(handoff),
      roleId: 6,
    },
    pollClockHint: { okAtMs: savedAtMs, httpDateUtcMs: null },
  }
}
