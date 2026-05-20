import { describe, expect, it } from 'vitest'
import { buildApiCommandPostBody } from '@/frontend/lib/api/execute-command'

describe('buildApiCommandPostBody', () => {
  it('setzt cmd und args', () => {
    expect(buildApiCommandPostBody('/send-plain', ['0x' + 'a'.repeat(64), 'hi'])).toEqual({
      cmd: '/send-plain',
      args: ['0x' + 'a'.repeat(64), 'hi'],
    })
  })
  it('fügt messagingPersistenceMode mailbox hinzu', () => {
    const b = buildApiCommandPostBody('/send-plain', ['0x' + 'b'.repeat(64), 'x'], {
      messagingPersistenceMode: 'mailbox',
    })
    expect(b.messagingPersistenceMode).toBe('mailbox')
  })
  it('serialisiert event explizit wenn gesetzt', () => {
    const b = buildApiCommandPostBody('/send-plain', ['0x' + 'c'.repeat(64), 'y'], {
      messagingPersistenceMode: 'event',
    })
    expect(b.messagingPersistenceMode).toBe('event')
  })
  it('ohne Persistenz-Option kein Feld', () => {
    const b = buildApiCommandPostBody('/send-plain', ['0x' + 'd'.repeat(64), 'z'])
    expect('messagingPersistenceMode' in b).toBe(false)
  })
  it('serialisiert mailboxObjectId für private Kontakt-Mailbox', () => {
    const mb = '0x' + 'e'.repeat(64)
    const b = buildApiCommandPostBody('/inbox', ['50'], { mailboxObjectId: mb })
    expect(b.mailboxObjectId).toBe(mb)
  })
})
