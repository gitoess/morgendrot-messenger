import { describe, expect, it } from 'vitest'
import {
  collectContactsForSendPath,
  contactReachableOnSendPath,
  formatAllRecipientsForSendPath,
  toggleComposerTelegramRecipient,
} from '@/frontend/lib/contact-send-path'

const alice = '0x' + '2'.repeat(64)
const bob = '0x' + '3'.repeat(64)

describe('contact-send-path', () => {
  it('filtert Kontakte nach Sendepfad', () => {
    const directory = {
      [alice]: { label: 'Alice', telegramChatId: '111' },
      [bob]: { label: 'Bob', meshNodeId: '!abc' },
    }
    expect(contactReachableOnSendPath(alice, directory[alice], 'internet')).toBe(true)
    expect(contactReachableOnSendPath(alice, directory[alice], 'telegram')).toBe(true)
    expect(contactReachableOnSendPath(bob, directory[bob], 'internet')).toBe(true)
    expect(contactReachableOnSendPath(bob, directory[bob], 'mesh')).toBe(true)
    expect(contactReachableOnSendPath(bob, directory[bob], 'telegram')).toBe(false)

    const tgOnly = collectContactsForSendPath({
      directory,
      partnerOptions: [],
      path: 'telegram',
    })
    expect(tgOnly.map((c) => c.storageKey)).toEqual([alice])
  })

  it('trägt alle IOTA-Adressen für „Alle“ ein', () => {
    const directory = {
      [alice]: { label: 'Alice' },
      [bob]: { label: 'Bob' },
    }
    const contacts = collectContactsForSendPath({
      directory,
      partnerOptions: [],
      path: 'internet',
    })
    const formatted = formatAllRecipientsForSendPath(contacts, 'internet')
    expect(formatted.recipient).toBe(`${alice}, ${bob}`)
    expect(formatted.partner).toBe(alice)
  })

  it('Funk „Alle“ bleibt Broadcast (kein Node-Ziel)', () => {
    const directory = {
      [bob]: { label: 'Bob', meshNodeId: '!abc' },
    }
    const contacts = collectContactsForSendPath({
      directory,
      partnerOptions: [],
      path: 'mesh',
    })
    const formatted = formatAllRecipientsForSendPath(contacts, 'mesh')
    expect(formatted.meshPlaintextToNodeEnabled).toBe(false)
    expect(formatted.meshPlaintextNodeId).toBe('')
  })

  it('toggleComposerTelegramRecipient schaltet tg:-Ziele um', () => {
    const add = toggleComposerTelegramRecipient('', '111')
    expect(add.recipient).toBe('tg:111')
    const two = toggleComposerTelegramRecipient(add.recipient, '222')
    expect(two.recipient).toBe('tg:111, tg:222')
    const rem = toggleComposerTelegramRecipient(two.recipient, '111')
    expect(rem.recipient).toBe('tg:222')
  })
})
