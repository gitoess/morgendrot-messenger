import { describe, expect, it } from 'vitest'
import { sniffMediaExt } from '@/frontend/lib/einsatzprotokoll-export'

describe('sniffMediaExt', () => {
  it('erkennt JPEG', () => {
    expect(sniffMediaExt(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg')
  })

  it('erkennt PNG', () => {
    expect(sniffMediaExt(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png')
  })

  it('erkennt WebP (RIFF….WEBP)', () => {
    const b = new Uint8Array(12)
    b[0] = 0x52
    b[1] = 0x49
    b[2] = 0x46
    b[3] = 0x46
    b[8] = 0x57
    b[9] = 0x45
    b[10] = 0x42
    b[11] = 0x50
    expect(sniffMediaExt(b)).toBe('webp')
  })

  it('erkennt Ogg/Opus-Container', () => {
    expect(sniffMediaExt(new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00]))).toBe('ogg')
  })

  it('unbekannt → bin', () => {
    expect(sniffMediaExt(new Uint8Array([0x00, 0x01, 0x02]))).toBe('bin')
  })
})
