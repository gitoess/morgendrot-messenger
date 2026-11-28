import { describe, expect, it } from 'vitest'
import {
  AVATAR_SLOT_INBOX_ALL,
  AVATAR_SLOT_TG_ALARM,
  avatarKeyForGroup,
  isWalletAvatarKey,
  normalizeAvatarKey,
} from '@/frontend/lib/contact-avatar-local-store'

describe('contact-avatar-local-store keys', () => {
  it('normalisiert Wallet-Adressen', () => {
    const a = '0x' + 'Ab'.repeat(32)
    expect(normalizeAvatarKey(a)).toBe(a.toLowerCase())
    expect(isWalletAvatarKey(a)).toBe(true)
  })

  it('akzeptiert feste Sidebar-Slots', () => {
    expect(normalizeAvatarKey(AVATAR_SLOT_INBOX_ALL)).toBe('slot:inbox-all')
    expect(normalizeAvatarKey(AVATAR_SLOT_TG_ALARM)).toBe('slot:tg-alarm')
    expect(isWalletAvatarKey(AVATAR_SLOT_INBOX_ALL)).toBe(false)
  })

  it('group:-Keys', () => {
    expect(avatarKeyForGroup('test-iota')).toBe('group:test-iota')
    expect(normalizeAvatarKey('group:Test.Iota_1')).toBe('group:test.iota_1')
  })

  it('lehnt Unsinn ab', () => {
    expect(normalizeAvatarKey('')).toBeNull()
    expect(normalizeAvatarKey('slot:')).toBeNull()
    expect(normalizeAvatarKey('http://evil')).toBeNull()
    expect(normalizeAvatarKey('0x123')).toBeNull()
  })
})
