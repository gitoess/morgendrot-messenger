import { describe, expect, it } from 'vitest'
import {
  describeMissingComposerIotaRecipient,
  isComposerIotaBroadcast,
  looksLikeTruncatedIotaAddress,
  parseComposerIotaRecipientAddresses,
  resolveComposerIotaAddress,
} from '@/frontend/lib/composer-recipient-fields'

const a = '0x' + 'a'.repeat(64)
const b = '0x' + 'b'.repeat(64)
const c = '0x' + 'c'.repeat(64)

describe('parseComposerIotaRecipientAddresses', () => {
  it('parst Komma-Liste für „Alle“', () => {
    expect(parseComposerIotaRecipientAddresses(`${a}, ${b}`, c, false)).toEqual([a, b])
    expect(isComposerIotaBroadcast(`${a}, ${b}`, c, false)).toBe(true)
  })

  it('liefert eine Adresse für 1:1 verschlüsselt', () => {
    expect(parseComposerIotaRecipientAddresses('', a, true)).toEqual([a])
    expect(resolveComposerIotaAddress('', a, true)).toBe(a)
  })
})

describe('looksLikeTruncatedIotaAddress / describeMissingComposerIotaRecipient', () => {
  it('erkennt UI-Kurzform', () => {
    expect(looksLikeTruncatedIotaAddress('0x7988…adb3')).toBe(true)
    expect(looksLikeTruncatedIotaAddress('0x7988...adb3')).toBe(true)
    expect(looksLikeTruncatedIotaAddress(a)).toBe(false)
  })

  it('Hinweis bei Kurzform / fehlender Adresse', () => {
    const trunc = describeMissingComposerIotaRecipient({
      recipient: '0x7988…adb3',
      partner: '',
      encrypted: false,
    })
    expect(trunc).toMatch(/Kurzadresse|64 Hex/i)
    expect(
      describeMissingComposerIotaRecipient({ recipient: a, partner: '', encrypted: true })
    ).toBeNull()
  })
})
