import { describe, expect, it } from 'vitest'
import { buildReceiveSharePayload } from '@/frontend/lib/receive-share-payload'

const W = '0x' + 'aa'.repeat(32)
const M = '0x' + 'bb'.repeat(32)

describe('buildReceiveSharePayload', () => {
  it('combines wallet + mailboxes + contact into one payload', () => {
    const t = buildReceiveSharePayload({
      includeWallet: true,
      walletAddress: W,
      mailboxes: [{ id: M, label: 'Privat' }],
      includeContact: true,
      contactName: 'Ada',
      contactPhone: '+49',
      contactNote: 'Bitte IOTA',
    })
    expect(t).toContain('MORGENDROT-SHARE')
    expect(t).toContain(`Wallet: ${W}`)
    expect(t).toContain(`Mailbox Privat: ${M}`)
    expect(t).toContain('Name: Ada')
    expect(t).toContain('Tel: +49')
    expect(t).toContain('Notiz: Bitte IOTA')
  })

  it('returns empty when nothing selected', () => {
    expect(
      buildReceiveSharePayload({
        includeWallet: false,
        mailboxes: [],
        includeContact: false,
      })
    ).toBe('')
  })
})
