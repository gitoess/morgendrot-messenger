import { describe, expect, it } from 'vitest'
import { isMessengerProductBuild, isProjektProductBuild, MORG_PRODUCT } from './morg-product'

describe('morg-product', () => {
  it('Standard-Build ist Morgendrot Projekt', () => {
    expect(MORG_PRODUCT).toBe('projekt')
    expect(isProjektProductBuild()).toBe(true)
    expect(isMessengerProductBuild()).toBe(false)
  })
})
