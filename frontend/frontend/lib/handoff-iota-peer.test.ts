import { describe, expect, it } from 'vitest'
import { isHandoffIotaSelfTarget, resolveHandoffSenderAddress } from './handoff-iota-peer'

const ME = '0x671bf669a858c97a1ca7ed3c5c31901ffb671ceea31e8fd706d0b6e2cb8a15c5'
const OTHER = '0x0748329ee31e531f5f13fa56b8f42f5173f5518c4dc00e9a090132b1d3c495c5'

describe('handoff-iota-peer', () => {
  it('erkennt Selbstversand', () => {
    const status = { myAddressFull: ME, locked: false }
    expect(isHandoffIotaSelfTarget(ME, status)).toBe(true)
    expect(isHandoffIotaSelfTarget(OTHER, status)).toBe(false)
    expect(resolveHandoffSenderAddress(status)).toBe(ME.toLowerCase())
  })
})
