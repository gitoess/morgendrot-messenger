import { describe, expect, it } from 'vitest'
import {
  isComposerIotaBroadcast,
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
