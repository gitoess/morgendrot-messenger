import { describe, expect, it } from 'vitest'
import {
  buildConversationSidebarContacts,
  buildConversationSidebarPinnwand,
  buildConversationSidebarTelegramAlarm,
} from '@/frontend/lib/conversation-sidebar-items'
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

  it('behält stabile Reihenfolge bei wechselnden Unread-Zahlen', () => {
    const directory = {
      [alice]: { label: 'Alice' },
      [bob]: { label: 'Bob' },
    }
    const first = buildConversationSidebarContacts({
      directory,
      partnerOptions: [
        { address: alice, label: 'Alice', unreadCount: 0 },
        { address: bob, label: 'Bob', unreadCount: 9 },
      ],
      favorites: new Set(),
      lastContacted: {},
      hidden: new Set(),
    })
    const second = buildConversationSidebarContacts({
      directory,
      partnerOptions: [
        { address: alice, label: 'Alice', unreadCount: 12 },
        { address: bob, label: 'Bob', unreadCount: 0 },
      ],
      favorites: new Set(),
      lastContacted: {},
      hidden: new Set(),
    })
    expect(first.map((i) => i.address)).toEqual(second.map((i) => i.address))
    expect(second.find((i) => i.address === bob)?.unreadCount).toBe(0)
    expect(second.find((i) => i.address === alice)?.unreadCount).toBe(12)
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

describe('buildConversationSidebarPinnwand', () => {
  it('liefert Kanal-Eintrag mit Unread', () => {
    const item = buildConversationSidebarPinnwand({ label: 'Lagebild', unreadCount: 2 })
    expect(item.kind).toBe('pinnwand')
    expect(item.displayName).toBe('Lagebild')
    expect(item.unreadCount).toBe(2)
  })
})

describe('buildConversationSidebarTelegramAlarm', () => {
  it('liefert Eintrag bei gespeicherter Mitgliedschaft', () => {
    const item = buildConversationSidebarTelegramAlarm({
      inviteLink: 'https://t.me/+abc',
      label: 'Einsatz TG',
      groupChatId: '-100123',
      confirmedAtMs: 1,
    })
    expect(item?.kind).toBe('telegram-alarm')
    expect(item?.displayName).toBe('Einsatz TG')
    expect(item?.subtitle).toContain('beigetreten')
  })

  it('liefert null ohne Einladungslink', () => {
    expect(buildConversationSidebarTelegramAlarm(null)).toBeNull()
  })
})
