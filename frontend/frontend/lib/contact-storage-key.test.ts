import { describe, expect, it } from 'vitest'
import {
  contactFormWalletFromStorageKey,
  isTelegramDirectoryKey,
  resolveContactStorageKey,
} from '@/frontend/lib/contact-storage-key'

describe('contact-storage-key', () => {
  it('maps tg directory key to empty wallet form field', () => {
    expect(contactFormWalletFromStorageKey('tg:1156058618')).toBe('')
    expect(isTelegramDirectoryKey('tg:1156058618')).toBe(true)
  })

  it('keeps 0x wallet in form field', () => {
    const w = '0x' + 'a'.repeat(64)
    expect(contactFormWalletFromStorageKey(w)).toBe(w.toLowerCase())
  })

  it('resolves storage from telegram when wallet empty', () => {
    expect(resolveContactStorageKey('', '1156058618')).toBe('tg:1156058618')
  })
})
