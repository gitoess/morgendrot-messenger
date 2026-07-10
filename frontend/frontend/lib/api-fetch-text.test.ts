import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  fetchApiText,
  formatFetchFailureMessage,
  joinApiUrl,
  USER_MSG_FETCH_NETWORK_OFFLINE,
  USER_MSG_FETCH_TIMEOUT,
  userMessageIndicatesFetchNetworkFailure,
} from './api-fetch-text'

describe('fetchApiText LAN auth', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('setzt API-Token-Header bei POST', async () => {
    const store: Record<string, string> = { 'morgendrot.apiAuthToken.v1': 'handoff-lan-token' }
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
    } as Storage)
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await fetchApiText('http://127.0.0.1:3342', '/api/unlock', {
      method: 'POST',
      body: '{}',
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const headers = new Headers(init.headers)
    expect(headers.get('X-Morgendrot-Api-Token')).toBe('handoff-lan-token')
  })
})

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
