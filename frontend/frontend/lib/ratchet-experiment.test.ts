import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRatchetSessionPair } from '@morgendrot/shared/morgendrot-ratchet-session'
import {
  decodeRatchetPacketWire,
  encodeRatchetPacketWire,
  ensureRatchetSessionForPeer,
  ratchetExperimentDecrypt,
  ratchetExperimentEncrypt,
  readRatchetExperimentEnabled,
  tryRatchetExperimentUnwrapIncoming,
  tryRatchetExperimentWrapOutgoing,
  writeRatchetExperimentEnabled,
} from '@/frontend/lib/ratchet-experiment'
import {
  getRatchetSessionForPeer,
  purgeRatchetSessionVault,
  putRatchetSessionForPeer,
} from '@/frontend/lib/ratchet-session-local-store'
import { clearVaultPasswordSession, setVaultPasswordSession } from '@/frontend/lib/vault-password-session'

const ALICE = `0x${'aa'.repeat(32)}`
const BOB = `0x${'bb'.repeat(32)}`

vi.mock('@/frontend/lib/direct-iota-mnemonic-session', () => ({
  getDirectIotaSessionSignerAddress: () => ALICE,
}))

describe('ratchet-experiment C1.5', () => {
  afterEach(() => {
    writeRatchetExperimentEnabled(false)
    purgeRatchetSessionVault()
    clearVaultPasswordSession()
    window.localStorage.clear()
  })

  it('Flag default aus; Encrypt ohne Flag fehlschlägt', async () => {
    expect(readRatchetExperimentEnabled()).toBe(false)
    const r = await ratchetExperimentEncrypt({
      peerAddress: BOB,
      plaintext: 'x',
      msgId: 'm1',
    })
    expect(r.ok).toBe(false)
  })

  it('Encrypt/Decrypt Roundtrip mit Flag + Session', async () => {
    writeRatchetExperimentEnabled(true)
    setVaultPasswordSession('vault-pass-99')
    const shared = crypto.getRandomValues(new Uint8Array(32))
    const { alice, bob } = await createRatchetSessionPair(shared, ALICE, BOB)
    putRatchetSessionForPeer(BOB, alice)

    const enc = await ratchetExperimentEncrypt({
      peerAddress: BOB,
      plaintext: 'ratchet hello',
      msgId: 'm1',
    })
    expect(enc.ok).toBe(true)
    if (!enc.ok) return

    const wire = encodeRatchetPacketWire(enc.packet)
    expect(wire).toContain('RATCHET_V3')
    const decoded = decodeRatchetPacketWire(wire)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return

    // Bob hält Session unter Alice-Adresse
    putRatchetSessionForPeer(ALICE, bob)
    const dec = await ratchetExperimentDecrypt({
      peerAddress: ALICE,
      packet: decoded.packet,
    })
    expect(dec.ok).toBe(true)
    if (dec.ok) expect(dec.plaintext).toBe('ratchet hello')

    // State nach Encrypt persistiert (n erhöht)
    expect(getRatchetSessionForPeer(BOB)).not.toBeNull()
  })

  it('ensureRatchetSessionForPeer legt Alice-Session an wenn Flag an', async () => {
    writeRatchetExperimentEnabled(true)
    const shared = crypto.getRandomValues(new Uint8Array(32))
    const r = await ensureRatchetSessionForPeer({ peerAddress: BOB, ecdhShared: shared })
    expect(r.ok).toBe(true)
    expect(getRatchetSessionForPeer(BOB)).not.toBeNull()
  })

  it('tryWrap/tryUnwrap: null ohne Flag; Roundtrip mit Flag', async () => {
    expect(await tryRatchetExperimentWrapOutgoing({ peerAddress: BOB, plaintext: 'a', msgId: 'm' })).toBeNull()

    writeRatchetExperimentEnabled(true)
    setVaultPasswordSession('vault-pass-99')
    const shared = crypto.getRandomValues(new Uint8Array(32))
    const { alice, bob } = await createRatchetSessionPair(shared, ALICE, BOB)
    putRatchetSessionForPeer(BOB, alice)
    putRatchetSessionForPeer(ALICE, bob)

    const wrapped = await tryRatchetExperimentWrapOutgoing({
      peerAddress: BOB,
      plaintext: 'hook ok',
      msgId: 'm2',
    })
    expect(wrapped).not.toBeNull()
    const unwrapped = await tryRatchetExperimentUnwrapIncoming({
      peerAddress: ALICE,
      raw: wrapped!.wire,
    })
    expect(unwrapped?.plaintext).toBe('hook ok')
  })
})
