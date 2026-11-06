import { describe, expect, it } from 'vitest'
import {
  appendNftKeycardDescriptionMarker,
  unpackNftKeycardDescriptionMarker,
} from '@/frontend/lib/nft-keycard-description-marker'

const CARD = '0x' + 'cd'.repeat(32)

describe('nft-keycard description marker (B2 P3)', () => {
  it('packt und liest öffentlichen Hinweis ohne Secrets', () => {
    const packed = appendNftKeycardDescriptionMarker('Einsatzfoto', {
      cardObjectId: CARD,
      slotId: 'img',
    })
    expect(packed).toContain('[morg-keycard]')
    expect(packed).toContain(`card=${CARD}`)
    expect(packed).toContain('slot=img')
    expect(packed.toLowerCase()).not.toContain('pass')
    expect(unpackNftKeycardDescriptionMarker(packed)).toEqual({
      cardObjectId: CARD,
      slotId: 'img',
    })
  })

  it('lehnt ungültige Card-ID ab', () => {
    expect(
      unpackNftKeycardDescriptionMarker('[morg-keycard]\ncard=0xabc\nslot=img')
    ).toBeNull()
  })
})
