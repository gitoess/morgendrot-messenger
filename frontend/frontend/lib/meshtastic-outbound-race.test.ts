import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  assertMeshtasticOutboundConfirmed,
  isMeshtasticOutboundConfirmed,
  MESH_SEND_QUEUE_STALL_MS,
  MESH_SEND_STALL_ERROR_MSG,
  MESH_SEND_UNCONFIRMED_ERROR_MSG,
  raceMeshtasticOutbound,
} from '@/frontend/lib/meshtastic-outbound-race'

describe('isMeshtasticOutboundConfirmed', () => {
  it('akzeptiert Packet-id als Zahl oder Objekt', () => {
    expect(isMeshtasticOutboundConfirmed(42)).toBe(true)
    expect(isMeshtasticOutboundConfirmed({ id: 99 })).toBe(true)
    expect(isMeshtasticOutboundConfirmed({ id: 'abc' })).toBe(true)
  })

  it('lehnt leeres Objekt / null ab (früherer False-Success)', () => {
    expect(isMeshtasticOutboundConfirmed({})).toBe(false)
    expect(isMeshtasticOutboundConfirmed(null)).toBe(false)
    expect(isMeshtasticOutboundConfirmed(undefined)).toBe(false)
    expect(isMeshtasticOutboundConfirmed({ error: 0 })).toBe(false)
  })
})

describe('assertMeshtasticOutboundConfirmed', () => {
  it('wirft bei unbestätigtem Ergebnis', () => {
    expect(() => assertMeshtasticOutboundConfirmed({}, 'Test')).toThrow(MESH_SEND_UNCONFIRMED_ERROR_MSG)
  })

  it('passt bei id', () => {
    expect(() => assertMeshtasticOutboundConfirmed({ id: 1 }, 'Test')).not.toThrow()
  })
})

describe('raceMeshtasticOutbound', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('liefert das Promise-Ergebnis', async () => {
    await expect(raceMeshtasticOutbound(Promise.resolve({ id: 7 }), 5_000)).resolves.toEqual({ id: 7 })
  })

  it('wirft Stall-Fehler statt Fake-{}', async () => {
    vi.useFakeTimers()
    const pending = new Promise<{ id: number }>(() => undefined)
    const raced = raceMeshtasticOutbound(pending, 100)
    const assertion = expect(raced).rejects.toThrow(MESH_SEND_STALL_ERROR_MSG)
    await vi.advanceTimersByTimeAsync(100)
    await assertion
  })

  it('wirft Transport-Fehler durch (GATT), kein Fake-Erfolg', async () => {
    await expect(
      raceMeshtasticOutbound(Promise.reject(new Error('GATT Server is disconnected')), 5_000)
    ).rejects.toThrow(/GATT Server is disconnected/)
  })

  it('Soft-Routing wird als Erfolg (id) zurückgegeben — kein Throw', async () => {
    const soft = { id: 621550361, error: undefined }
    await expect(raceMeshtasticOutbound(Promise.reject(soft), 5_000)).resolves.toMatchObject({
      id: 621550361,
      softRouting: true,
    })
  })

  it('hartes Routing-Object wird zu lesbarem Error', async () => {
    await expect(
      raceMeshtasticOutbound(Promise.reject({ id: 1, error: 7 }), 5_000)
    ).rejects.toThrow(/zu groß|TOO_LARGE|Meshtastic/i)
  })

  it('bricht bei isCancelled ab (Stop)', async () => {
    vi.useFakeTimers()
    let cancelled = false
    const pending = new Promise<{ id: number }>(() => undefined)
    const raced = raceMeshtasticOutbound(pending, 25_000, {
      isCancelled: () => cancelled,
      cancelMessage: 'Übertragung abgebrochen.',
    })
    const assertion = expect(raced).rejects.toThrow(/abgebrochen/)
    cancelled = true
    await vi.advanceTimersByTimeAsync(150)
    await assertion
  })

  it('queueConfirm: Stall → queued Erfolg (kein 25s-Fail)', async () => {
    vi.useFakeTimers()
    const pending = new Promise<{ id: number }>(() => undefined)
    const raced = raceMeshtasticOutbound(pending, 25_000, { queueConfirm: true })
    const assertion = expect(raced).resolves.toMatchObject({ id: 0, queued: true })
    await vi.advanceTimersByTimeAsync(MESH_SEND_QUEUE_STALL_MS)
    await assertion
  })
})
