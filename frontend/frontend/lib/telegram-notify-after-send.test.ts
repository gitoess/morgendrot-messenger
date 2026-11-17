import { describe, expect, it } from 'vitest'
import {
  formatTelegramNotifyDeliveredSuffix,
  planTelegramNotifyAfterSend,
} from '@/frontend/lib/telegram-notify-after-send'

const ADDR = `0x${'a'.repeat(64)}`

describe('planTelegramNotifyAfterSend (§ H.1b)', () => {
  it('skip: contact ohne 0x', () => {
    const p = planTelegramNotifyAfterSend({
      audience: 'contact',
      recipientAddress: 'not-an-address',
      contactTelegramChatId: '123',
      extraChatIds: [],
    })
    expect(p.kind).toBe('skip')
    if (p.kind === 'skip') {
      expect(p.reason).toMatch(/0x-Empfänger/)
    }
  })

  it('skip: contact ohne Telegram-ID', () => {
    const p = planTelegramNotifyAfterSend({
      audience: 'contact',
      recipientAddress: ADDR,
      contactTelegramChatId: '',
      extraChatIds: [],
    })
    expect(p.kind).toBe('skip')
    if (p.kind === 'skip') {
      expect(p.reason).toMatch(/Telegram-ID/)
    }
  })

  it('call: self auch ohne Kontakt-TG', () => {
    const p = planTelegramNotifyAfterSend({
      audience: 'self',
      recipientAddress: ADDR,
      contactTelegramChatId: null,
      extraChatIds: [],
    })
    expect(p).toMatchObject({
      kind: 'call',
      apiAudience: 'self',
      recipientAddress: undefined,
      wantContact: false,
      contactOk: false,
    })
  })

  it('call: both mit Kontakt-TG → apiAudience both + Adresse', () => {
    const p = planTelegramNotifyAfterSend({
      audience: 'both',
      recipientAddress: ADDR,
      contactTelegramChatId: '999',
      extraChatIds: [],
    })
    expect(p).toMatchObject({
      kind: 'call',
      apiAudience: 'both',
      recipientAddress: ADDR,
      contactOk: true,
      wantContact: true,
    })
  })

  it('call: nur CC (contact ohne TG, aber extras)', () => {
    const p = planTelegramNotifyAfterSend({
      audience: 'contact',
      recipientAddress: ADDR,
      contactTelegramChatId: '',
      extraChatIds: ['111', '222'],
    })
    expect(p).toMatchObject({
      kind: 'call',
      apiAudience: 'contact',
      recipientAddress: undefined,
      contactOk: false,
      extraChatIds: ['111', '222'],
    })
  })
})

describe('formatTelegramNotifyDeliveredSuffix (§ H.1b)', () => {
  it('listet Kontakt + dich + CC', () => {
    expect(
      formatTelegramNotifyDeliveredSuffix({
        audience: 'both',
        wantContact: true,
        contactOk: true,
        deliveredContact: true,
        deliveredAdmin: true,
        deliveredExtra: 2,
      })
    ).toBe('Telegram-Hinweis an Kontakt + dich + 2× CC gesendet.')
  })

  it('merkt übersprungenen Kontakt wenn nur Admin/CC lieferten', () => {
    expect(
      formatTelegramNotifyDeliveredSuffix({
        audience: 'both',
        wantContact: true,
        contactOk: false,
        deliveredAdmin: true,
        deliveredExtra: 1,
      })
    ).toBe(
      'Telegram-Hinweis an dich + 1× CC gesendet. (Kontakt ohne TG-ID übersprungen)'
    )
  })
})
