import { describe, expect, it } from 'vitest'
import { inboxTransportIconKey, messengerTransportMeta } from '@/frontend/lib/messenger-send-path-icons'

describe('messenger-send-path-icons', () => {
  it('Sendepfad internet heißt Alle', () => {
    expect(messengerTransportMeta('internet').label).toBe('Alle')
  })

  it('Inbox: Mailbox/Internet → IOTA, nicht Online-Globe', () => {
    expect(inboxTransportIconKey('internet', 'mailbox')).toBe('iota')
    expect(inboxTransportIconKey('internet')).toBe('iota')
    expect(inboxTransportIconKey('mesh')).toBe('mesh')
    expect(inboxTransportIconKey('telegram')).toBe('telegram')
  })
})
