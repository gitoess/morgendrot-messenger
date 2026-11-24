import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildMorgSegV1Wire } from '@/frontend/lib/lora-sarq-wire'
import {
  getSarqLiveAssembled,
  getSarqLivePhase,
  noteSarqSegFromMesh,
  requestSarqLiveMissing,
  resetSarqLiveProgressForTests,
  setSarqLiveNakHandler,
  subscribeSarqLiveProgress,
} from '@/frontend/lib/lora-sarq-live-progress'

function segWire(phase: 'luma' | 'chroma', msgId: string, n: number, seg: number, raw: Uint8Array) {
  return buildMorgSegV1Wire({ msgId, phase, n, seg, raw })
}

describe('lora-sarq-live-progress', () => {
  afterEach(() => {
    resetSarqLiveProgressForTests()
  })

  it('normalizeSarqPeerKey: mesh:! / ! / hex → eine Session', async () => {
    const { normalizeSarqPeerKey } = await import('@/frontend/lib/lora-sarq-live-progress')
    expect(normalizeSarqPeerKey('mesh:!43adeb0')).toBe('!43adeb0')
    expect(normalizeSarqPeerKey('!43adeb0')).toBe('!43adeb0')
    expect(normalizeSarqPeerKey('43adeb0')).toBe('!43adeb0')
    noteSarqSegFromMesh('mesh:!43adeb0', segWire('luma', 'aabbccdd', 2, 0, new Uint8Array([1])))
    expect(getSarqLivePhase('!43adeb0', 'aabbccdd', 'luma')?.receivedCount).toBe(1)
    expect(getSarqLivePhase('mesh:!43adeb0', 'aabbccdd', 'luma')?.receivedCount).toBe(1)
  })

  it('aktualisiert Fortschritt ohne React-Inbox und feuert Subscribe', () => {
    let ticks = 0
    const off = subscribeSarqLiveProgress(() => {
      ticks++
    })
    const msgId = 'aabbccdd'
    const n = 3
    const raw = new Uint8Array([1, 2, 3])
    noteSarqSegFromMesh('!nodeA', segWire('luma', msgId, n, 0, raw))
    noteSarqSegFromMesh('!nodeA', segWire('luma', msgId, n, 2, raw))
    const snap = getSarqLivePhase('!nodea', msgId, 'luma')
    expect(snap?.receivedCount).toBe(2)
    expect(snap?.n).toBe(3)
    expect(ticks).toBeGreaterThanOrEqual(2)
    off()
  })

  it('assembliert und speichert Bytes; NAK mask=0', () => {
    const naks: string[] = []
    setSarqLiveNakHandler((w) => naks.push(w))
    const msgId = 'deadbeef'
    const parts = [new Uint8Array([0xff, 0xd8]), new Uint8Array([1]), new Uint8Array([0xd9])]
    for (let i = 0; i < parts.length; i++) {
      noteSarqSegFromMesh('alice', segWire('chroma', msgId, 3, i, parts[i]!))
    }
    const bytes = getSarqLiveAssembled('alice', msgId, 'chroma')
    expect(bytes?.length).toBe(4)
    expect(naks.some((w) => /mask=00000000/.test(w))).toBe(true)
    expect(getSarqLivePhase('alice', msgId, 'chroma')?.assembled).toBe(true)
  })

  it('requestSarqLiveMissing sendet nur Lücken-NAK', () => {
    const naks: string[] = []
    setSarqLiveNakHandler((w) => naks.push(w))
    const msgId = 'cafebabe'
    noteSarqSegFromMesh('bob', segWire('luma', msgId, 4, 0, new Uint8Array([1])))
    noteSarqSegFromMesh('bob', segWire('luma', msgId, 4, 1, new Uint8Array([2])))
    naks.length = 0
    const w = requestSarqLiveMissing('bob', msgId, 'luma')
    expect(w).toBeTruthy()
    expect(w).toMatch(/MORG_NAK_V1/)
    expect(w).not.toMatch(/mask=00000000/)
    /** Bits 2+3 fehlen → Maske nicht „alles“. */
    expect(naks).toHaveLength(1)
  })

  it('Idle-NAK nach Pause (fake timers)', () => {
    vi.useFakeTimers()
    const naks: string[] = []
    setSarqLiveNakHandler((w) => naks.push(w))
    noteSarqSegFromMesh('carol', segWire('luma', '11223344', 2, 0, new Uint8Array([9])))
    expect(naks.length).toBe(0)
    vi.advanceTimersByTime(2_600)
    expect(naks.length).toBeGreaterThanOrEqual(1)
    vi.useRealTimers()
  })
})
