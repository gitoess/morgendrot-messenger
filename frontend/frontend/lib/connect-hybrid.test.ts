import { describe, expect, it, vi, beforeEach } from 'vitest'
import { connectPartnerHybrid } from './connect-hybrid'

const tryConnectMock = vi.fn()
const connectApiMock = vi.fn()

vi.mock('@/frontend/lib/direct-iota-connect', () => ({
  canTryDirectConnectPeer: () => true,
  tryConnectPeerViaDirectIota: (...args: unknown[]) => tryConnectMock(...args),
}))

vi.mock('@/frontend/lib/api/package-connect', () => ({
  connect: (...args: unknown[]) => connectApiMock(...args),
}))

describe('connect-hybrid', () => {
  const ADDR = '0x' + 'aa'.repeat(32)

  beforeEach(() => {
    tryConnectMock.mockReset()
    connectApiMock.mockReset()
  })

  it('nutzt Direkt-RPC bei Erfolg', async () => {
    tryConnectMock.mockResolvedValue({
      ok: true,
      peerAddress: ADDR,
      replySent: true,
      source: 'mailbox',
    })
    const r = await connectPartnerHybrid(ADDR, { backendReachable: true })
    expect(r.ok).toBe(true)
    expect(r.path).toBe('direct')
    expect(connectApiMock).not.toHaveBeenCalled()
  })

  it('fällt auf API zurück', async () => {
    tryConnectMock.mockResolvedValue({ ok: false, error: 'nicht gefunden' })
    connectApiMock.mockResolvedValue({ ok: true, message: 'api ok' })
    const r = await connectPartnerHybrid(ADDR, { backendReachable: true })
    expect(r.ok).toBe(true)
    expect(r.path).toBe('api')
  })
})
