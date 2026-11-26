import { describe, expect, it } from 'vitest'
import { parseContactQrPayload } from '@/frontend/lib/contact-qr'
import {
  buildVisitenkarteShare,
  defaultVisitenkarteShareFlags,
} from '@/frontend/lib/visitenkarte-share'

describe('visitenkarte-share', () => {
  const addr = '0x' + 'c'.repeat(64)
  const mb = '0x' + 'd'.repeat(64)

  it('default flags', () => {
    expect(defaultVisitenkarteShareFlags({ hasTelegram: true, hasEcdh: true })).toMatchObject({
      includeWallet: true,
      includeTelegram: true,
      includeEcdh: true,
    })
  })

  it('QR ohne Name/TG wenn abgewählt; Wallet immer; Mesh nur Klartext', () => {
    const r = buildVisitenkarteShare({
      address: addr,
      displayName: 'Ada',
      telegramChatId: '999',
      meshNodeId: '!abc123',
      ecdhPubB64: 'AAA',
      mailboxObjectId: mb,
      flags: {
        includeDisplayName: false,
        includeWallet: true,
        includeTelegram: true,
        includeEcdh: false,
        includeMailbox: true,
        includeMeshNode: true,
      },
    })
    const p = parseContactQrPayload(r.qrJson)
    expect(p?.address.toLowerCase()).toBe(addr.toLowerCase())
    expect(p?.displayName).toBeUndefined()
    expect(p?.ecdhPubB64).toBeUndefined()
    expect(p?.mailboxObjectId?.toLowerCase()).toBe(mb.toLowerCase())
    expect(r.plainText).toContain('Telegram-Chat-ID: 999')
    expect(r.plainText).toContain('Funk-Node: !abc123')
    expect(r.plainText).toContain(addr)
    expect(r.plainText).not.toContain('Name: Ada')
    expect(r.qrJson).not.toContain('!abc123')
  })
})
