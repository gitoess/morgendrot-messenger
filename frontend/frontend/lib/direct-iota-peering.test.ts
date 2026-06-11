import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  canUseBasisPeeringCommands,
  formatDirectIotaPeeringStatusLine,
  formatDirectIotaPeeringStatusLineForSettings,
  listDirectIotaPeeringExchangeGaps,
  listDirectIotaPeeringGaps,
} from './direct-iota-peering'

vi.mock('@/frontend/lib/direct-iota-plain-submit', () => ({
  isIotaRelayOnlyMode: () => false,
  isDirectMailboxDrainEnabled: () => true,
  canTryLiveEncryptedDirectMailbox: (r: string) => r.includes('bb'),
}))

vi.mock('@/frontend/lib/direct-iota-rpc', () => ({
  getConfiguredDirectIotaRpcUrl: () => 'https://rpc.test',
}))

vi.mock('@/frontend/lib/direct-iota-chain-context', () => ({
  getDirectMailboxChainSnapshot: () => ({ packageId: '0x' + '11'.repeat(32) }),
}))

vi.mock('@/frontend/lib/direct-chat-ecdh-session', () => ({
  listDirectChatEcdhPeerRecipientAddresses: () => ['0x' + 'bb'.repeat(32)],
}))

vi.mock('@/frontend/lib/direct-iota-handshake-fetch', () => ({
  canFetchHandshakesViaDirectIota: () => true,
}))

vi.mock('@/frontend/lib/direct-iota-handshake-submit', () => ({
  canTryDirectHandshakeSubmit: () => true,
}))

vi.mock('@/frontend/lib/direct-iota-connect', () => ({
  canTryDirectConnectPeer: () => true,
}))

describe('direct-iota-peering (H.15 B.2)', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } } as unknown as Window & typeof globalThis)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('canUseBasisPeeringCommands', () => {
    expect(canUseBasisPeeringCommands({ backendReachable: true })).toBe(true)
    expect(canUseBasisPeeringCommands({ backendReachable: false })).toBe(false)
  })

  it('listDirectIotaPeeringGaps bei Basis offline mit Direkt-Handshake', () => {
    const gaps = listDirectIotaPeeringGaps({ backendReachable: false })
    expect(gaps.some((g) => g.includes('Handshake senden/annehmen'))).toBe(true)
  })

  it('formatDirectIotaPeeringStatusLine', () => {
    const line = formatDirectIotaPeeringStatusLine({
      backendReachable: true,
      connectedAddresses: ['0x' + 'aa'.repeat(32)],
    })
    expect(line).toMatch(/Partner verbunden/)
    expect(line).toMatch(/ECDH/)
  })

  it('listDirectIotaPeeringExchangeGaps filtert Direkt-RPC-Setup', () => {
    const exchange = listDirectIotaPeeringExchangeGaps({ backendReachable: true })
    expect(
      exchange.every(
        (g) =>
          !g.includes('Direkt-RPC-URL') &&
          !g.includes('Direkt-Mailbox-Drain') &&
          !g.includes('Ketten-IDs fehlen') &&
          !g.includes('Nur Morgendrot-API')
      )
    ).toBe(true)
  })

  it('formatDirectIotaPeeringStatusLineForSettings', () => {
    expect(
      formatDirectIotaPeeringStatusLineForSettings({ backendReachable: true, connectedAddresses: [] })
    ).toMatch(/Verschlüsselungsschlüssel/)
    expect(
      formatDirectIotaPeeringStatusLineForSettings({
        backendReachable: true,
        connectedAddresses: ['0x' + 'aa'.repeat(32)],
      })
    ).toMatch(/Partner-Adresse/)
  })
})
