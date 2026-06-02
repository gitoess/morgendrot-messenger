import { describe, expect, it } from 'vitest'
import { inferMessagingPersistenceModeFromComposer } from '@/frontend/lib/infer-composer-persistence-mode'

const WALLET = '0x' + 'a'.repeat(64)
const MAILBOX = '0x' + 'b'.repeat(64)

describe('inferMessagingPersistenceModeFromComposer', () => {
  it('Event ohne Mailbox-Feld', () => {
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
})
