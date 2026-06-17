'use client'

import type { ApiStatus } from '@/frontend/lib/api'
import { getDirectIotaSessionSigner } from '@/frontend/lib/direct-iota-mnemonic-session'

/** Browser-Signer zählt als sendebereit (Direct-RPC), auch wenn /api/status noch hasKeys=false meldet. */
export function isMessengerSessionKeysReady(apiStatus: ApiStatus | null | undefined): boolean {
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
  if (status.locked === true || status.hasKeys === true) return status
  if (!getDirectIotaSessionSigner()) return status
  return { ...status, hasKeys: true }
}
