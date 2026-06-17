import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  enrichApiStatusWithDirectSessionSigner,
  isMessengerSessionKeysReady,
  shouldBlockSendForMissingSessionKeys,
} from '@/frontend/lib/messenger-session-keys-ready'
import type { ApiStatus } from '@/frontend/lib/api'

const getDirectIotaSessionSigner = vi.fn()

vi.mock('@/frontend/lib/direct-iota-mnemonic-session', () => ({
  getDirectIotaSessionSigner: () => getDirectIotaSessionSigner(),
}))

describe('messenger-session-keys-ready', () => {
  beforeEach(() => {
    getDirectIotaSessionSigner.mockReset()
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
})
