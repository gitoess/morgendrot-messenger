/**
 * Vault-Passwort nur im RAM der entsperrten Sitzung — gemeinsam für
 * Chat-Passphrasen, ImageNFT-Passphrasen, Team-Keys (Sidecar-Persistenz).
 */

export const VAULT_PASSWORD_SESSION_CHANGED = 'morgendrot:vault-password-session'

let sessionPassword: string | null = null

function emit(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new Event(VAULT_PASSWORD_SESSION_CHANGED))
  } catch {
    /* ignore */
  }
}

export function setVaultPasswordSession(password: string | null): void {
  const p = password?.trim() ?? ''
  sessionPassword = p.length >= 8 ? p : null
  emit()
}

export function getVaultPasswordSession(): string | null {
  return sessionPassword
}

export function hasVaultPasswordSession(): boolean {
  return sessionPassword != null && sessionPassword.length >= 8
}

export function clearVaultPasswordSession(): void {
  sessionPassword = null
  emit()
}
