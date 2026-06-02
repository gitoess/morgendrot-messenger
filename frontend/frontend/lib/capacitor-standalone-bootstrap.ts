'use client'

/**
 * APK-Start: Autarkie-Defaults (§ H.15, Roadmap Offline-APK Phase 1–2).
 * @see docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md §10
 */
import type { StatusPollClockHint } from '@/frontend/lib/device-time-trust'
import { getApiBase } from '@/frontend/lib/api/api-base'
import type { ApiStatus } from '@/frontend/lib/api/status'
import { isCapacitorNativePlatform } from '@/frontend/lib/capacitor-platform'
import { getDirectChainIdsReadiness } from '@/frontend/lib/direct-iota-chain-context'
import { syncLocalHandoffSnapshotToChainContext } from '@/frontend/lib/handoff-device-bootstrap'
import { readLocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'
import { isAutarkyModeEnabled } from '@/frontend/lib/autarky-status-line'
import {
  setDirectMailboxDrainEnabled,
  setIotaSubmitMode,
} from '@/frontend/lib/direct-iota-plain-submit'
import { setDirectChainOptimisticFlagsEnabled } from '@/frontend/lib/direct-iota-chain-context'
import { restoreDirectChatEcdhPrivateFromLocalStorage } from '@/frontend/lib/direct-chat-ecdh-session'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import {
  MESSAGING_PERSISTENCE_MODE_LS_KEY,
  type MessagingPersistenceMode,
} from '@/frontend/lib/messaging-persistence-mode'

const LS_CAP_BOOT = 'morgendrot.capacitorStandaloneBootstrapped.v1'

export function isStandaloneDeviceMode(): boolean {
  return isCapacitorNativePlatform() || isAutarkyModeEnabled()
}

/** Einmalig beim ersten APK-Start: Direkt-IOTA-Defaults (ohne Server). */
export function bootstrapCapacitorStandaloneSession(): void {
  if (!isCapacitorNativePlatform()) return
  if (typeof window === 'undefined') return

  const handoff = readLocalHandoffAppliedSnapshot()
  if (handoff) syncLocalHandoffSnapshotToChainContext(handoff)

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
  if (getApiBase().trim()) return null

  const handoff = readLocalHandoffAppliedSnapshot()
  const chain = getDirectChainIdsReadiness()
  const rpc = getConfiguredDirectIotaRpcUrl()
  if (!handoff && !chain.ready) return null

  const savedAtMs = handoff?.savedAtMs ?? Date.now()
  const missingSigner = chain.missing.includes('Absender (0x)')

  return {
    status: {
      backendOnline: false,
      backendRunning: false,
      connected: false,
      fromCache: true,
      fromLocalHandoff: Boolean(handoff),
      cacheSavedAtMs: savedAtMs,
      handoffLabel: handoff?.handoffLabel,
      role: handoff?.role ?? 'messenger',
      deploymentProfile: handoff?.deploymentProfile ?? 'einsatz',
      transportProfile: handoff?.transportProfile ?? 'mesh-first',
      uiVariant: handoff?.uiVariant ?? 'messenger',
      simpleMode: handoff?.simpleMode ?? true,
      packageId: handoff?.packageId,
      mailboxId: handoff?.mailboxId,
      useMailbox: true,
      mailboxConfigured: Boolean(handoff?.mailboxId),
      mailboxStorePlaintext: true,
      messengerCreditsConfigured: false,
      plaintextMode: true,
      uiMode: handoff?.simpleMode === false ? 'expert' : 'simple',
      configHints: missingSigner
        ? ['Standalone-APK: Signer in Puls setzen (Mnemonic), dann Direkt senden.']
        : rpc
          ? ['Standalone-APK: ohne Morgendrot-Basis — Direkt-RPC und lokales Handoff aktiv.']
          : ['Standalone-APK: Fullnode-URL in Puls oder Handoff ergänzen.'],
      rpcUrlLabel: rpc ?? undefined,
    },
    pollClockHint: { okAtMs: savedAtMs, httpDateUtcMs: null },
  }
}
