'use client'

import type { ApiStatus } from '@/frontend/lib/api'
import { isStandaloneMessengerWithoutBasis } from '@/frontend/lib/dashboard-basis-offline-hint'
import { getDirectIotaSessionSigner } from '@/frontend/lib/direct-iota-mnemonic-session'

/** Browser-RAM-Signer (Wizard, Tresor-Badge) — Server-hasKeys allein reicht nicht. */
export function isBrowserSessionSignerReady(uiLocked = false): boolean {
  if (uiLocked) return false
  return Boolean(getDirectIotaSessionSigner())
}

/**
 * Tresor-/Login-UI offen lassen — nicht schließen nur weil der Server hasKeys meldet.
 * Standalone ohne Backend: Browser-Signer zwingend.
 * Mit Backend: entsperrt wenn Server-Tresor offen ist; fehlender Browser-Signer → leichter Session-Sync.
 */
export function messengerVaultUiShouldStayLocked(
  api: { locked?: boolean; hasKeys?: boolean } | null | undefined,
  browserSignerReady = isBrowserSessionSignerReady(false)
): boolean {
  if (isStandaloneMessengerWithoutBasis()) {
    return !getDirectIotaSessionSigner()
  }
  if (api?.locked === true) return true
  if (api?.hasKeys !== true) return true
  // Backend-Tresor offen: Dashboard nicht an Vault-Dialog binden (Reload, Modus A).
  void browserSignerReady
  return false
}

export function isMessengerVaultSessionComplete(
  api: { locked?: boolean; hasKeys?: boolean } | null | undefined,
  browserSignerReady = isBrowserSessionSignerReady(false)
): boolean {
  return !messengerVaultUiShouldStayLocked(api, browserSignerReady)
}

/** Browser-Signer zählt als sendebereit (Direct-RPC), auch wenn /api/status noch hasKeys=false meldet. */
export function isMessengerSessionKeysReady(apiStatus: ApiStatus | null | undefined): boolean {
  if (isStandaloneMessengerWithoutBasis() && getDirectIotaSessionSigner()) return true
  if (apiStatus?.locked === true) return false
  if (apiStatus?.hasKeys === true) return true
  return Boolean(getDirectIotaSessionSigner())
}

/** Send-Block „Wallet-Keys fehlen“ erst nach erstem Status-Poll (kein Cold-Start-Flash). */
export function shouldBlockSendForMissingSessionKeys(
  apiStatus: ApiStatus | null | undefined,
  statusPollAttempted: boolean
): boolean {
  if (!statusPollAttempted) return false
  return !isMessengerSessionKeysReady(apiStatus)
}

export function enrichApiStatusWithDirectSessionSigner(status: ApiStatus | null): ApiStatus | null {
  if (!status) return status
  if (!getDirectIotaSessionSigner()) return status
  if (isStandaloneMessengerWithoutBasis()) {
    return { ...status, hasKeys: true, locked: false }
  }
  if (status.locked === true || status.hasKeys === true) return status
  return { ...status, hasKeys: true }
}
