import { describe, it, expect } from 'vitest'
import {
  validateLoraDualWireUtf8,
  validateMeshDisallowsIotaCompactBlob,
  validateStandardOutgoingWire,
} from './chat-view-send-utils'

describe('validateMeshDisallowsIotaCompactBlob', () => {
  it('verbietet Kompaktblob im mesh-Modus', () => {
    const r = validateMeshDisallowsIotaCompactBlob('mesh', 'YmFzZTY0')
    expect(r.ok).toBe(false)
  })
  it('erlaubt Blob bei internet', () => {
    const r = validateMeshDisallowsIotaCompactBlob('internet', 'YmFzZTY0')
    expect(r.ok).toBe(true)
  })
  it('ohne Blob: immer ok (auch mesh)', () => {
    expect(validateMeshDisallowsIotaCompactBlob('mesh', null).ok).toBe(true)
  })
})

describe('validateLoraDualWireUtf8', () => {
  it('akzeptiert kurzen Text', () => {
    expect(validateLoraDualWireUtf8('a', 'b').ok).toBe(true)
  })
})

describe('validateStandardOutgoingWire', () => {
  it('lehnt extrem langen Klartext ab', () => {
    const huge = 'x'.repeat(800_000)
    const r = validateStandardOutgoingWire(huge, { hasAttachedAudio: false })
    expect(r.ok).toBe(false)
  })
})
