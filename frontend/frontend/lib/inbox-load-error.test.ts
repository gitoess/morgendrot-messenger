import { describe, expect, it } from 'vitest'
import { USER_MSG_FETCH_NETWORK_OFFLINE, USER_MSG_FETCH_TIMEOUT } from './api-fetch-text'
import {
  formatInboxLoadError,
  INBOX_BASIS_OFFLINE_HEADLINE,
  isInboxLoadErrorLikelyUnreachable,
} from './inbox-load-error'

describe('inbox-load-error', () => {
  it('isInboxLoadErrorLikelyUnreachable: Timeout-Konstante', () => {
    expect(isInboxLoadErrorLikelyUnreachable(USER_MSG_FETCH_TIMEOUT)).toBe(true)
  })

  it('isInboxLoadErrorLikelyUnreachable: kanonische Fetch-Netzmeldung', () => {
    expect(isInboxLoadErrorLikelyUnreachable(USER_MSG_FETCH_NETWORK_OFFLINE)).toBe(true)
  })

  it('isInboxLoadErrorLikelyUnreachable: Heuristik-Treffer', () => {
    expect(isInboxLoadErrorLikelyUnreachable('failed to fetch')).toBe(true)
    expect(isInboxLoadErrorLikelyUnreachable('Connection refused')).toBe(true)
    expect(isInboxLoadErrorLikelyUnreachable('Something ECONNREFUSED happened')).toBe(true)
  })

  it('isInboxLoadErrorLikelyUnreachable: sonst false', () => {
    expect(isInboxLoadErrorLikelyUnreachable('MoveAbort')).toBe(false)
    expect(isInboxLoadErrorLikelyUnreachable('')).toBe(false)
  })

  it('formatInboxLoadError: offline → Funk-Modus-Headline', () => {
    const r = formatInboxLoadError(USER_MSG_FETCH_TIMEOUT)
    expect(r.headline).toBe(INBOX_BASIS_OFFLINE_HEADLINE)
    expect(r.detail).toBe(USER_MSG_FETCH_TIMEOUT)
  })

  it('formatInboxLoadError: sonst generischer Kopf', () => {
    const r = formatInboxLoadError('Unerwarteter Fehler')
    expect(r.headline).toBe('Fehler beim Laden')
    expect(r.detail).toBe('Unerwarteter Fehler')
  })
})
