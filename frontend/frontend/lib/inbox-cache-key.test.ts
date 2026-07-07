import { describe, expect, it } from 'vitest'
import {
  buildInboxCacheKey,
  INBOX_CACHE_KEY_PREFIX,
  isInboxCacheStorageKey,
} from '@/frontend/lib/inbox-cache-key'

const BOSS = '0x671bf669a858c97a1ca7ed3c5c31901ffb671ceea31e8fd706d0b6e2cb8a15c5'
const HELPER = '0x8714bf000000000000000000000000000000000000000000000000000000f08a'
const PKG = '0xb58808d193dd06d4e09381ed56d2d06bbe2a1e64c1d94ca97f7df7c5308ea7fe'
const MB = '0x9f288abc3d8c8794dd401d9dfb8393f0b0cba3852580a20e9141741ae0779760'

describe('buildInboxCacheKey', () => {
  it('trennt Boss- und Helfer-Wallet bei gleichem Postfach', () => {
    const base = { packageId: PKG, activeMailboxId: MB }
    const bossKey = buildInboxCacheKey({ ...base, myAddress: BOSS })
    const helperKey = buildInboxCacheKey({ ...base, myAddress: HELPER })
    expect(bossKey).not.toBe(helperKey)
    expect(bossKey).toContain(BOSS)
    expect(helperKey).toContain(HELPER)
  })

  it('nutzt anon ohne gültige Wallet', () => {
    expect(buildInboxCacheKey({ myAddress: '' })).toBe(`${INBOX_CACHE_KEY_PREFIX}__default__:__server__:anon`)
  })

  it('isInboxCacheStorageKey erkennt v1 und v2', () => {
    expect(isInboxCacheStorageKey(`${INBOX_CACHE_KEY_PREFIX}a:b:c`)).toBe(true)
    expect(isInboxCacheStorageKey('morgendrot.inbox.cache.v1:pkg:mb')).toBe(true)
    expect(isInboxCacheStorageKey('morgendrot.other')).toBe(false)
  })
})
