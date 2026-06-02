import { describe, expect, it } from 'vitest'
import {
  encodeLoraFluentRobustWithPolicy,
  encodeLoraFluentWithPolicy,
  resolveLoraFluentBudgets,
} from './lora-fluent-encode-policy'

describe('lora-fluent-encode-policy', () => {
  it('resolveLoraFluentBudgets cappt bei 12 KB', () => {
    const b = resolveLoraFluentBudgets(99_000)
    expect(b.pairMax).toBe(12_000)
  })

  it('findet Paar wenn Mock-JPEGs klein genug', async () => {
    const r = await encodeLoraFluentWithPolicy({
      encodeAttempt: async () => ({
        luma: new Uint8Array(800),
        chroma: new Uint8Array(400),
      }),
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.bundle.lumaWire).toContain('MORG_LUMA_V1')
      expect(r.bundle.chromaWire).toContain('MORG_CHROMA_V1')
      expect(r.bundle.lumaJpegBytes + r.bundle.chromaJpegBytes).toBeLessThanOrEqual(12_000)
    }
  })

  it('robust probiert kleinere dim', async () => {
    let dim = 0
    const r = await encodeLoraFluentRobustWithPolicy({
      prepareSourceAtDim: async (d) => {
        dim = d
      },
      encodeAttempt: async () => {
        if (dim > 400) return null
        return { luma: new Uint8Array(500), chroma: new Uint8Array(300) }
      },
    })
    expect(r.ok).toBe(true)
  })
})
