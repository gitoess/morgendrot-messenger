import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/frontend/lib/image-encode/wasm-lora-fluent-backend', () => ({
  createWasmImageEncodePort: () => ({
    id: 'wasm' as const,
    encodeLoRaFluent: vi.fn().mockResolvedValue({
      ok: true,
      messageId: 'aabbccdd',
      lumaWire: '[[MORG_LUMA_V1:msgId=aabbccdd|len=4|QUJDRA==]]',
      chromaWire: '[[MORG_CHROMA_V1:msgId=aabbccdd|len=4|QUJDRA==]]',
      lumaJpegBytes: 3,
      chromaJpegBytes: 3,
      encoder: 'wasm',
    }),
  }),
}))

import { encodeLoRaFluentAutark } from './get-image-encode-port'

describe('encodeLoRaFluentAutark', () => {
  beforeEach(() => {
    window.localStorage.removeItem('morgendrot.imageEncodeRelayFallback')
  })

  it('nutzt wasm ohne relay fallback', async () => {
    const r = await encodeLoRaFluentAutark('data:image/png;base64,QUJDRA==')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.encoder).toBe('wasm')
  })
})
