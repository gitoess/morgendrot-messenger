import { describe, it, expect } from 'vitest'
import { formatFetchFailureMessage, joinApiUrl } from './api-fetch-text'

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
    expect(formatFetchFailureMessage(e)).toBe('Zeitüberschreitung (Timeout).')
  })
  it('erkennt typische Offline-Meldung', () => {
    const s = formatFetchFailureMessage(new Error('Failed to fetch'))
    expect(s).toContain('Backend nicht erreichbar')
  })
  it('lässt andere Meldungen durch', () => {
    expect(formatFetchFailureMessage(new Error('parse error'))).toBe('parse error')
  })
})
