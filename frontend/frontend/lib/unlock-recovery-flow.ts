import type { ApiStatus } from '@/frontend/lib/api'

/**
 * § H.0 #4: Recovery-Hinweis direkt nach Unlock nur anbieten, wenn
 * eine lokale SDK-Vault vorhanden und die Sitzung entsperrt ist.
 */
export function shouldOfferRecoveryAfterUnlock(status: ApiStatus | null): boolean {
  if (!status) return false
  if (status.locked) return false
  if (status.signer !== 'sdk') return false
  return status.vaultStatus?.hasLocal === true
}
