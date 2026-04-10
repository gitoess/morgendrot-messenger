import { describe, it, expect } from 'vitest'
import {
  normalizeMessengerWireContent,
  wireUtf8ByteLength,
  wrapCompactImageMessage,
  parseCompactImageMessage,
  wrapCompactTextMessage,
  parseCompactTextMessage,
  decodedBase64BinaryLength,
  wrapMorgAudioV1Message,
  morgAudioWirePassesLimits,
  estimateMaxOpusSecondsAtBitrateBps,
  sanitizeTxtFileName,
  MEDIA_IOTA_AUDIO_RAW_MAX_BYTES,
  COMPACT_IMG_PREFIX,
  COMPACT_IMG_SUFFIX,
} from './compact-image-wire'

const HELLO_B64 = 'SGVsbG8=' // "Hello"

describe('normalizeMessengerWireContent', () => {
  it('entfernt BOM und normalisiert Vollbreiten-Klammern', () => {
    const raw = '\uFEFF\uFF3B\uFF3BMORG_COMPACT_IMG_V1:' + HELLO_B64 + COMPACT_IMG_SUFFIX
    const n = normalizeMessengerWireContent(raw)
    expect(n.startsWith('[[MORG_COMPACT_IMG_V1:')).toBe(true)
  })
  it('gibt bei null-artigem Input leeren String zurück', () => {
    expect(normalizeMessengerWireContent(null as unknown as string)).toBe('')
  })
})

describe('wireUtf8ByteLength', () => {
  it('zählt UTF-8-Bytes', () => {
    expect(wireUtf8ByteLength('a')).toBe(1)
    expect(wireUtf8ByteLength('ü')).toBe(2)
  })
})

describe('compact image roundtrip', () => {
  it('wrap + parse', () => {
    const w = wrapCompactImageMessage(HELLO_B64, 'Legende')
    const p = parseCompactImageMessage(w)
    expect(p).not.toBeNull()
    expect(p!.blobBase64.replace(/\s/g, '')).toBe(HELLO_B64)
    expect(p!.caption).toBe('Legende')
  })
  it('findet Marker in JSON-Export-Wrapper', () => {
    const inner = COMPACT_IMG_PREFIX + HELLO_B64 + COMPACT_IMG_SUFFIX
    const json = JSON.stringify({ log: [{ text: inner }] })
    const p = parseCompactImageMessage(json)
    expect(p?.blobBase64.replace(/\s/g, '')).toBe(HELLO_B64)
  })
})

describe('compact text roundtrip', () => {
  it('wrap + parse', () => {
    const w = wrapCompactTextMessage('Hallo Welt', 'c')
    const p = parseCompactTextMessage(w)
    expect(p?.text).toBe('Hallo Welt')
    expect(p?.caption).toBe('c')
  })
})

describe('decodedBase64BinaryLength', () => {
  it('schätzt dekodierte Länge', () => {
    expect(decodedBase64BinaryLength('')).toBe(0)
    expect(decodedBase64BinaryLength(HELLO_B64)).toBe(5)
  })
})

describe('morgAudioWirePassesLimits', () => {
  it('akzeptiert kleines Audio-Wire', () => {
    const tiny = wrapMorgAudioV1Message(HELLO_B64)
    const r = morgAudioWirePassesLimits(tiny, { maxRawBinaryBytes: 100 })
    expect(r.ok).toBe(true)
  })
  it('lehnt zu großes Roh-Blob ab', () => {
    const big = 'A'.repeat(20000)
    const w = wrapMorgAudioV1Message(big)
    const r = morgAudioWirePassesLimits(w, { maxRawBinaryBytes: 100 })
    expect(r.ok).toBe(false)
  })
})

describe('estimateMaxOpusSecondsAtBitrateBps', () => {
  it('rechnet Theoriedauer', () => {
    const s = estimateMaxOpusSecondsAtBitrateBps(8000, MEDIA_IOTA_AUDIO_RAW_MAX_BYTES)
    expect(s).toBeGreaterThan(10)
    expect(s).toBeLessThan(11)
  })
})

describe('sanitizeTxtFileName', () => {
  it('ersetzt Pfadzeichen', () => {
    expect(sanitizeTxtFileName('a/b\\c.txt')).toBe('a_b_c.txt')
  })
})
