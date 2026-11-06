import { describe, expect, it } from 'vitest'
import {
  createDhRatchetSessionPair,
  createRatchetSessionPair,
} from '@morgendrot/shared/morgendrot-ratchet-session'

const ALICE = `0x${'aa'.repeat(32)}`
const BOB = `0x${'bb'.repeat(32)}`

describe('morgendrot-ratchet-session C1.2a', () => {
  it('Alice→Bob und Bob→Alice Klartext roundtrip', async () => {
    const shared = crypto.getRandomValues(new Uint8Array(32))
    const { alice, bob } = await createRatchetSessionPair(shared, ALICE, BOB)

    const p1 = await alice.encrypt('hallo bob', 'm1')
    expect(await bob.decrypt(p1)).toBe('hallo bob')

    const p2 = await bob.encrypt('hi alice', 'm2')
    expect(await alice.decrypt(p2)).toBe('hi alice')
  })

  it('Out-of-order: n=2 vor n=0/1', async () => {
    const shared = crypto.getRandomValues(new Uint8Array(32))
    const { alice, bob } = await createRatchetSessionPair(shared, ALICE, BOB)
    const a = await alice.encrypt('a0', '0')
    const b = await alice.encrypt('a1', '1')
    const c = await alice.encrypt('a2', '2')
    expect(await bob.decrypt(c)).toBe('a2')
    expect(await bob.decrypt(a)).toBe('a0')
    expect(await bob.decrypt(b)).toBe('a1')
  })

  it('verbrauchter Message-Key entschlüsselt nicht erneut', async () => {
    const shared = crypto.getRandomValues(new Uint8Array(32))
    const { alice, bob } = await createRatchetSessionPair(shared, ALICE, BOB)
    const p = await alice.encrypt('once', 'x')
    expect(await bob.decrypt(p)).toBe('once')
    await expect(bob.decrypt(p)).rejects.toThrow(/alt|verbrauch/)
  })
})

describe('morgendrot-ratchet-session C1.2b DH', () => {
  it('DH-Header ist echtes SPKI (nicht Placeholder)', async () => {
    const shared = crypto.getRandomValues(new Uint8Array(32))
    const { alice, bob } = await createDhRatchetSessionPair(shared, ALICE, BOB)
    const p = await alice.encrypt('dh1', 'd1')
    expect(p.header.dh.length).toBeGreaterThan(40)
    expect(p.header.dh).not.toMatch(/placeholder|cG9jLW/)
    expect(await bob.decrypt(p)).toBe('dh1')
  })

  it('Ping-Pong mit DH-Ratchet', async () => {
    const shared = crypto.getRandomValues(new Uint8Array(32))
    const { alice, bob } = await createDhRatchetSessionPair(shared, ALICE, BOB)
    const a1 = await alice.encrypt('ping', '1')
    expect(await bob.decrypt(a1)).toBe('ping')
    const b1 = await bob.encrypt('pong', '2')
    expect(await alice.decrypt(b1)).toBe('pong')
    const a2 = await alice.encrypt('again', '3')
    expect(await bob.decrypt(a2)).toBe('again')
  })
})
