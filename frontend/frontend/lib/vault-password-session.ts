/**
 * Vault-Passwort für Browser-Sidecars (Passphrasen, Keycards, Index, …).
 *
 * - RAM während der Sitzung
 * - zusätzlich Tab-`sessionStorage` (überlebt F5 / HMR im selben Tab)
 * - weg bei Tab schließen, Abmelden / Soft-Lock (`clearVaultPasswordSession`)
 *
 * Kein Ersatz für API-`/vault-lock`: Backend-Keys leben im Node-Prozess und
 * bleiben nach Reload offen, solange der API-Prozess läuft.
 */

export const VAULT_PASSWORD_SESSION_CHANGED = 'morgendrot:vault-password-session'

/** Tab-scoped (sessionStorage) — bewusst nicht localStorage. */
export const VAULT_PASSWORD_TAB_SS_KEY = 'morgendrot.vaultPassword.tab.v1'

let sessionPassword: string | null = null

function emit(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new Event(VAULT_PASSWORD_SESSION_CHANGED))
  } catch {
    /* ignore */
  }
}

function writeTabSession(password: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (password && password.length >= 8) {
      window.sessionStorage.setItem(VAULT_PASSWORD_TAB_SS_KEY, password)
    } else {
      window.sessionStorage.removeItem(VAULT_PASSWORD_TAB_SS_KEY)
    }
  } catch {
    /* ignore */
  }
}

function readTabSession(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(VAULT_PASSWORD_TAB_SS_KEY)?.trim() ?? ''
    return raw.length >= 8 ? raw : null
  } catch {
    return null
  }
}

/** Aus sessionStorage nachladen wenn RAM leer (F5 / neuer JS-Bundle im Tab). */
export function hydrateVaultPasswordSessionFromTab(): string | null {
  if (sessionPassword != null) return sessionPassword
  const fromTab = readTabSession()
  if (fromTab) sessionPassword = fromTab
  return sessionPassword
}

export function setVaultPasswordSession(password: string | null): void {
  const p = password?.trim() ?? ''
  sessionPassword = p.length >= 8 ? p : null
  writeTabSession(sessionPassword)
  emit()
}

export function getVaultPasswordSession(): string | null {
  return hydrateVaultPasswordSessionFromTab()
}

export function hasVaultPasswordSession(): boolean {
  return getVaultPasswordSession() != null
}

export function clearVaultPasswordSession(): void {
  sessionPassword = null
  writeTabSession(null)
  emit()
}
