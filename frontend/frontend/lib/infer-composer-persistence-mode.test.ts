import { describe, expect, it, vi } from 'vitest'

const ACTIVE_MB = '0x' + 'c'.repeat(64)

vi.mock('@/frontend/lib/contact-mailbox-slots', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/frontend/lib/contact-mailbox-slots')>()
  return {
    ...orig,
    readContactSendMailboxTarget: vi.fn(orig.readContactSendMailboxTarget),
  }
})

vi.mock('@/frontend/lib/my-mailbox-active', () => ({
  readActiveSendMailboxObjectId: () => ACTIVE_MB,
}))

vi.mock('@/frontend/lib/my-private-mailbox-store', () => ({
  readCachedServerMailboxObjectId: () => '',
}))

import { readContactSendMailboxTarget } from '@/frontend/lib/contact-mailbox-slots'
import { inferMessagingPersistenceModeFromComposer } from '@/frontend/lib/infer-composer-persistence-mode'

const WALLET = '0x' + 'a'.repeat(64)
const MAILBOX = '0x' + 'b'.repeat(64)

describe('inferMessagingPersistenceModeFromComposer', () => {
  it('Event ohne Mailbox-Feld', () => {
    vi.mocked(readContactSendMailboxTarget).mockReturnValue(undefined)
    expect(
      inferMessagingPersistenceModeFromComposer({
        recipient: WALLET,
        encrypted: true,
        forcedTransport: 'internet',
        deliveryChannel: 'chain',
        composerMailboxObjectId: '',
      })
    ).toBe('event')
  })

  it('Mailbox mit gültiger Mailbox-0x', () => {
    expect(
      inferMessagingPersistenceModeFromComposer({
        recipient: WALLET,
        encrypted: true,
        forcedTransport: 'internet',
        deliveryChannel: 'chain',
        composerMailboxObjectId: MAILBOX,
      })
    ).toBe('mailbox')
  })

  it('Mailbox über Kontakt-Ziel „own“ ohne explizite Composer-0x', () => {
    vi.mocked(readContactSendMailboxTarget).mockReturnValue('own')
    expect(
      inferMessagingPersistenceModeFromComposer({
        recipient: WALLET,
        encrypted: false,
        forcedTransport: 'internet',
        deliveryChannel: 'chain',
        composerMailboxObjectId: '',
        contactDirectory: {},
      })
    ).toBe('mailbox')
  })
})
