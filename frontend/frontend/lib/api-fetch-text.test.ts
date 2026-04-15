import { describe, it, expect } from 'vitest'
import {
  formatFetchFailureMessage,
  joinApiUrl,
  USER_MSG_FETCH_NETWORK_OFFLINE,
  USER_MSG_FETCH_TIMEOUT,
  userMessageIndicatesFetchNetworkFailure,
} from './api-fetch-text'

describe('joinApiUrl', () => {
  it('hängt Pfad an Basis', () => {
    expect(joinApiUrl('http://127.0.0.1:3342', '/api/status')).toBe('http://127.0.0.1:3342/api/status')
  })
  it('leere Basis → relativer Pfad', () => {
    expect(joinApiUrl('', '/api/status')).toBe('/api/status')
  })
})

describe('formatFetchFailureMessage', () => {
  it('TimeoutError → Timeout-Text', () => {
    const e = new DOMException('The operation timed out.', 'TimeoutError')
    expect(formatFetchFailureMessage(e)).toBe(USER_MSG_FETCH_TIMEOUT)
  })
  it('erkennt typische Offline-Meldung', () => {
    const s = formatFetchFailureMessage(new Error('Failed to fetch'))
    expect(s).toBe(USER_MSG_FETCH_NETWORK_OFFLINE)
    expect(userMessageIndicatesFetchNetworkFailure(s)).toBe(true)
  })
  it('lässt andere Meldungen durch', () => {
    expect(formatFetchFailureMessage(new Error('parse error'))).toBe('parse error')
  })
})

describe('userMessageIndicatesFetchNetworkFailure', () => {
  it('erkennt kanonische Netzwerk-Meldung', () => {
    expect(userMessageIndicatesFetchNetworkFailure(USER_MSG_FETCH_NETWORK_OFFLINE)).toBe(true)
  })

  it('erkennt Präfix in längerem Text', () => {
    expect(
      userMessageIndicatesFetchNetworkFailure(`${USER_MSG_FETCH_NETWORK_OFFLINE} (retry)`)
    ).toBe(true)
  })

  it('kein Treffer bei nur „Backend“', () => {
    expect(userMessageIndicatesFetchNetworkFailure('Backend')).toBe(false)
  })
})
