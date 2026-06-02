import { describe, expect, it, vi, beforeEach } from 'vitest'
import { sendHandshakeHybrid } from './handshake-send-hybrid'

const tryDirectMock = vi.fn()
const startHandshakeMock = vi.fn()

vi.mock('@/frontend/lib/direct-iota-handshake-submit', () => ({
  canTryDirectHandshakeSubmit: () => true,
  trySubmitHandshakeViaDirectIota: (...args: unknown[]) => tryDirectMock(...args),
}))

vi.mock('@/frontend/lib/api/package-connect', () => ({
  startHandshake: (...args: unknown[]) => startHandshakeMock(...args),
}))

const shouldSkipMessengerApiRelayFallback = vi.fn(() => false)
vi.mock('@/frontend/lib/messenger-standalone-relay', () => ({
  canUseMessengerApiRelay: (opts?: { backendReachable?: boolean }) =>
    !shouldSkipMessengerApiRelayFallback() && opts?.backendReachable !== false,
  shouldSkipMessengerApiRelayFallback: () => shouldSkipMessengerApiRelayFallback(),
}))

describe('handshake-send-hybrid', () => {
  const ADDR = '0x' + 'aa'.repeat(32)

  beforeEach(() => {
    tryDirectMock.mockReset()
    startHandshakeMock.mockReset()
  })

  it('nutzt Direkt-RPC bei Erfolg', async () => {
    tryDirectMock.mockResolvedValue({ ok: true, digest: '0xdigest' })
    const r = await sendHandshakeHybrid(ADDR, { backendReachable: true })
    expect(r.ok).toBe(true)
    expect(r.path).toBe('direct')
    expect(startHandshakeMock).not.toHaveBeenCalled()
  })

  it('fällt auf API zurück wenn Direkt fehlschlägt und Basis da', async () => {
    tryDirectMock.mockResolvedValue({ ok: false, error: 'rpc down' })
    startHandshakeMock.mockResolvedValue({ ok: true, message: 'ok' })
    const r = await sendHandshakeHybrid(ADDR, { backendReachable: true })
    expect(r.ok).toBe(true)
    expect(r.path).toBe('api')
  })

  it('Standalone: kein API-Fallback auch wenn backendReachable true', async () => {
    shouldSkipMessengerApiRelayFallback.mockReturnValue(true)
    tryDirectMock.mockResolvedValue({ ok: false, error: 'rpc down' })
    const r = await sendHandshakeHybrid(ADDR, { backendReachable: true })
    expect(r.ok).toBe(false)
    expect(startHandshakeMock).not.toHaveBeenCalled()
  })
})
