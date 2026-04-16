import { describe, expect, it } from 'vitest'
import { normalizeMessagingPersistenceMode } from '@/frontend/lib/messaging-persistence-mode'

describe('normalizeMessagingPersistenceMode', () => {
  it('mappt mailbox', () => {
    expect(normalizeMessagingPersistenceMode('mailbox')).toBe('mailbox')
    expect(normalizeMessagingPersistenceMode('MAILBOX')).toBe('mailbox')
  })
  it('defaultet auf event', () => {
    expect(normalizeMessagingPersistenceMode(undefined)).toBe('event')
    expect(normalizeMessagingPersistenceMode('')).toBe('event')
    expect(normalizeMessagingPersistenceMode('x')).toBe('event')
  })
})
