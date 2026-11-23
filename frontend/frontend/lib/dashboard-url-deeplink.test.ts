import { describe, expect, it } from 'vitest'
import {
  parseDashboardUrlDeeplink,
  stripDashboardUrlDeeplinkSearch,
} from '@/frontend/lib/dashboard-url-deeplink'

describe('dashboard-url-deeplink', () => {
  it('erkennt Chat-Shortcuts', () => {
    expect(parseDashboardUrlDeeplink('?t=inbox-messages')).toBe('chat')
    expect(parseDashboardUrlDeeplink('view=messages')).toBe('chat')
    expect(parseDashboardUrlDeeplink('?t=posteingang')).toBe('chat')
    expect(parseDashboardUrlDeeplink('?t=other')).toBeNull()
    expect(parseDashboardUrlDeeplink('')).toBeNull()
  })

  it('strippt nur Deeplink-Keys', () => {
    expect(stripDashboardUrlDeeplinkSearch('?t=inbox-messages')).toBe('')
    expect(stripDashboardUrlDeeplinkSearch('?t=chat&foo=1')).toBe('?foo=1')
    expect(stripDashboardUrlDeeplinkSearch('?view=messages')).toBe('')
  })
})
