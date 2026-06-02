import { describe, expect, it, beforeEach } from 'vitest'
import {
  normalizeMailboxObjectIdInput,
  readComposerMailboxObjectId,
  writeComposerMailboxObjectId,
} from '@/frontend/lib/composer-mailbox-object-id'

const WALLET = '0x' + 'a'.repeat(64)
const MAILBOX = '0x' + 'b'.repeat(64)

describe('composer-mailbox-object-id', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('leer bleibt leer', () => {
    expect(normalizeMailboxObjectIdInput('')).toBe('')
    writeComposerMailboxObjectId(WALLET, '')
    expect(readComposerMailboxObjectId(WALLET)).toBe('')
  })

  it('speichert pro Wallet', () => {
    writeComposerMailboxObjectId(WALLET, MAILBOX)
    expect(readComposerMailboxObjectId(WALLET)).toBe(MAILBOX)
  })
})
