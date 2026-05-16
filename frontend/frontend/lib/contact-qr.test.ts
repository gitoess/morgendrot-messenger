import { describe, expect, it } from 'vitest'
import { buildContactQrPayload, parseContactQrPayload } from '@/frontend/lib/contact-qr'

describe('contact-qr M4c', () => {
  const wallet = '0x' + 'a'.repeat(64)
  const mb = '0x' + 'b'.repeat(64)

  it('roundtrip v2 with mailbox', () => {
    const raw = buildContactQrPayload({ address: wallet, displayName: 'Anna', mailboxObjectId: mb })
    const p = parseContactQrPayload(raw)
    expect(p?.address.toLowerCase()).toBe(wallet.toLowerCase())
    expect(p?.displayName).toBe('Anna')
    expect(p?.mailboxObjectId?.toLowerCase()).toBe(mb.toLowerCase())
  })

  it('plain 0x address', () => {
    expect(parseContactQrPayload(wallet)?.address.toLowerCase()).toBe(wallet.toLowerCase())
  })

  it('omits m when mailbox equals wallet (common mistake)', () => {
    const raw = buildContactQrPayload({ address: wallet, mailboxObjectId: wallet })
    expect(raw).not.toContain('"m"')
    const p = parseContactQrPayload(raw)
    expect(p?.mailboxObjectId).toBeUndefined()
  })
})
