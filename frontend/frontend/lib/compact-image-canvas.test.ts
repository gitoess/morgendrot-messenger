import { describe, it, expect } from 'vitest'
import { tryExtractTruncatedCompactLumaWebp } from './compact-image-canvas'

const MAGIC = new Uint8Array([0x4d, 0x67, 0x76, 0x69])

function buildCompactHeader(lenL: number, lenC: number): Uint8Array {
  const buf = new Uint8Array(13 + lenL)
  buf.set(MAGIC, 0)
  buf[4] = 1
  buf[5] = (lenL >>> 24) & 0xff
  buf[6] = (lenL >>> 16) & 0xff
  buf[7] = (lenL >>> 8) & 0xff
  buf[8] = lenL & 0xff
  buf[9] = (lenC >>> 24) & 0xff
  buf[10] = (lenC >>> 16) & 0xff
  buf[11] = (lenC >>> 8) & 0xff
  buf[12] = lenC & 0xff
  for (let i = 0; i < lenL; i++) buf[13 + i] = 0xab
  return buf
}

describe('tryExtractTruncatedCompactLumaWebp', () => {
  it('liefert Luma-Bytes wenn Blob nach Luma abbricht', () => {
    const lenL = 5
    const lenC = 4
    const partial = buildCompactHeader(lenL, lenC)
    const luma = tryExtractTruncatedCompactLumaWebp(partial)
    expect(luma).not.toBeNull()
    expect(luma!.length).toBe(lenL)
    expect(Array.from(luma!)).toEqual(Array(5).fill(0xab))
  })

  it('liefert null bei vollständigem Blob (Länge = need)', () => {
    const lenL = 3
    const lenC = 2
    const need = 13 + lenL + lenC + 32
    const buf = new Uint8Array(need)
    buf.set(buildCompactHeader(lenL, lenC))
    const luma = tryExtractTruncatedCompactLumaWebp(buf)
    expect(luma).toBeNull()
  })

  it('liefert null bei ungültigem Magic', () => {
    const buf = new Uint8Array(20)
    buf.fill(1)
    expect(tryExtractTruncatedCompactLumaWebp(buf)).toBeNull()
  })

  it('liefert null wenn Luma selbst unvollständig', () => {
    const buf = new Uint8Array(14)
    buf.set(MAGIC, 0)
    buf[4] = 1
    buf[5] = 0
    buf[6] = 0
    buf[7] = 0
    buf[8] = 10
    buf[9] = 0
    buf[10] = 0
    buf[11] = 0
    buf[12] = 0
    buf[13] = 0xff
    expect(tryExtractTruncatedCompactLumaWebp(buf)).toBeNull()
  })
})
