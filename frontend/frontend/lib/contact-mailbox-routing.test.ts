import { describe, expect, it } from 'vitest'
import {
  findContactAddressByMailboxObjectId,
  resolveContactMailboxObjectId,
} from '@/frontend/lib/contact-mailbox-routing'

const MB = '0x' + 'a'.repeat(64)
const WALLET = '0x' + 'b'.repeat(64)

describe('contact-mailbox-routing', () => {
  it('resolveContactMailboxObjectId liest private Slot / Legacy', () => {
    const dir = { [WALLET]: { label: 'Test', mailboxPrivateId: MB } }
    expect(resolveContactMailboxObjectId(dir, WALLET)).toBe(MB)
  })

  it('findContactAddressByMailboxObjectId findet Wallet zur Mailbox', () => {
    const dir = { [WALLET]: { mailboxObjectId: MB, label: 'Anna' } }
    expect(findContactAddressByMailboxObjectId(dir, MB)).toBe(WALLET.toLowerCase())
  })
})
