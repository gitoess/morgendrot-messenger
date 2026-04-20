import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/frontend/lib/api', () => ({
  compactImageEncode: vi.fn(),
  loraProgressiveEncode: vi.fn(),
}))

import { compactImageEncode, loraProgressiveEncode } from '@/frontend/lib/api'
import { CHAT_LORA_DUAL_IMAGE_POLICY_MSG } from '@/frontend/lib/chat-view-messenger-transport'
import { ingestCompactAttachmentPick } from './chat-view-attachment-ingest'

const compactImageEncodeMock = vi.mocked(compactImageEncode)
const loraProgressiveEncodeMock = vi.mocked(loraProgressiveEncode)

/** 1×1 PNG — reicht für Data-URL + ingestImage-Pfad. */
function tinyPngFile(): File {
  const b64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return new File([bin], 't.png', { type: 'image/png' })
}

const baseCtx = {
  role: 'test',
  forcedTransport: 'internet' as const,
  isPrivate: true,
  encrypted: false,
  meshSelfArchiveAfterLoRa: false,
}

describe('ingestCompactAttachmentPick', () => {
  beforeEach(() => {
    compactImageEncodeMock.mockReset()
    loraProgressiveEncodeMock.mockReset()
  })

  it('.txt ohne API', async () => {
    const f = new File(['hello'], 'a.txt', { type: 'text/plain' })
    const r = await ingestCompactAttachmentPick(f, baseCtx)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.attachedTxtFile).toEqual({ name: 'a.txt', text: 'hello' })
      expect(r.attachedBlobBase64).toBeNull()
      expect(compactImageEncodeMock).not.toHaveBeenCalled()
    }
  })

  it('Bild + internet: ruft compactImageEncode auf', async () => {
    compactImageEncodeMock.mockResolvedValue({
      ok: true,
      blobBase64: 'QUJDRA==',
      totalBytes: 400,
      lumaBytes: 100,
      chromaBytes: 300,
      usedQuality: 72,
    })
    const r = await ingestCompactAttachmentPick(tinyPngFile(), baseCtx)
    expect(compactImageEncodeMock).toHaveBeenCalledTimes(1)
    expect(loraProgressiveEncodeMock).not.toHaveBeenCalled()
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.attachedBlobBase64).toBe('QUJDRA==')
      expect(r.attachedLora).toBeNull()
      expect(r.compactMeta.mode).toBe('iota')
      expect(r.compactMeta.q).toBe(72)
    }
  })

  it('Bild + mesh: ruft loraProgressiveEncode auf', async () => {
    loraProgressiveEncodeMock.mockResolvedValue({
      ok: true,
      messageId: 'a1b2c3d4',
      lumaWire: '[[LUMA]]',
      chromaWire: '[[CHROMA]]',
      lumaJpegBytes: 11,
      chromaJpegBytes: 22,
    })
    const r = await ingestCompactAttachmentPick(tinyPngFile(), {
      ...baseCtx,
      forcedTransport: 'mesh',
      meshSelfArchiveAfterLoRa: true,
    })
    expect(loraProgressiveEncodeMock).toHaveBeenCalledTimes(1)
    expect(compactImageEncodeMock).not.toHaveBeenCalled()
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.attachedLora).toMatchObject({
        lumaWire: '[[LUMA]]',
        chromaWire: '[[CHROMA]]',
        messageId: 'a1b2c3d4',
      })
      expect(r.compactMeta.mode).toBe('lora')
    }
  })

  it('Bild + mesh ohne Pfad 4: kein LoRa-Encode, Policy-Meldung', async () => {
    const r = await ingestCompactAttachmentPick(tinyPngFile(), {
      ...baseCtx,
      forcedTransport: 'mesh',
      meshSelfArchiveAfterLoRa: false,
    })
    expect(loraProgressiveEncodeMock).not.toHaveBeenCalled()
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toBe(CHAT_LORA_DUAL_IMAGE_POLICY_MSG)
  })

  it('Bild + mesh + Pfad 4 aber verschlüsselt: kein LoRa-Encode', async () => {
    const r = await ingestCompactAttachmentPick(tinyPngFile(), {
      ...baseCtx,
      forcedTransport: 'mesh',
      encrypted: true,
      meshSelfArchiveAfterLoRa: true,
    })
    expect(loraProgressiveEncodeMock).not.toHaveBeenCalled()
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toBe(CHAT_LORA_DUAL_IMAGE_POLICY_MSG)
  })

  it('transportOverride mesh bei sonst internet: LoRa-Encoder', async () => {
    loraProgressiveEncodeMock.mockResolvedValue({
      ok: true,
      messageId: 'ffffffff',
      lumaWire: 'L',
      chromaWire: 'C',
      lumaJpegBytes: 1,
      chromaJpegBytes: 2,
    })
    await ingestCompactAttachmentPick(tinyPngFile(), {
      ...baseCtx,
      forcedTransport: 'internet',
      transportOverride: 'mesh',
      meshSelfArchiveAfterLoRa: true,
    })
    expect(loraProgressiveEncodeMock).toHaveBeenCalled()
    expect(compactImageEncodeMock).not.toHaveBeenCalled()
  })

  it('compactImageEncode Fehler → Failure mit Meldung', async () => {
    compactImageEncodeMock.mockResolvedValue({ ok: false, error: 'Backend weg' })
    const r = await ingestCompactAttachmentPick(tinyPngFile(), baseCtx)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toContain('Backend weg')
  })

  it('loraProgressiveEncode Fehler → Failure', async () => {
    loraProgressiveEncodeMock.mockResolvedValue({ ok: false, error: 'LoRa kaputt' })
    const r = await ingestCompactAttachmentPick(tinyPngFile(), {
      ...baseCtx,
      forcedTransport: 'mesh',
      meshSelfArchiveAfterLoRa: true,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toContain('LoRa kaputt')
  })
})
