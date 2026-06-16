import { describe, expect, it } from 'vitest'
import {
  collectContactsForSendPath,
  contactReachableOnSendPath,
  formatAllRecipientsForSendPath,
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
})
