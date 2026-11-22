import { describe, expect, it } from 'vitest'
import { evaluateConnectPeerGuard, mergePeerMaps } from './connect-peer-guard.js'

const ME = `0x${'11'.repeat(32)}`
const PEER = `0x${'22'.repeat(32)}`
const OTHER = `0x${'33'.repeat(32)}`

describe('evaluateConnectPeerGuard', () => {
  it('lehnt Self-Connect ab', () => {
    const r = evaluateConnectPeerGuard({ myAddress: ME, connectAddr: ME, peerAddresses: [] })
    expect(r.action).toBe('reject')
  })

  it('already nur wenn Ziel schon Peer ist', () => {
    const r = evaluateConnectPeerGuard({
      myAddress: ME,
      connectAddr: PEER,
      peerAddresses: [PEER],
    })
    expect(r.action).toBe('already')
    if (r.action === 'already') expect(r.message).toContain('Bereits verbunden mit')
  })

  it('erlaubt Connect zu neuem Peer trotz anderer peerMap-Einträge', () => {
    const r = evaluateConnectPeerGuard({
      myAddress: ME,
      connectAddr: OTHER,
      peerAddresses: [PEER, ME],
    })
    expect(r).toEqual({ action: 'proceed', targetAddrs: [OTHER.toLowerCase()] })
  })

  it('ohne Ziel und mit Peers → already', () => {
    const r = evaluateConnectPeerGuard({ myAddress: ME, peerAddresses: [PEER] })
    expect(r.action).toBe('already')
  })
})

describe('mergePeerMaps', () => {
  it('merged und filtert Self', () => {
    const a = new Map([[ME, { n: 1 }], [PEER, { n: 2 }]])
    const b = new Map([[OTHER, { n: 3 }]])
    const m = mergePeerMaps(ME, a, b)
    expect([...m.keys()].sort()).toEqual([OTHER.toLowerCase(), PEER.toLowerCase()].sort())
  })
})
