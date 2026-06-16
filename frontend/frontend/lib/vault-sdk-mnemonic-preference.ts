/** Persistente UI-Präferenz: Wallet-Seed beim Vault-Sichern mit einbinden (SIGNER=sdk). */
const STORAGE_KEY = 'morgendrot.vault.includeSdkMnemonicInBackup'

export function getIncludeSdkMnemonicInBackup(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
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
