import { describe, it, expect } from 'vitest'
import {
  meshtasticRadioChannelLabel,
  parseMeshtasticRadioChannel,
  upsertMeshtasticRadioChannel,
} from '@/frontend/lib/meshtastic-radio-channels'

describe('meshtastic-radio-channels', () => {
  it('parst Primary mit Name', () => {
    const c = parseMeshtasticRadioChannel({
      index: 0,
      role: 1,
      settings: { name: 'LongFast', psk: new Uint8Array([1, 2, 3]) },
    })
    expect(c).toEqual({
      index: 0,
      name: 'LongFast',
      role: 'primary',
      hasPsk: true,
    })
    expect(meshtasticRadioChannelLabel(c!)).toMatch(/0: LongFast/)
  })

  it('lehnt Index außerhalb 0–7 ab', () => {
    expect(parseMeshtasticRadioChannel({ index: 9, role: 2 })).toBeNull()
  })

  it('upsert nach Index', () => {
    const a = parseMeshtasticRadioChannel({ index: 1, role: 2, settings: { name: 'A' } })!
    const b = parseMeshtasticRadioChannel({ index: 1, role: 2, settings: { name: 'B' } })!
    expect(upsertMeshtasticRadioChannel([a], b)[0].name).toBe('B')
  })
})
