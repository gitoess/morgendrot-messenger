import { describe, expect, it, vi } from 'vitest'
import {
  canUseLocalWhisperStt,
  LOCAL_STT_MAX_MS,
  LOCAL_WHISPER_MODEL,
  resampleAndNormalize,
} from '@/frontend/lib/local-whisper-stt'

describe('local-whisper-stt', () => {
  it('nutzt DE-Fine-Tune, nicht tiny', () => {
    expect(LOCAL_WHISPER_MODEL).toMatch(/german/i)
    expect(LOCAL_WHISPER_MODEL).not.toMatch(/tiny/i)
  })

  it('LOCAL_STT_MAX_MS ist sinnvolle Obergrenze', () => {
    expect(LOCAL_STT_MAX_MS).toBeGreaterThanOrEqual(10_000)
    expect(LOCAL_STT_MAX_MS).toBeLessThanOrEqual(60_000)
  })

  it('resampleAndNormalize 48k→16k + Peak', () => {
    const src = new Float32Array(4800)
    for (let i = 0; i < src.length; i++) src[i] = 0.1 * Math.sin((i / 4800) * Math.PI * 2 * 20)
    const out = resampleAndNormalize(src, 48_000)
    expect(out.length).toBe(1600)
    let peak = 0
    for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]!))
    expect(peak).toBeGreaterThan(0.5)
    expect(peak).toBeLessThanOrEqual(1)
  })

  it('canUseLocalWhisperStt ohne Window → false', () => {
    vi.stubGlobal('window', undefined)
    expect(canUseLocalWhisperStt()).toBe(false)
  })
})
