/**
 * Vault-Passwort nur im RAM der entsperrten Sitzung — gemeinsam für
 * Chat-Passphrasen, ImageNFT-Passphrasen, Team-Keys (Sidecar-Persistenz).
 */

let sessionPassword: string | null = null

export function setVaultPasswordSession(password: string | null): void {
  const p = password?.trim() ?? ''
  sessionPassword = p.length >= 8 ? p : null
}

export function getVaultPasswordSession(): string | null {
  return sessionPassword
}

export function hasVaultPasswordSession(): boolean {
  return sessionPassword != null && sessionPassword.length >= 8
}

export function clearVaultPasswordSession(): void {
  sessionPassword = null
}
