import { describe, expect, it } from 'vitest'
import { parseMeshtasticNodeIdToNumber, resolveMeshtasticPlaintextDestination } from './meshtastic-node-id'

describe('meshtastic-node-id', () => {
  it('parsed node matches !hex round-trip style', () => {
    expect(parseMeshtasticNodeIdToNumber('!deadbeef')).toBe(0xdeadbeef >>> 0)
    expect(parseMeshtasticNodeIdToNumber('!1')).toBe(1)
    expect(parseMeshtasticNodeIdToNumber('deadbeef')).toBeNull()
    expect(parseMeshtasticNodeIdToNumber('!')).toBeNull()
  })

  it('resolve destination', () => {
    expect(resolveMeshtasticPlaintextDestination(false, '')).toBe('broadcast')
    expect(resolveMeshtasticPlaintextDestination(true, '!2')).toBe(2)
    expect(resolveMeshtasticPlaintextDestination(true, 'bad')).toBeNull()
  })
})
