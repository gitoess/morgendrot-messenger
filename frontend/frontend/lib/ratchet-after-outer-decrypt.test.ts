import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  RATCHET_EXPERIMENT_LS_KEY,
  encodeRatchetPacketWire,
  ensureRatchetSessionForPeer,
  tryRatchetExperimentWrapOutgoing,
  writeRatchetExperimentEnabled,
} from '@/frontend/lib/ratchet-experiment'
import {
  resolveRatchetLayerAfterOuterDecrypt,
  unwrapRatchetV3InInboxApiRows,
} from '@/frontend/lib/ratchet-after-outer-decrypt'
import {
  clearOutgoingSendEchoForTests,
  rememberOutgoingSendEcho,
} from '@/frontend/lib/outgoing-send-echo'
import { purgeRatchetSessionVault } from '@/frontend/lib/ratchet-session-local-store'
import { clearVaultPasswordSession, setVaultPasswordSession } from '@/frontend/lib/vault-password-session'
import type { RatchetCipherPacket } from '@morgendrot/shared/morgendrot-ratchet-session'

const ALICE = '0x' + 'a'.repeat(64)
const BOB = '0x' + 'b'.repeat(64)

vi.mock('@/frontend/lib/direct-iota-mnemonic-session', () => ({
  getDirectIotaSessionSignerAddress: () => BOB,
}))

vi.mock('@/frontend/lib/direct-chat-ecdh-session', () => ({
  getDirectChatEcdhMaterialForRecipient: () => null,
  getDirectChatEcdhPrivateKey: () => null,
  restoreDirectChatEcdhPrivateFromLocalStorage: async () => ({ ok: false, error: 'mock' }),
}))

vi.mock('@/frontend/lib/direct-iota-vault-unlock-sync', () => ({
  tryAutoRestoreDirectChatEcdhPrivateKey: async () => ({ ok: false }),
}))

vi.mock('@/frontend/lib/direct-iota-encrypted-send-prep', () => ({
  ensureDirectChatPeerPubForRecipient: async () => ({ ok: false, error: 'mock' }),
}))

vi.mock('@/frontend/lib/direct-session-keys-archive', () => ({
  getPeerSessionArchiveForRecipient: () => undefined,
}))

function fakeWire(): string {
  const packet: RatchetCipherPacket = {
    header: {
      v: 3,
      cs: 1,
      dh: 'cG9jLWFsaWNlLWRoLXBsYWNlaG9sZGVy',
      pn: 0,
      n: 0,
      msgId: '1795789953734',
      ts: 1795789953736,
    },
    body: new Uint8Array([1, 2, 3, 4]),
  }
  return encodeRatchetPacketWire(packet)
}

describe('unwrapRatchetV3InInboxApiRows', () => {
  beforeEach(() => {
    localStorage.removeItem(RATCHET_EXPERIMENT_LS_KEY)
    writeRatchetExperimentEnabled(false)
    purgeRatchetSessionVault()
    clearVaultPasswordSession()
    clearOutgoingSendEchoForTests()
  })

  it('ersetzt Roh-JSON durch Hint wenn Opt-in aus', async () => {
    const wire = fakeWire()
    const rows = await unwrapRatchetV3InInboxApiRows(
      [{ sender: ALICE, recipient: BOB, text: wire, isPlain: false }],
      BOB
    )
    expect(rows[0]!.text).not.toContain('RATCHET_V3')
    expect(rows[0]!.text).toMatch(/Double Ratchet/i)
  })

  it('lässt normalen Klartext unverändert', async () => {
    const rows = await unwrapRatchetV3InInboxApiRows(
      [{ sender: ALICE, text: 'hallo', isPlain: true }],
      BOB
    )
    expect(rows[0]!.text).toBe('hallo')
  })

  it('eigene Ausgangs-Zeile: Nonce-Echo ohne Ratchet-RAM', async () => {
    writeRatchetExperimentEnabled(true)
    rememberOutgoingSendEcho({
      peerAddress: ALICE,
      nonce: '1795789953734',
      plaintext: 'VISITENKARTE\nich',
    })
    expect(
      await resolveRatchetLayerAfterOuterDecrypt({
        text: fakeWire(),
        peerAddress: ALICE,
        myAddress: BOB,
        iAmSender: true,
      })
    ).toBe('VISITENKARTE\nich')
  })

  it('eigene Ausgangs-Zeile ohne Echo: Hint statt forceNew-Unwrap', async () => {
    writeRatchetExperimentEnabled(true)
    setVaultPasswordSession('vault-pass-99')
    const shared = crypto.getRandomValues(new Uint8Array(32))
    await ensureRatchetSessionForPeer({ peerAddress: ALICE, ecdhShared: shared, localAddress: BOB })
    const wrapped = await tryRatchetExperimentWrapOutgoing({
      peerAddress: ALICE,
      plaintext: 'bob out',
      msgId: 'bout1',
    })
    expect(wrapped?.wire).toContain('RATCHET_V3')
    expect(
      await resolveRatchetLayerAfterOuterDecrypt({
        text: wrapped!.wire,
        peerAddress: ALICE,
        myAddress: BOB,
        iAmSender: true,
      })
    ).toBe('bob out')

    /** msgId divergiert, body gleich → Echo über bodyB64-Index. */
    const sameBodyOtherId = wrapped!.wire.replace('bout1', 'other-id')
    expect(
      await resolveRatchetLayerAfterOuterDecrypt({
        text: sameBodyOtherId,
        peerAddress: ALICE,
        myAddress: BOB,
        iAmSender: true,
      })
    ).toBe('bob out')

    const noEchoWire = wrapped!.wire
      .replace('bout1', 'other-id')
      .replace(/"bodyB64":"[^"]+"/, '"bodyB64":"QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ"')
    expect(
      await resolveRatchetLayerAfterOuterDecrypt({
        text: noEchoWire,
        peerAddress: ALICE,
        myAddress: BOB,
        iAmSender: true,
      })
    ).toMatch(/eigene Sendung/i)

    /** Bob-Session muss nach eigenem Ausgangs-Hint noch existieren (A→B-Empfang). */
    const { getRatchetSessionForPeer } = await import('@/frontend/lib/ratchet-session-local-store')
    expect(getRatchetSessionForPeer(ALICE)).not.toBeNull()
    const { createRatchetSessionPair } = await import('@morgendrot/shared/morgendrot-ratchet-session')
    const { alice } = await createRatchetSessionPair(shared, ALICE, BOB)
    const fromAlice = encodeRatchetPacketWire(await alice.encrypt('from alice', 'ain1'))
    const { tryRatchetExperimentUnwrapIncoming } = await import('@/frontend/lib/ratchet-experiment')
    expect(
      (
        await tryRatchetExperimentUnwrapIncoming({
          peerAddress: ALICE,
          raw: fromAlice,
          ecdhShared: shared,
          localAddress: BOB,
        })
      )?.plaintext
    ).toBe('from alice')
  })
})
