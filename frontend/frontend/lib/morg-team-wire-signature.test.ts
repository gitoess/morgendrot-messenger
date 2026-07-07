import { describe, expect, it } from 'vitest'
import { Ed25519Keypair } from '@iota/iota-sdk/keypairs/ed25519'
import {
  buildTeamWireSignBytes,
  stableTeamWireJsonStringify,
  verifyTeamWireSignature,
} from '@morgendrot/shared/morg-team-wire-signature'

describe('morg-team-wire-signature', () => {
  it('stableTeamWireJsonStringify sortiert Keys rekursiv', () => {
    expect(stableTeamWireJsonStringify({ b: 1, a: { z: 2, y: 1 } })).toBe(
      '{"a":{"y":1,"z":2},"b":1}'
    )
  })

  it('signPersonalMessage roundtrip für Team-Update-Payload', async () => {
    const kp = new Ed25519Keypair()
    const boss = kp.getPublicKey().toIotaAddress()
    const payload = {
      v: 1,
      kind: 'add',
      seq: 3,
      teamId: 'alpha',
      boss,
      issuedAt: 1_700_000_000_000,
      member: { address: `0x${'c'.repeat(64)}`, name: 'Helfer' },
    }
    const bytes = buildTeamWireSignBytes(payload)
    const sig = (await kp.signPersonalMessage(bytes)).signature
    expect(sig).toBeTruthy()
    const verified = await verifyTeamWireSignature({ ...payload, sig: sig! })
    expect(verified).toEqual({ ok: true })
  })

  it('lehnt falsche Boss-Adresse ab', async () => {
    const kp = new Ed25519Keypair()
    const payload = {
      v: 1,
      kind: 'add',
      seq: 1,
      teamId: 'alpha',
      boss: `0x${'b'.repeat(64)}`,
      issuedAt: 1,
      member: { address: `0x${'c'.repeat(64)}`, name: 'X' },
    }
    const sig = (await kp.signPersonalMessage(buildTeamWireSignBytes(payload))).signature
    const verified = await verifyTeamWireSignature({ ...payload, sig: sig! })
    expect(verified.ok).toBe(false)
    if (!verified.ok) expect(verified.reason).toBe('boss-mismatch')
  })
})
