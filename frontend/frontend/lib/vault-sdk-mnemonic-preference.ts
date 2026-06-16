/** Persistente UI-Präferenz: Wallet-Seed beim Vault-Sichern mit einbinden (SIGNER=sdk). */
const STORAGE_KEY = 'morgendrot.vault.includeSdkMnemonicInBackup'

/** Standard: an — Seed beim Entsperren/Anlegen verschlüsselt merken (Vault + Browser-Session). */
export function getIncludeSdkMnemonicInBackup(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return true
    return raw === '1'
  } catch {
    return true
  }
}

export function setIncludeSdkMnemonicInBackup(value: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    /* ignore */
  }
}
