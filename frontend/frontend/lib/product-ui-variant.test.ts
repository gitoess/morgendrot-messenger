import { describe, expect, it } from 'vitest'
import { isMessengerProductUiVariant, isProjektProductUiVariant } from './product-ui-variant'

describe('product-ui-variant', () => {
  it('erkennt Messenger vs Projekt', () => {
    expect(isMessengerProductUiVariant('messenger')).toBe(true)
    expect(isProjektProductUiVariant('messenger')).toBe(false)
    expect(isMessengerProductUiVariant('full')).toBe(false)
    expect(isProjektProductUiVariant('full')).toBe(true)
  })
})
