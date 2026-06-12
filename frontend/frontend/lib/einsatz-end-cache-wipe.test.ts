import { describe, expect, it, beforeEach } from 'vitest'
import {
  EINSATZ_END_LOCAL_STORAGE_KEYS,
  INBOX_CACHE_KEY_PREFIX,
  performEinsatzEndCacheWipeSync,
  wipeAllInboxCacheKeys,
} from './einsatz-end-cache-wipe'
import { API_STATUS_CACHE_KEY } from './api/status'

describe('einsatz-end-cache-wipe (H.32b)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('entfernt Inbox-Cache-Präfixe', () => {
    window.localStorage.setItem(`${INBOX_CACHE_KEY_PREFIX}pkg:mb`, '{"savedAtMs":1}')
    window.localStorage.setItem('morgendrot.keep.me', '1')
    expect(wipeAllInboxCacheKeys()).toBe(1)
    expect(window.localStorage.getItem(`${INBOX_CACHE_KEY_PREFIX}pkg:mb`)).toBeNull()
    expect(window.localStorage.getItem('morgendrot.keep.me')).toBe('1')
  })

  it('performEinsatzEndCacheWipeSync leert Allowlist', () => {
    window.localStorage.setItem(`${INBOX_CACHE_KEY_PREFIX}a:b`, '{}')
    window.localStorage.setItem('morgendrot.directChain.packageId', '0x' + 'a'.repeat(64))
    window.localStorage.setItem(API_STATUS_CACHE_KEY, '{}')
    window.localStorage.setItem('morgendrot.handoff.localApplied.v1', '{}')
    window.localStorage.setItem('morgendrot.einsatz.manifestLastSequence.v1', '3')
    for (const k of EINSATZ_END_LOCAL_STORAGE_KEYS) {
      window.localStorage.setItem(k, '[]')
    }
    window.sessionStorage.setItem('morg.pinnwand.pinned.ids.v1', '[]')

    const r = performEinsatzEndCacheWipeSync()
    expect(r.removedLocalStorageKeys).toBeGreaterThan(0)
    expect(window.localStorage.getItem(API_STATUS_CACHE_KEY)).toBeNull()
    expect(window.localStorage.getItem('morgendrot.directChain.packageId')).toBeNull()
    expect(window.localStorage.getItem('morgendrot.handoff.localApplied.v1')).toBeNull()
    expect(window.localStorage.getItem('morgendrot.einsatz.manifestLastSequence.v1')).toBeNull()
    expect(window.sessionStorage.getItem('morg.pinnwand.pinned.ids.v1')).toBeNull()
  })
})
