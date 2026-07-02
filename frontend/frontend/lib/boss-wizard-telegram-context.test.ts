import { describe, expect, it } from 'vitest'
import { deriveBossTelegramWizardStatus } from '@/frontend/lib/boss-wizard-telegram-context'

describe('boss-wizard-telegram-context', () => {
  it('erkennt konfigurierten Bot ohne Draft', () => {
    const s = deriveBossTelegramWizardStatus({
      botTokenConfigured: true,
      botToken: '1:abc',
      adminChatId: '99',
      einsatzGroupInviteLink: '',
    } as never)
    expect(s.readyMinimal).toBe(true)
    expect(s.groupConfigured).toBe(false)
  })

  it('gruppe optional separat', () => {
    const s = deriveBossTelegramWizardStatus(
      { botTokenConfigured: true, adminChatId: '1', einsatzGroupInviteLink: 'https://t.me/+x' } as never,
      {}
    )
    expect(s.groupConfigured).toBe(true)
  })
})
