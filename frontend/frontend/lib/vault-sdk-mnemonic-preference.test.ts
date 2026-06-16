import { afterEach, describe, expect, it } from 'vitest'
import {
  getIncludeSdkMnemonicInBackup,
  setIncludeSdkMnemonicInBackup,
} from '@/frontend/lib/vault-sdk-mnemonic-preference'

const KEY = 'morgendrot.vault.includeSdkMnemonicInBackup'

describe('vault-sdk-mnemonic-preference', () => {
  afterEach(() => {
    window.localStorage.removeItem(KEY)
  })

  it('ist standardmäßig aktiviert wenn keine Präferenz gesetzt', () => {
    expect(getIncludeSdkMnemonicInBackup()).toBe(true)
  })

  it('speichert explizite Abwahl', () => {
    setIncludeSdkMnemonicInBackup(false)
    expect(getIncludeSdkMnemonicInBackup()).toBe(false)
    setIncludeSdkMnemonicInBackup(true)
    expect(getIncludeSdkMnemonicInBackup()).toBe(true)
  })
})
