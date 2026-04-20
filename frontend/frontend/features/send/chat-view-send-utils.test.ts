import { describe, it, expect } from 'vitest'
import { MESSAGING_WIRE_UTF8_MAX } from '@/frontend/lib/compact-image-wire'
import {
  validateLoraDualWireUtf8,
  validateMeshDisallowsIotaCompactBlob,
} from '@/frontend/features/send/chat-view-send-utils'

describe('validateLoraDualWireUtf8', () => {
  it('akzeptiert typische Dual-Wires unter dem UTF-8-Deckel', () => {
    expect(validateLoraDualWireUtf8('[[L]]', '[[C]]')).toEqual({ ok: true })
  })

  it('lehnt LUMA ab, wenn allein schon über dem UTF-8-Limit', () => {
    const pad = 'a'.repeat(MESSAGING_WIRE_UTF8_MAX)
    const r = validateLoraDualWireUtf8(`${pad}x`, 'y')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/LoRa-Wire zu lang/)
  })

  it('lehnt CHROMA ab, wenn über dem UTF-8-Limit', () => {
    const pad = 'a'.repeat(MESSAGING_WIRE_UTF8_MAX)
    const r = validateLoraDualWireUtf8('x', `${pad}x`)
    expect(r.ok).toBe(false)
  })
})

describe('validateMeshDisallowsIotaCompactBlob', () => {
  it('blockiert IOTA-Kompaktblob bei Transport funk', () => {
    const r = validateMeshDisallowsIotaCompactBlob('mesh', 'YmJi')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/Funk:|LoRa-Bild/)
  })

  it('erlaubt Kompaktblob bei internet', () => {
    expect(validateMeshDisallowsIotaCompactBlob('internet', 'YmJi')).toEqual({ ok: true })
  })

  it('erlaubt funk ohne Blob', () => {
    expect(validateMeshDisallowsIotaCompactBlob('mesh', null)).toEqual({ ok: true })
  })
})
