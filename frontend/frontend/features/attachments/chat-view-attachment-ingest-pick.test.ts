import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/frontend/lib/image-encode/get-image-encode-port', () => ({
  encodeLoRaFluentAutark: vi.fn(),
  encodeIotaCompactAutark: vi.fn(),
}))

import { encodeIotaCompactAutark, encodeLoRaFluentAutark } from '@/frontend/lib/image-encode/get-image-encode-port'
import { CHAT_LORA_DUAL_IMAGE_POLICY_MSG } from '@/frontend/lib/chat-view-messenger-transport'
import { ingestCompactAttachmentPick } from './chat-view-attachment-ingest'

const encodeIotaCompactAutarkMock = vi.mocked(encodeIotaCompactAutark)
const encodeLoRaFluentAutarkMock = vi.mocked(encodeLoRaFluentAutark)

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
  meshLoRaImagesEnabled: false,
}

describe('ingestCompactAttachmentPick', () => {
  beforeEach(() => {
    encodeIotaCompactAutarkMock.mockReset()
    encodeLoRaFluentAutarkMock.mockReset()
  })

  it('.txt ohne API', async () => {
    const f = new File(['hello'], 'a.txt', { type: 'text/plain' })
    const r = await ingestCompactAttachmentPick(f, baseCtx)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.attachedTxtFile).toEqual({ name: 'a.txt', text: 'hello' })
      expect(r.attachedBlobBase64).toBeNull()
      expect(encodeIotaCompactAutarkMock).not.toHaveBeenCalled()
    }
  })

  it('Bild + internet: ruft lokale IOTA-Kodierung auf', async () => {
    encodeIotaCompactAutarkMock.mockResolvedValue({
      ok: true,
      blobBase64: 'QUJDRA==',
      totalBytes: 400,
      lumaBytes: 100,
      chromaBytes: 300,
      usedQuality: 72,
      encoder: 'wasm',
    })
    const r = await ingestCompactAttachmentPick(tinyPngFile(), baseCtx)
    expect(encodeIotaCompactAutarkMock).toHaveBeenCalledTimes(1)
    expect(encodeLoRaFluentAutarkMock).not.toHaveBeenCalled()
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.attachedBlobBase64).toBe('QUJDRA==')
      expect(r.attachedLora).toBeNull()
      expect(r.compactMeta.mode).toBe('iota')
      expect(r.compactMeta.q).toBe(72)
    }
  })

  it('Bild + mesh: ruft lokale LoRa-Kodierung auf', async () => {
    encodeLoRaFluentAutarkMock.mockResolvedValue({
      ok: true,
      messageId: 'a1b2c3d4',
      lumaWire: '[[LUMA]]',
      chromaWire: '[[CHROMA]]',
      lumaJpegBytes: 11,
      chromaJpegBytes: 22,
      encoder: 'wasm',
    })
    const r = await ingestCompactAttachmentPick(tinyPngFile(), {
      ...baseCtx,
      forcedTransport: 'mesh',
      meshLoRaImagesEnabled: true,
    })
    expect(encodeLoRaFluentAutarkMock).toHaveBeenCalledTimes(1)
    expect(encodeIotaCompactAutarkMock).not.toHaveBeenCalled()
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

  it('Bild + mesh ohne „Bilder über Funk“: kein LoRa-Encode, Policy-Meldung', async () => {
    const r = await ingestCompactAttachmentPick(tinyPngFile(), {
      ...baseCtx,
      forcedTransport: 'mesh',
      meshLoRaImagesEnabled: false,
    })
    expect(encodeLoRaFluentAutarkMock).not.toHaveBeenCalled()
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toBe(CHAT_LORA_DUAL_IMAGE_POLICY_MSG)
  })

  it('Bild + mesh + Bilder über Funk mit Schloss an: LoRa-Encode (Luft Klartext)', async () => {
    encodeLoRaFluentAutarkMock.mockResolvedValue({
      ok: true,
      messageId: 'a1b2c3d4',
      lumaWire: '[[LUMA]]',
      chromaWire: '[[CHROMA]]',
      lumaJpegBytes: 11,
      chromaJpegBytes: 22,
      encoder: 'wasm',
    })
    const r = await ingestCompactAttachmentPick(tinyPngFile(), {
      ...baseCtx,
      forcedTransport: 'mesh',
      encrypted: true,
      meshLoRaImagesEnabled: true,
    })
    expect(encodeLoRaFluentAutarkMock).toHaveBeenCalledTimes(1)
    expect(encodeIotaCompactAutarkMock).not.toHaveBeenCalled()
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.attachedLora).toMatchObject({ lumaWire: '[[LUMA]]', chromaWire: '[[CHROMA]]' })
  })

  it('transportOverride mesh bei sonst internet: LoRa-Encoder', async () => {
    encodeLoRaFluentAutarkMock.mockResolvedValue({
      ok: true,
      messageId: 'ffffffff',
      lumaWire: 'L',
      chromaWire: 'C',
      lumaJpegBytes: 1,
      chromaJpegBytes: 2,
      encoder: 'wasm',
    })
    await ingestCompactAttachmentPick(tinyPngFile(), {
      ...baseCtx,
      forcedTransport: 'internet',
      transportOverride: 'mesh',
      meshLoRaImagesEnabled: true,
    })
    expect(encodeLoRaFluentAutarkMock).toHaveBeenCalledTimes(1)
    expect(encodeIotaCompactAutarkMock).not.toHaveBeenCalled()
  })

  it('encodeIotaCompactAutark Fehler → Failure mit Meldung', async () => {
    encodeIotaCompactAutarkMock.mockResolvedValue({ ok: false, error: 'IOTA kaputt' })
    const r = await ingestCompactAttachmentPick(tinyPngFile(), baseCtx)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toContain('IOTA kaputt')
  })

  it('encodeLoRaFluentAutark Fehler → Failure', async () => {
    encodeLoRaFluentAutarkMock.mockResolvedValue({ ok: false, error: 'LoRa kaputt' })
    const r = await ingestCompactAttachmentPick(tinyPngFile(), {
      ...baseCtx,
      forcedTransport: 'mesh',
      meshLoRaImagesEnabled: true,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toContain('LoRa kaputt')
  })
})
