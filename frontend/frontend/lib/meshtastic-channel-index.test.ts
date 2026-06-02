import { describe, expect, it } from 'vitest'
import {
  isValidMeshtasticChannelIndex,
  normalizeMeshtasticChannelIndex,
} from '@/frontend/lib/meshtastic-channel-index'

describe('meshtastic-channel-index', () => {
  it('validiert nur 0..7 als Kanal-Index', () => {
    expect(isValidMeshtasticChannelIndex(0)).toBe(true)
    expect(isValidMeshtasticChannelIndex(7)).toBe(true)
    expect(isValidMeshtasticChannelIndex(8)).toBe(false)
    expect(isValidMeshtasticChannelIndex(-1)).toBe(false)
    expect(isValidMeshtasticChannelIndex(2.5)).toBe(false)
  })

  it('normalisiert Zahlen/Strings auf optionalen Kanal-Index', () => {
    expect(normalizeMeshtasticChannelIndex(3)).toBe(3)
    expect(normalizeMeshtasticChannelIndex('4')).toBe(4)
    expect(normalizeMeshtasticChannelIndex('')).toBeUndefined()
    expect(normalizeMeshtasticChannelIndex('foo')).toBeUndefined()
    expect(normalizeMeshtasticChannelIndex(99)).toBeUndefined()
  })
})

