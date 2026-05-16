import { describe, expect, it } from 'vitest'
import {
  describeChainPersistenceRoute,
  normalizeMessagingPersistenceMode,
} from '@/frontend/lib/messaging-persistence-mode'

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

describe('describeChainPersistenceRoute', () => {
  it('trennt Verschlüsselung und Persistenz', () => {
    expect(describeChainPersistenceRoute(true, 'event').label).toContain('Event')
    expect(describeChainPersistenceRoute(true, 'mailbox').label).toContain('Mailbox')
    expect(describeChainPersistenceRoute(false, 'event').label).toContain('Klartext')
  })
})
