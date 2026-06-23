import { describe, expect, it } from 'vitest'
import { telegramInviteToDeepLink } from '@/frontend/lib/telegram-alarm-group-invite'

describe('telegram-alarm-group-invite', () => {
  it('konvertiert t.me/+ Link zu tg://join', () => {
    expect(telegramInviteToDeepLink('https://t.me/+AbCdEfGh')).toBe('tg://join?invite=AbCdEfGh')
  })

  it('konvertiert joinchat-Link', () => {
    expect(telegramInviteToDeepLink('https://t.me/joinchat/xyz')).toBe('tg://join?invite=xyz')
  })

  it('gibt null für unbekanntes Format', () => {
    expect(telegramInviteToDeepLink('https://example.com')).toBeNull()
  })
})
