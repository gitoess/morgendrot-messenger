import { describe, expect, it } from 'vitest'
import { computeWaldConnectionTier } from './chat-wald-connection'

describe('computeWaldConnectionTier', () => {
  it('Basis erreichbar → grün', () => {
    expect(computeWaldConnectionTier(false, false)).toBe('green')
    expect(computeWaldConnectionTier(false, true)).toBe('green')
  })

  it('Basis weg, Mesh/BLE da → blau', () => {
    expect(computeWaldConnectionTier(true, true)).toBe('blue')
  })

  it('Basis weg, kein Funk → rot', () => {
    expect(computeWaldConnectionTier(true, false)).toBe('red')
  })
})
