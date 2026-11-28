import { describe, expect, it } from 'vitest'
import { blake2b } from '@noble/hashes/blake2b'
import {
  deriveStealthLookaheadSlotTags,
  stealthInboxKey,
  STEALTH_LOOKAHEAD_WINDOW_DEFAULT,
} from '@/frontend/lib/stealth-lookahead'
import {
  deriveStealthSlotTag,
  encodeEpochU64Be,
  STEALTH_SLOT_DOMAIN,
  stealthEpochHourUtc,
  stealthSlotTagToHex,
} from '@/frontend/lib/stealth-slot-tag'

describe('stealth-lookahead', () => {
  const secret = new Uint8Array(32).fill(0x42)

  it('Default-Fenster ±2 → 5 Tags', () => {
    expect(STEALTH_LOOKAHEAD_WINDOW_DEFAULT).toBe(2)
    const tags = deriveStealthLookaheadSlotTags(secret, { nowMs: 3_600_000 * 100, windowW: 2 })
    expect(tags).toHaveLength(5)
    const center = stealthEpochHourUtc(3_600_000 * 100)
    expect(stealthSlotTagToHex(tags[2]!)).toBe(stealthSlotTagToHex(deriveStealthSlotTag(secret, center)))
  })

  it('Tags matchen Blake2b-Ableitung', () => {
    const nowMs = 3_600_000 * 50
    const tags = deriveStealthLookaheadSlotTags(secret, { nowMs, windowW: 0 })
    expect(tags).toHaveLength(1)
    const epoch = stealthEpochHourUtc(nowMs)
    const te = new TextEncoder()
    const msg = new Uint8Array(secret.length + STEALTH_SLOT_DOMAIN.length + 8)
    msg.set(secret, 0)
    msg.set(te.encode(STEALTH_SLOT_DOMAIN), secret.length)
    msg.set(encodeEpochU64Be(epoch), secret.length + STEALTH_SLOT_DOMAIN.length)
    expect(stealthSlotTagToHex(tags[0]!)).toBe(stealthSlotTagToHex(blake2b(msg, { dkLen: 32 })))
  })

  it('stealthInboxKey stabil', () => {
    expect(stealthInboxKey('abcd', 3n)).toBe('stealth:abcd:3')
  })
})
