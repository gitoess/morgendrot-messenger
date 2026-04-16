import { describe, expect, it } from 'vitest'
import {
  buildMorgSosAckV1Wire,
  plaintextStartsWithMorgSosAckV1,
  tryParseMorgSosAckV1Plaintext,
} from '@/frontend/lib/morg-sos-ack-wire'

const HEX64 = 'a'.repeat(64)

describe('morg-sos-ack-wire (§8.2)', () => {
  it('baut Präfix + JSON + Suffix', () => {
    const w = buildMorgSosAckV1Wire(HEX64)
    expect(w.startsWith('[[MORG_SOS_ACK_V1:')).toBe(true)
    expect(w.endsWith(']]')).toBe(true)
    expect(plaintextStartsWithMorgSosAckV1(w)).toBe(true)
  })

  it('parse: liefert Digest in Kleinbuchstaben', () => {
    const upper = 'F'.repeat(64)
    const w = buildMorgSosAckV1Wire(upper)
    expect(tryParseMorgSosAckV1Plaintext(w)).toBe('f'.repeat(64))
  })

  it('parse: ungültiger Digest → null', () => {
    const bad = '[[MORG_SOS_ACK_V1:{"v":1,"d":"short","ts":1}]]'
    expect(tryParseMorgSosAckV1Plaintext(bad)).toBe(null)
  })

  it('parse: falscher Präfix → null', () => {
    expect(tryParseMorgSosAckV1Plaintext('hello')).toBe(null)
  })
})
