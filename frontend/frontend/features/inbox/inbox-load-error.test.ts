import { describe, it, expect } from 'vitest'
import {
  USER_MSG_FETCH_NETWORK_OFFLINE,
  USER_MSG_FETCH_TIMEOUT,
} from '@/frontend/lib/api-fetch-text'
import {
  formatInboxLoadError,
  INBOX_BASIS_OFFLINE_HEADLINE,
  isInboxLoadErrorLikelyUnreachable,
} from './inbox-load-error'

describe('isInboxLoadErrorLikelyUnreachable', () => {
  it('erkennt typische Netzwerk-/Fetch-Texte', () => {
    expect(isInboxLoadErrorLikelyUnreachable('failed to fetch')).toBe(true)
    expect(isInboxLoadErrorLikelyUnreachable('Backend nicht erreichbar')).toBe(true)
    expect(isInboxLoadErrorLikelyUnreachable(USER_MSG_FETCH_NETWORK_OFFLINE)).toBe(true)
    expect(isInboxLoadErrorLikelyUnreachable(USER_MSG_FETCH_TIMEOUT)).toBe(true)
    expect(isInboxLoadErrorLikelyUnreachable('Connection refused')).toBe(true)
    expect(isInboxLoadErrorLikelyUnreachable('AbortError: user aborted')).toBe(true)
    expect(isInboxLoadErrorLikelyUnreachable('Zeitüberschreitung beim Laden')).toBe(true)
    expect(isInboxLoadErrorLikelyUnreachable('ECONNREFUSED')).toBe(true)
  })

  it('normale Fehlermeldungen bleiben „erreichbar“', () => {
    expect(isInboxLoadErrorLikelyUnreachable('Ungültige Signatur')).toBe(false)
    expect(isInboxLoadErrorLikelyUnreachable('')).toBe(false)
  })
})

describe('formatInboxLoadError', () => {
  it('nutzt Basis-Headline bei vermutlich offline', () => {
    const r = formatInboxLoadError('failed to fetch')
    expect(r.headline).toBe(INBOX_BASIS_OFFLINE_HEADLINE)
    expect(r.detail).toBe('failed to fetch')
  })

  it('generische Headline sonst', () => {
    const r = formatInboxLoadError('Mailbox parse error')
    expect(r.headline).toBe('Fehler beim Laden')
    expect(r.detail).toBe('Mailbox parse error')
  })
})
