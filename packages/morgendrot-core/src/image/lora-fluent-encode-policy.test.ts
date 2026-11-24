import { describe, expect, it } from 'vitest'
import {
  encodeLoraFluentRobustWithPolicy,
  encodeLoraFluentWithPolicy,
  resolveLoraFluentBudgets,
} from './lora-fluent-encode-policy'

describe('lora-fluent-encode-policy', () => {
  it('resolveLoraFluentBudgets cappt bei Paar-Max', () => {
    const b = resolveLoraFluentBudgets(99_000)
    expect(b.pairMax).toBe(3600)
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
      expect(r.bundle.lumaJpegBytes + r.bundle.chromaJpegBytes).toBeLessThanOrEqual(3600)
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

  it('Fehlertext erklärt Motiv/Entropie, nicht Dateiendung', async () => {
    const r = await encodeLoraFluentWithPolicy({
      encodeAttempt: async () => ({
        luma: new Uint8Array(3000),
        chroma: new Uint8Array(1000),
      }),
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toMatch(/detailreich|Motiv/i)
      expect(r.error).toMatch(/Dateigröße|Endung/)
    }
  })

  it('Notfall-Breite 96 wird versucht wenn große Luma zu fett', async () => {
    const widths: number[] = []
    const r = await encodeLoraFluentWithPolicy({
      encodeAttempt: async (a) => {
        widths.push(a.lumaWidth)
        if (a.lumaWidth > 100) {
          return { luma: new Uint8Array(5000), chroma: new Uint8Array(200) }
        }
        return { luma: new Uint8Array(900), chroma: new Uint8Array(300) }
      },
    })
    expect(r.ok).toBe(true)
    expect(widths).toContain(96)
  })

  it('größte maxDim zuerst; bleibt bei 360 wenn es passt', async () => {
    const tried: number[] = []
    const r = await encodeLoraFluentWithPolicy({
      encodeAttempt: async (a) => {
        tried.push(a.lumaWidth)
        return { luma: new Uint8Array(900), chroma: new Uint8Array(300) }
      },
    })
    expect(r.ok).toBe(true)
    expect(tried[0]).toBe(360)
    expect(tried.every((w) => w === 360)).toBe(true)
  })
})
