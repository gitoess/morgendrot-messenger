import { afterEach, describe, expect, it } from 'vitest'
import {
  parseVaultIdleLockMinutes,
  readVaultIdleLockMinutes,
  VAULT_IDLE_LOCK_MINUTES_LS_KEY,
  writeVaultIdleLockMinutes,
} from '@/frontend/lib/vault-idle-lock-pref'

afterEach(() => {
  try {
    localStorage.removeItem(VAULT_IDLE_LOCK_MINUTES_LS_KEY)
  } catch {
    /* ignore */
  }
})

describe('vault-idle-lock-pref', () => {
  it('Default aus (0)', () => {
    expect(readVaultIdleLockMinutes()).toBe(0)
    expect(parseVaultIdleLockMinutes(null)).toBe(0)
    expect(parseVaultIdleLockMinutes('')).toBe(0)
  })

  it('erlaubte Minuten speichern/lesen', () => {
    writeVaultIdleLockMinutes(15)
    expect(readVaultIdleLockMinutes()).toBe(15)
    writeVaultIdleLockMinutes(0)
    expect(localStorage.getItem(VAULT_IDLE_LOCK_MINUTES_LS_KEY)).toBeNull()
    expect(readVaultIdleLockMinutes()).toBe(0)
  })

  it('unbekannte Werte → 0', () => {
    expect(parseVaultIdleLockMinutes('7')).toBe(0)
    expect(parseVaultIdleLockMinutes('abc')).toBe(0)
  })
})
