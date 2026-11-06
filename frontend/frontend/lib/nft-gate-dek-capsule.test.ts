import { describe, expect, it } from 'vitest'
import { generateKeyPair } from '@morgendrot/shared/morgendrot-crypto'
import {
  decryptNftGateMessageWire,
  encryptNftGateMessage,
  evaluateNftGateAccess,
  isNftGateMessageWire,
  peekNftGateMeta,
  peekNftGateObjectId,
} from '@/frontend/lib/nft-gate-dek-capsule'

const OID = '0x' + 'ab'.repeat(32)
const WALLET = '0x' + 'cd'.repeat(32)
const OTHER = '0x' + '11'.repeat(32)

describe('nft-gate-dek-capsule B2-P4a / dual / P4a2', () => {
  it('encrypt/decrypt Roundtrip nur mit nftAccessOk', async () => {
    const { wire, nftObjectId } = await encryptNftGateMessage({
      plainUtf8: 'geheim unter nft',
      nftObjectId: OID,
    })
    expect(isNftGateMessageWire(wire)).toBe(true)
    expect(nftObjectId).toBe(OID)
    expect(peekNftGateObjectId(wire)).toBe(OID)
    expect(peekNftGateMeta(wire)?.gate).toBe('nft_owner_p4a')

    await expect(
      decryptNftGateMessageWire(wire, { nftAccessOk: false, signerAddress: WALLET })
    ).rejects.toThrow(/Besitz|Leihe/)
    expect(
      await decryptNftGateMessageWire(wire, { nftAccessOk: true, signerAddress: WALLET })
    ).toBe('geheim unter nft')
  })

  it('Dual-Gate: Wallet + NFT — falsche Adresse scheitert', async () => {
    const { wire } = await encryptNftGateMessage({
      plainUtf8: 'nur eine wallet',
      nftObjectId: OID,
      requiredWallet: WALLET,
    })
    expect(peekNftGateMeta(wire)?.gate).toBe('nft_and_wallet_p4a')
    expect(peekNftGateMeta(wire)?.requiredWallet).toBe(WALLET)

    await expect(
      decryptNftGateMessageWire(wire, { nftAccessOk: true, signerAddress: OTHER })
    ).rejects.toThrow(/Wallet/)
    expect(
      await decryptNftGateMessageWire(wire, { nftAccessOk: true, signerAddress: WALLET })
    ).toBe('nur eine wallet')
  })

  it('P4a2: Pubkey-Wrap — ohne Privatkey / mit fremdem Key scheitert', async () => {
    const recipient = await generateKeyPair(true)
    const stranger = await generateKeyPair(true)
    const { wire } = await encryptNftGateMessage({
      plainUtf8: 'nur mit privatkey',
      nftObjectId: OID,
      requiredWallet: WALLET,
      recipientEcdhPubRaw: recipient.pubRaw,
    })
    expect(peekNftGateMeta(wire)?.gate).toBe('nft_and_wallet_pubkey_p4a2')
    expect(peekNftGateMeta(wire)?.ephemeralPubRawB64).toBeTruthy()

    await expect(
      decryptNftGateMessageWire(wire, {
        nftAccessOk: true,
        signerAddress: WALLET,
      })
    ).rejects.toThrow(/ECDH-Privatkey|P4a2/)

    await expect(
      decryptNftGateMessageWire(wire, {
        nftAccessOk: true,
        signerAddress: WALLET,
        ecdhPrivateKey: stranger.privateKey,
      })
    ).rejects.toThrow(/Privatkey|beschädigt|P4a2/)

    expect(
      await decryptNftGateMessageWire(wire, {
        nftAccessOk: true,
        signerAddress: WALLET,
        ecdhPrivateKey: recipient.privateKey,
      })
    ).toBe('nur mit privatkey')
  })

  it('evaluateNftGateAccess', () => {
    expect(
      evaluateNftGateAccess({
        meta: { gate: 'nft_and_wallet_p4a', requiredWallet: WALLET },
        nftAccessOk: true,
        signerAddress: WALLET,
      }).ok
    ).toBe(true)
    expect(
      evaluateNftGateAccess({
        meta: { gate: 'nft_and_wallet_pubkey_p4a2', requiredWallet: WALLET },
        nftAccessOk: true,
        signerAddress: OTHER,
      }).ok
    ).toBe(false)
  })

  it('lehnt ungültige Object-ID ab', async () => {
    await expect(
      encryptNftGateMessage({ plainUtf8: 'x', nftObjectId: '0xabc' })
    ).rejects.toThrow(/Object-ID/)
  })
})
