import { describe, expect, it } from 'vitest'
import { formatTelegramNotifyTargetHint } from '@/frontend/lib/telegram-notify-target-hint'

const ADDR = `0x${'a'.repeat(64)}`

describe('formatTelegramNotifyTargetHint', () => {
  it('warnt wenn kein Notify-Ziel ermittelbar ist', () => {
    expect(
      formatTelegramNotifyTargetHint({
        recipient: '',
        partner: '',
        encrypted: false,
        contactDirectory: {},
      })
    ).toContain('Kein Ziel')
  })

  it('zeigt tg:-Empfänger direkt an', () => {
    expect(
      formatTelegramNotifyTargetHint({
        recipient: 'tg:99317902',
        partner: '',
        encrypted: false,
        contactDirectory: {},
      })
    ).toBe('Ziel: Telegram Chat-ID 99317902')
  })

  it('zeigt Label und Telegram-ID aus Telefonbuch', () => {
    expect(
      formatTelegramNotifyTargetHint({
        recipient: ADDR,
        partner: '',
        encrypted: false,
        contactDirectory: {
          [ADDR]: { label: 'Hans Dampf', telegramChatId: '99317902' },
        },
      })
    ).toBe('Ziel: Hans Dampf · Telegram 99317902')
  })

  it('warnt wenn Kontakt keine Telegram-Chat-ID hat', () => {
    expect(
      formatTelegramNotifyTargetHint({
        recipient: ADDR,
        partner: '',
        encrypted: false,
        contactDirectory: {
          [ADDR]: { label: 'Ohne TG' },
        },
      })
    ).toContain('fehlt die Telegram-Chat-ID')
  })
})
