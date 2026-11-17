/** Boss-Header „Aktualisieren“ → Chat-Posteingang (forceLive), auch bei suppressAppChrome. */
export const MESSENGER_INBOX_FORCE_REFRESH_EVENT = 'morgendrot:messenger-inbox-force-refresh'

export function requestMessengerInboxForceRefresh(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new Event(MESSENGER_INBOX_FORCE_REFRESH_EVENT))
  } catch {
    /* ignore */
  }
  /** Composer/Schlüsselkarten: Vault-Sidecar neu laden + UI sync (nicht nur Inbox). */
  void (async () => {
    try {
      const { hasVaultPasswordSession } = await import('@/frontend/lib/vault-password-session')
      const { unlockNftKeycardVault, NFT_KEYCARD_VAULT_CHANGED_EVENT } = await import(
        '@/frontend/lib/nft-keycard-local-store'
      )
      if (hasVaultPasswordSession()) {
        await unlockNftKeycardVault()
      } else {
        window.dispatchEvent(new Event(NFT_KEYCARD_VAULT_CHANGED_EVENT))
      }
    } catch {
      /* best-effort */
    }
  })()
}
