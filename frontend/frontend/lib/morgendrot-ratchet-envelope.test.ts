import { describe, expect, it } from 'vitest'
import {
  encodeRatchetEnvelopeHeader,
  looksLikeRatchetEnvelopeJson,
  parseRatchetEnvelopeHeader,
  serializeRatchetEnvelopeAad,
  type MorgRatchetEnvelopeV3,
} from '@morgendrot/shared/morgendrot-ratchet-envelope'

const sample: MorgRatchetEnvelopeV3 = {
  v: 3,
  cs: 1,
  dh: 'dGVzdC1kaC1wdWJsaWMta2V5LWZvci1wb2M',
  pn: 2,
  n: 5,
  msgId: 'msg-poc-1',
  ts: 1_730_900_000_000,
}

describe('morgendrot-ratchet-envelope C1.1', () => {
  it('roundtrip encode/parse', () => {
    const raw = encodeRatchetEnvelopeHeader(sample)
    const parsed = parseRatchetEnvelopeHeader(raw)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.header).toEqual(sample)
  })

  it('AAD ist stabil', () => {
    expect(serializeRatchetEnvelopeAad(sample)).toBe(encodeRatchetEnvelopeHeader(sample))
  })

  it('lehnt v=2 ab', () => {
    const r = parseRatchetEnvelopeHeader(JSON.stringify({ ...sample, v: 2 }))
    expect(r.ok).toBe(false)
  })

  it('looksLikeRatchetEnvelopeJson', () => {
    expect(looksLikeRatchetEnvelopeJson(encodeRatchetEnvelopeHeader(sample))).toBe(true)
    expect(looksLikeRatchetEnvelopeJson('{"v":2,"epoch":1}')).toBe(false)
  })
})
