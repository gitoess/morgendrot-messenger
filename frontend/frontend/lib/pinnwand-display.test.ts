import { describe, expect, it } from 'vitest'
import {
  pinnwandChannelTabLabel,
  pinnwandSenderDisplayLabel,
  shouldMaskPinnwandSender,
} from '@/frontend/lib/pinnwand-display'

describe('pinnwand-display', () => {
  it('maskiert Absender für Helfer', () => {
    expect(shouldMaskPinnwandSender('arbeiter', { simpleMode: false })).toBe(true)
    expect(
      pinnwandSenderDisplayLabel('arbeiter', null, '0x' + 'a'.repeat(64))
    ).toBe('Einsatzleitung')
  })

  it('Tab-Label: Helfer/Simple Lagebild, Führung Pinnwand', () => {
    expect(pinnwandChannelTabLabel('arbeiter', { simpleMode: true })).toBe('Lagebild')
    expect(pinnwandChannelTabLabel('boss', { simpleMode: false })).toBe('Pinnwand')
  })
})
