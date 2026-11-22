import { afterEach, describe, expect, it } from 'vitest'
import {
  clearVaultPasswordSession,
  getVaultPasswordSession,
  hasVaultPasswordSession,
  hydrateVaultPasswordSessionFromTab,
  setVaultPasswordSession,
  VAULT_PASSWORD_TAB_SS_KEY,
} from '@/frontend/lib/vault-password-session'

afterEach(() => {
  clearVaultPasswordSession()
})

describe('vault-password-session tab persist', () => {
  it('persistiert in sessionStorage und löscht bei clear', () => {
    setVaultPasswordSession('vault-pass-99')
    expect(sessionStorage.getItem(VAULT_PASSWORD_TAB_SS_KEY)).toBe('vault-pass-99')
    expect(hasVaultPasswordSession()).toBe(true)
    clearVaultPasswordSession()
    expect(sessionStorage.getItem(VAULT_PASSWORD_TAB_SS_KEY)).toBeNull()
    expect(hasVaultPasswordSession()).toBe(false)
  })

  it('stellt Passwort nach RAM-Verlust aus Tab wieder her (F5-Simulation)', () => {
    setVaultPasswordSession('vault-pass-99')
    const tab = sessionStorage.getItem(VAULT_PASSWORD_TAB_SS_KEY)
    expect(tab).toBe('vault-pass-99')

    // Nur RAM leeren, Tab behalten (wie frisches Modul nach F5)
    clearVaultPasswordSession()
    sessionStorage.setItem(VAULT_PASSWORD_TAB_SS_KEY, tab!)

    expect(hydrateVaultPasswordSessionFromTab()).toBe('vault-pass-99')
    expect(getVaultPasswordSession()).toBe('vault-pass-99')
    expect(hasVaultPasswordSession()).toBe(true)
  })

  it('ignoriert zu kurze Tab-Werte', () => {
    sessionStorage.setItem(VAULT_PASSWORD_TAB_SS_KEY, 'short')
    expect(hydrateVaultPasswordSessionFromTab()).toBeNull()
    expect(hasVaultPasswordSession()).toBe(false)
  })
})
