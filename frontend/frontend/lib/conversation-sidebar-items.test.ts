import { describe, expect, it } from 'vitest'
import { buildConversationSidebarContacts } from '@/frontend/lib/conversation-sidebar-items'
import { ZERO_IOTA_ADDRESS } from '@/frontend/lib/contact-storage-key'

const alice = '0x' + '2'.repeat(64)
const bob = '0x' + '3'.repeat(64)
const ghost = '0x' + '4'.repeat(64)

describe('buildConversationSidebarContacts', () => {
  it('zeigt nur Telefonbuch-Kontakte, keine reinen Posteingangs-Adressen', () => {
    const directory = {
      [alice]: { label: 'Alice' },
      [bob]: { label: 'Bob' },
    }
    const items = buildConversationSidebarContacts({
      directory,
      partnerOptions: [
        { address: ghost, label: ghost, unreadCount: 2 },
        { address: alice, label: 'Alice', unreadCount: 1 },
      ],
      favorites: new Set(),
      lastContacted: {},
      hidden: new Set(),
      sendPath: 'internet',
    })
    expect(items.map((i) => i.address)).toEqual([alice, bob])
    expect(items.find((i) => i.address === alice)?.unreadCount).toBe(1)
    expect(items.find((i) => i.address === ghost)).toBeUndefined()
  })

  it('blendet Platzhalter-Adresse 0x00…00 aus', () => {
    const directory = {
      [alice]: { label: 'Alice' },
      [ZERO_IOTA_ADDRESS]: { label: 'Null' },
    }
    const items = buildConversationSidebarContacts({
      directory,
      partnerOptions: [{ address: ZERO_IOTA_ADDRESS, label: 'Null', unreadCount: 3 }],
      favorites: new Set(),
      lastContacted: {},
      hidden: new Set(),
    })
    expect(items.map((i) => i.address)).toEqual([alice])
  })
})
