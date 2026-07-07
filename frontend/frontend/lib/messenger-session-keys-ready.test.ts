import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  enrichApiStatusWithDirectSessionSigner,
  isBrowserSessionSignerReady,
  isMessengerSessionKeysReady,
  isMessengerVaultSessionComplete,
  messengerVaultUiShouldStayLocked,
  shouldBlockSendForMissingSessionKeys,
} from '@/frontend/lib/messenger-session-keys-ready'
import type { ApiStatus } from '@/frontend/lib/api'

const getDirectIotaSessionSigner = vi.fn()

vi.mock('@/frontend/lib/direct-iota-mnemonic-session', () => ({
  getDirectIotaSessionSigner: () => getDirectIotaSessionSigner(),
}))

vi.mock('@/frontend/lib/dashboard-basis-offline-hint', () => ({
  isStandaloneMessengerWithoutBasis: vi.fn(() => false),
}))

import { isStandaloneMessengerWithoutBasis } from '@/frontend/lib/dashboard-basis-offline-hint'

const isStandalone = vi.mocked(isStandaloneMessengerWithoutBasis)

describe('messenger-session-keys-ready', () => {
  beforeEach(() => {
    getDirectIotaSessionSigner.mockReset()
    isStandalone.mockReturnValue(false)
  })

  it('isBrowserSessionSignerReady braucht RAM-Signer', () => {
    getDirectIotaSessionSigner.mockReturnValue(null)
    expect(isBrowserSessionSignerReady(false)).toBe(false)
    getDirectIotaSessionSigner.mockReturnValue({})
    expect(isBrowserSessionSignerReady(false)).toBe(true)
    expect(isBrowserSessionSignerReady(true)).toBe(false)
  })

  it('hasKeys=true wenn API meldet Keys', () => {
    expect(isMessengerSessionKeysReady({ hasKeys: true, locked: false })).toBe(true)
  })

  it('sendebereit wenn Browser-Signer aktiv trotz hasKeys=false', () => {
    getDirectIotaSessionSigner.mockReturnValue({})
    expect(isMessengerSessionKeysReady({ hasKeys: false, locked: false })).toBe(true)
  })

  it('blockiert Senden erst nach Status-Poll', () => {
    expect(shouldBlockSendForMissingSessionKeys({ hasKeys: false, locked: false }, false)).toBe(false)
    expect(shouldBlockSendForMissingSessionKeys({ hasKeys: false, locked: false }, true)).toBe(true)
  })

  it('enrich setzt hasKeys wenn Direct-Signer da ist', () => {
    getDirectIotaSessionSigner.mockReturnValue({})
    const status: ApiStatus = { hasKeys: false, locked: false }
    expect(enrichApiStatusWithDirectSessionSigner(status)?.hasKeys).toBe(true)
  })

  it('Standalone-APK: Direct-Signer hebt locked für Send-Status auf', () => {
    isStandalone.mockReturnValue(true)
    getDirectIotaSessionSigner.mockReturnValue({})
    const status: ApiStatus = { hasKeys: false, locked: true }
    expect(isMessengerSessionKeysReady(status)).toBe(true)
    expect(enrichApiStatusWithDirectSessionSigner(status)).toEqual({
      hasKeys: true,
      locked: false,
    })
  })

  it('messengerVaultUiShouldStayLocked: Backend offen reicht (Reload ohne Browser-Signer)', () => {
    getDirectIotaSessionSigner.mockReturnValue(null)
    expect(
      messengerVaultUiShouldStayLocked({ hasKeys: true, locked: false }, false)
    ).toBe(false)
    expect(messengerVaultUiShouldStayLocked({ hasKeys: false, locked: false }, false)).toBe(true)
    expect(messengerVaultUiShouldStayLocked({ hasKeys: true, locked: true }, false)).toBe(true)
  })

  it('isMessengerVaultSessionComplete wenn Backend-Tresor offen', () => {
    getDirectIotaSessionSigner.mockReturnValue(null)
    expect(isMessengerVaultSessionComplete({ hasKeys: true, locked: false }, false)).toBe(true)
    expect(isMessengerVaultSessionComplete({ hasKeys: true, locked: false }, true)).toBe(true)
  })
})
