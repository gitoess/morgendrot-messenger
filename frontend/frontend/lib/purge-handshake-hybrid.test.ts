import { describe, expect, it, vi, beforeEach } from 'vitest'
import { purgeHandshakeHybrid } from './purge-handshake-hybrid'

const tryDirectMock = vi.fn()
const apiMock = vi.fn()

vi.mock('@/frontend/lib/direct-iota-purge-handshake', () => ({
  canTryDirectPurgeHandshakeSubmit: () => true,
  tryPurgeHandshakeViaDirectIota: (...args: unknown[]) => tryDirectMock(...args),
}))

vi.mock('@/frontend/lib/api/package-connect', () => ({
  purgeHandshakeOnChainCommand: (...args: unknown[]) => apiMock(...args),
}))

const shouldSkipMessengerApiRelayFallback = vi.fn(() => false)
vi.mock('@/frontend/lib/messenger-standalone-relay', () => ({
  canUseMessengerApiRelay: (opts?: { backendReachable?: boolean }) =>
    !shouldSkipMessengerApiRelayFallback() && opts?.backendReachable !== false,
  shouldSkipMessengerApiRelayFallback: () => shouldSkipMessengerApiRelayFallback(),
}))

describe('purge-handshake-hybrid', () => {
  const ME = '0x' + 'aa'.repeat(32)
  const PEER = '0x' + 'bb'.repeat(32)

  beforeEach(() => {
    tryDirectMock.mockReset()
    apiMock.mockReset()
    shouldSkipMessengerApiRelayFallback.mockReturnValue(false)
  })

  it('nutzt Direkt-RPC bei Erfolg', async () => {
    tryDirectMock.mockResolvedValue({ ok: true, digest: '0xd' })
    const r = await purgeHandshakeHybrid(ME, PEER, { backendReachable: true })
    expect(r.ok).toBe(true)
    expect(r.path).toBe('direct')
    expect(apiMock).not.toHaveBeenCalled()
  })

  it('Standalone: kein API-Fallback', async () => {
    shouldSkipMessengerApiRelayFallback.mockReturnValue(true)
    tryDirectMock.mockResolvedValue({ ok: false, error: 'rpc' })
    const r = await purgeHandshakeHybrid(ME, PEER, { backendReachable: true })
    expect(r.ok).toBe(false)
    expect(apiMock).not.toHaveBeenCalled()
  })
})
