import { describe, expect, it } from 'vitest'
import {
  buildTelegramMessagePreview,
  normalizeTelegramRecipientInput,
  parseTelegramRecipientChatIds,
  resolveTelegramNotifyRecipientAddress,
  telegramRecipientToComposerDisplay,
} from '@/frontend/lib/telegram-notify-pref'

describe('telegram-notify-pref', () => {
  it('normalisiert Empfänger auf tg:-Schlüssel', () => {
    expect(normalizeTelegramRecipientInput('12345')).toBe('tg:12345')
    expect(normalizeTelegramRecipientInput('tg:-999')).toBe('tg:-999')
  })

  it('parst mehrere Chat-IDs komma-/tg-getrennt', () => {
    expect(parseTelegramRecipientChatIds('123456, 789')).toEqual(['123456', '789'])
    expect(parseTelegramRecipientChatIds('tg:111,tg:222')).toEqual(['111', '222'])
    expect(parseTelegramRecipientChatIds('111; 222')).toEqual(['111', '222'])
  })

  it('Composer-Anzeige lässt Komma-Liste zu (kein sofortiges Wegnormalisieren)', () => {
    expect(telegramRecipientToComposerDisplay('123, 456')).toBe('123, 456')
    expect(telegramRecipientToComposerDisplay('tg:1,tg:2')).toBe('1, 2')
    expect(telegramRecipientToComposerDisplay(`0x${'a'.repeat(64)}`)).toBe('')
  })

  it('verwendet recipient-0x als Notify-Ziel', () => {
    const addr = `0x${'a'.repeat(64)}`
    expect(
      resolveTelegramNotifyRecipientAddress({
        recipient: addr,
        encrypted: false,
      })
    ).toBe(addr)
  })

  it('nutzt im encrypted-Fall partner wenn recipient leer ist', () => {
    const partner = `0x${'b'.repeat(64)}`
    expect(
      resolveTelegramNotifyRecipientAddress({
        recipient: '',
        partner,
        encrypted: true,
      })
    ).toBe(partner)
  })

  it('fällt im encrypted-Fall auf genau eine connectedAddress zurück', () => {
    const only = `0x${'c'.repeat(64)}`
    expect(
      resolveTelegramNotifyRecipientAddress({
        recipient: '',
        encrypted: true,
        connectedAddresses: [only],
      })
    ).toBe(only)
  })

  it('liefert null wenn kein valides Ziel ermittelbar ist', () => {
    expect(
      resolveTelegramNotifyRecipientAddress({
        recipient: 'foo',
        encrypted: false,
      })
    ).toBeNull()
  })

  it('baut Preview in sinnvoller Priorität', () => {
    expect(
      buildTelegramMessagePreview({
        message: ' Hallo ',
      })
    ).toBe('Hallo')

    expect(
      buildTelegramMessagePreview({
        message: '',
        attachedTxtFile: { name: 'note.txt', text: 'abc' },
      })
    ).toBe('abc')

    expect(
      buildTelegramMessagePreview({
        message: '',
        attachedBlobBase64: 'x',
      })
    ).toBe('[Bild-Anhang]')
  })
})
