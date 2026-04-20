import { describe, expect, it } from 'vitest'
import {
  validateLoraDualWireUtf8,
  validateMeshDisallowsIotaCompactBlob,
  validateStandardOutgoingWire,
} from './chat-view-send-utils'
import { MESSAGING_WIRE_UTF8_MAX } from './compact-image-wire'
import { wrapCompactImageMessage, wrapMorgAudioV1Message } from './compact-image-wire'

describe('validateLoraDualWireUtf8', () => {
  it('kurze Strings ok', () => {
    expect(validateLoraDualWireUtf8('a', 'b')).toEqual({ ok: true })
  })

  it('zu lang (UTF-8) → Hinweis', () => {
    const long = 'ü'.repeat(Math.floor(MESSAGING_WIRE_UTF8_MAX / 2) + 1)
    const r = validateLoraDualWireUtf8(long, 'x')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.message).toMatch(/LoRa-Wire zu lang/)
      expect(r.idleMs).toBe(6000)
    }
  })
})

describe('validateMeshDisallowsIotaCompactBlob', () => {
  it('mesh + Anhang-Blob → blockiert', () => {
    const r = validateMeshDisallowsIotaCompactBlob('mesh', 'Ym9keQ==')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.message).toMatch(/Funk:|LoRa-Bild/)
      expect(r.idleMs).toBe(9000)
    }
  })

  it('mesh ohne Blob ok', () => {
    expect(validateMeshDisallowsIotaCompactBlob('mesh', null)).toEqual({ ok: true })
  })

  it('internet mit Blob ok', () => {
    expect(validateMeshDisallowsIotaCompactBlob('internet', 'eA==')).toEqual({ ok: true })
  })
})

describe('validateStandardOutgoingWire', () => {
  it('einfacher Text ok', () => {
    expect(validateStandardOutgoingWire('Hallo', { hasAttachedAudio: false })).toEqual({ ok: true })
  })

  it('UTF-8 über Chain-Limit', () => {
    const s = 'ü'.repeat(Math.floor(MESSAGING_WIRE_UTF8_MAX / 2) + 1)
    const r = validateStandardOutgoingWire(s, { hasAttachedAudio: false })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/Nachricht zu lang für die Chain/)
  })

  it('Kompakt-Bild-Blob zu groß', () => {
    const raw = new Uint8Array(12_000).fill(9)
    const b64 = Buffer.from(raw).toString('base64')
    const wire = wrapCompactImageMessage(b64)
    const r = validateStandardOutgoingWire(wire, { hasAttachedAudio: false })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/Kompakt-Bild-Blob zu groß/)
  })

  it('Anhang Audio: ungültiges Wire', () => {
    const r = validateStandardOutgoingWire('kein-audio-marker', { hasAttachedAudio: true })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/MORG_AUDIO_V1/)
  })

  it('Anhang Audio: nach SOS-Marker nur Body für Limits', () => {
    const head = '[[MORG_EMERGENCY_V1:{"v":1,"k":"t","ts":1}]]'
    const audio = wrapMorgAudioV1Message('Zg==') // "f" — klein
    const combined = `${head}\n${audio}`
    expect(validateStandardOutgoingWire(combined, { hasAttachedAudio: true })).toEqual({ ok: true })
  })
})
