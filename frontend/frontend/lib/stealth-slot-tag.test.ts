import { describe, it, expect } from 'vitest'
import { blake2b } from '@noble/hashes/blake2b'
import {
  STEALTH_BUCKET_ENTRY_CAP,
  STEALTH_DELETE_DOMAIN,
  STEALTH_SLOT_DOMAIN,
  deriveStealthDeleteCommit,
  deriveStealthDeleteCommitHex,
  deriveStealthDeleteSecret,
  deriveStealthSlotTag,
  deriveStealthSlotTagHex,
  encodeEpochU64Be,
  lookaheadStealthEpochs,
  stealthEpochHourUtc,
  stealthSlotTagToHex,
} from '@/frontend/lib/stealth-slot-tag'

describe('stealth-slot-tag', () => {
  const secret = new Uint8Array(32).fill(0xab)

  it('encodeEpochU64Be ist 8 Byte big-endian', () => {
    expect([...encodeEpochU64Be(0)]).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
    expect([...encodeEpochU64Be(1)]).toEqual([0, 0, 0, 0, 0, 0, 0, 1])
    expect([...encodeEpochU64Be(0x0102)]).toEqual([0, 0, 0, 0, 0, 0, 1, 2])
    expect([...encodeEpochU64Be(0x100000000n)]).toEqual([0, 0, 0, 1, 0, 0, 0, 0])
  })

  it('deriveStealthSlotTag = Blake2b256(secret||slot||epoch) und 32 Byte', () => {
    const epoch = 42n
    const tag = deriveStealthSlotTag(secret, epoch)
    expect(tag).toHaveLength(32)

    const te = new TextEncoder()
    const msg = new Uint8Array(secret.length + STEALTH_SLOT_DOMAIN.length + 8)
    msg.set(secret, 0)
    msg.set(te.encode(STEALTH_SLOT_DOMAIN), secret.length)
    msg.set(encodeEpochU64Be(epoch), secret.length + STEALTH_SLOT_DOMAIN.length)
    expect(stealthSlotTagToHex(tag)).toBe(stealthSlotTagToHex(blake2b(msg, { dkLen: 32 })))
  })

  it('gleiche Inputs → gleicher Tag (Bucket); andere Epoch → anderer Tag', () => {
    const a = deriveStealthSlotTagHex(secret, 100)
    const b = deriveStealthSlotTagHex(secret, 100)
    const c = deriveStealthSlotTagHex(secret, 101)
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('anderer SharedSecret → anderer Tag', () => {
    const other = new Uint8Array(32).fill(0xcd)
    expect(deriveStealthSlotTagHex(secret, 7)).not.toBe(deriveStealthSlotTagHex(other, 7))
  })

  it('stealthEpochHourUtc floor(ms/3600000)', () => {
    expect(stealthEpochHourUtc(0)).toBe(0n)
    expect(stealthEpochHourUtc(3_599_999)).toBe(0n)
    expect(stealthEpochHourUtc(3_600_000)).toBe(1n)
  })

  it('lookaheadStealthEpochs ±W', () => {
    expect(lookaheadStealthEpochs(10n, 0)).toEqual([10n])
    expect(lookaheadStealthEpochs(10, 2)).toEqual([8n, 9n, 10n, 11n, 12n])
  })

  it('Bucket-Cap-Konstante laut Spec', () => {
    expect(STEALTH_BUCKET_ENTRY_CAP).toBe(32)
  })

  it('deriveStealthDeleteCommit = Blake2b256(secret||slot_tag)', () => {
    const tag = deriveStealthSlotTag(secret, 1)
    const del = new TextEncoder().encode('stealth-delete-secret-bytes!!')
    const commit = deriveStealthDeleteCommit(del, tag)
    expect(commit).toHaveLength(32)
    const msg = new Uint8Array(del.length + tag.length)
    msg.set(del, 0)
    msg.set(tag, del.length)
    expect(stealthSlotTagToHex(commit)).toBe(stealthSlotTagToHex(blake2b(msg, { dkLen: 32 })))
    expect(deriveStealthDeleteCommitHex(del, tag)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('deriveStealthDeleteSecret = Blake2b256(shared||delete)', () => {
    const del = deriveStealthDeleteSecret(secret)
    expect(del).toHaveLength(32)
    const te = new TextEncoder()
    const msg = new Uint8Array(secret.length + STEALTH_DELETE_DOMAIN.length)
    msg.set(secret, 0)
    msg.set(te.encode(STEALTH_DELETE_DOMAIN), secret.length)
    expect(stealthSlotTagToHex(del)).toBe(stealthSlotTagToHex(blake2b(msg, { dkLen: 32 })))
    expect(stealthSlotTagToHex(del)).not.toBe(deriveStealthSlotTagHex(secret, 0))
  })
})
