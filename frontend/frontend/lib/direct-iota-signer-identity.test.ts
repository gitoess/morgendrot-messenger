import { describe, expect, it } from 'vitest'
import { directIotaSignerMatchesIdentity } from '@/frontend/lib/direct-iota-signer-identity'

describe('directIotaSignerMatchesIdentity', () => {
  const full = '0x' + 'ab'.repeat(32)

  it('leerer identity → fail-closed', () => {
    expect(directIotaSignerMatchesIdentity(full, '')).toBe(false)
    expect(directIotaSignerMatchesIdentity('', full)).toBe(false)
  })

  it('volle Adresse (case-insensitive)', () => {
    expect(directIotaSignerMatchesIdentity(full, full.toUpperCase())).toBe(true)
  })

  it('maskierte MY_ADDRESS aus UI', () => {
    const masked = `${full.slice(0, 10)}…${full.slice(-6)}`
    expect(directIotaSignerMatchesIdentity(full, masked)).toBe(true)
  })

  it('falsche Adresse', () => {
    const other = '0x' + 'cd'.repeat(32)
    expect(directIotaSignerMatchesIdentity(full, other)).toBe(false)
  })
})
