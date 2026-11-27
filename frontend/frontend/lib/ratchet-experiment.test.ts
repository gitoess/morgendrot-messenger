import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRatchetSessionPair } from '@morgendrot/shared/morgendrot-ratchet-session'
import {
  decodeRatchetPacketWire,
  encodeRatchetPacketWire,
  ensureRatchetSessionForPeer,
  looksLikeRatchetV3Wire,
  lookupRatchetOutgoingPlaintext,
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
  removeRatchetSessionForPeer,
} from '@/frontend/lib/ratchet-session-local-store'
import { clearVaultPasswordSession, setVaultPasswordSession } from '@/frontend/lib/vault-password-session'

const ALICE = `0x${'aa'.repeat(32)}`
const BOB = `0x${'bb'.repeat(32)}`

const signerAddress = vi.hoisted(() => ({
  current: `0x${'aa'.repeat(32)}` as string | null,
}))

vi.mock('@/frontend/lib/direct-iota-mnemonic-session', () => ({
  getDirectIotaSessionSignerAddress: () => signerAddress.current,
}))

describe('ratchet-experiment C1.5/C1.6', () => {
  afterEach(() => {
    writeRatchetExperimentEnabled(false)
    purgeRatchetSessionVault()
    clearVaultPasswordSession()
    window.localStorage.clear()
    signerAddress.current = ALICE
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

  it('looksLikeRatchetV3Wire erkennt Wire', async () => {
    writeRatchetExperimentEnabled(true)
    setVaultPasswordSession('vault-pass-99')
    const shared = crypto.getRandomValues(new Uint8Array(32))
    const { alice } = await createRatchetSessionPair(shared, ALICE, BOB)
    putRatchetSessionForPeer(BOB, alice)
    const enc = await ratchetExperimentEncrypt({
      peerAddress: BOB,
      plaintext: 'x',
      msgId: 'm1',
    })
    expect(enc.ok).toBe(true)
    if (!enc.ok) return
    const wire = encodeRatchetPacketWire(enc.packet)
    expect(looksLikeRatchetV3Wire(wire)).toBe(true)
    expect(looksLikeRatchetV3Wire('hallo')).toBe(false)
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

    putRatchetSessionForPeer(ALICE, bob)
    const dec = await ratchetExperimentDecrypt({
      peerAddress: ALICE,
      packet: decoded.packet,
    })
    expect(dec.ok).toBe(true)
    if (dec.ok) expect(dec.plaintext).toBe('ratchet hello')
    expect(lookupRatchetOutgoingPlaintext(BOB, 'm1')).toBe('ratchet hello')
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

  it('A→B: divergente Empfänger-Session → forceNew Resync entschlüsselt', async () => {
    writeRatchetExperimentEnabled(true)
    setVaultPasswordSession('vault-pass-99')
    const shared = crypto.getRandomValues(new Uint8Array(32))

    signerAddress.current = ALICE
    await ensureRatchetSessionForPeer({ peerAddress: BOB, ecdhShared: shared, localAddress: ALICE })
    const wrapped = await tryRatchetExperimentWrapOutgoing({
      peerAddress: BOB,
      plaintext: 'resync please',
      msgId: 'm9',
    })
    expect(wrapped?.wire).toContain('RATCHET_V3')

    /** Bob hatte vorher eine Session aus anderem Shared → Drift. */
    const wrong = crypto.getRandomValues(new Uint8Array(32))
    signerAddress.current = BOB
    await ensureRatchetSessionForPeer({
      peerAddress: ALICE,
      ecdhShared: wrong,
      localAddress: BOB,
      forceNew: true,
    })
    expect(
      await tryRatchetExperimentUnwrapIncoming({
        peerAddress: ALICE,
        raw: wrapped!.wire,
      })
    ).toBeNull()

    const fixed = await tryRatchetExperimentUnwrapIncoming({
      peerAddress: ALICE,
      raw: wrapped!.wire,
      ecdhShared: shared,
      localAddress: BOB,
    })
    expect(fixed?.plaintext).toBe('resync please')
  })

  it('forceNew ersetzt Session', async () => {
    writeRatchetExperimentEnabled(true)
    const shared = crypto.getRandomValues(new Uint8Array(32))
    await ensureRatchetSessionForPeer({ peerAddress: BOB, ecdhShared: shared, localAddress: ALICE })
    const first = getRatchetSessionForPeer(BOB)
    expect(first).not.toBeNull()
    removeRatchetSessionForPeer(BOB)
    await ensureRatchetSessionForPeer({
      peerAddress: BOB,
      ecdhShared: shared,
      localAddress: ALICE,
      forceNew: true,
    })
    expect(getRatchetSessionForPeer(BOB)).not.toBeNull()
  })

  it('B→A dann A→B: Doppel-Unwrap (Replay) zerstört Session nicht', async () => {
    writeRatchetExperimentEnabled(true)
    setVaultPasswordSession('vault-pass-99')
    const shared = crypto.getRandomValues(new Uint8Array(32))

    signerAddress.current = BOB
    await ensureRatchetSessionForPeer({ peerAddress: ALICE, ecdhShared: shared, localAddress: BOB })
    const bToA = await tryRatchetExperimentWrapOutgoing({
      peerAddress: ALICE,
      plaintext: 'from bob',
      msgId: 'b1',
    })
    expect(bToA?.wire).toContain('RATCHET_V3')

    signerAddress.current = ALICE
    await ensureRatchetSessionForPeer({ peerAddress: BOB, ecdhShared: shared, localAddress: ALICE })
    expect(
      (await tryRatchetExperimentUnwrapIncoming({ peerAddress: BOB, raw: bToA!.wire, ecdhShared: shared, localAddress: ALICE }))
        ?.plaintext
    ).toBe('from bob')
    /** Zweiter Pfad (API+Direct): Replay — kein forceNew-Desync. */
    expect(
      (await tryRatchetExperimentUnwrapIncoming({ peerAddress: BOB, raw: bToA!.wire, ecdhShared: shared, localAddress: ALICE }))
        ?.plaintext
    ).toBe('from bob')

    const aToB = await tryRatchetExperimentWrapOutgoing({
      peerAddress: BOB,
      plaintext: 'from alice',
      msgId: 'a1',
    })
    expect(aToB?.wire).toContain('RATCHET_V3')

    signerAddress.current = BOB
    expect(
      (await tryRatchetExperimentUnwrapIncoming({
        peerAddress: ALICE,
        raw: aToB!.wire,
        ecdhShared: shared,
        localAddress: BOB,
      }))?.plaintext
    ).toBe('from alice')
  })
})
