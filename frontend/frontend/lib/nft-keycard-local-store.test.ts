import { afterEach, describe, expect, it } from 'vitest'
import {
  NFT_KEYCARD_ENC_LS_KEY,
  bindObjectToNftKeycard,
  bindWireToNftKeycard,
  findNftKeycardBindingForWireFingerprint,
  flushNftKeycardVaultPersist,
  getNftKeycard,
  hasEncryptedNftKeycardVault,
  lockNftKeycardVault,
  lookupPassphraseForNftKeycard,
  purgeNftKeycardVault,
  removeNftKeycardSlot,
  unbindObjectFromNftKeycard,
  unbindWireFromNftKeycard,
  unlockNftKeycardVault,
  upsertNftKeycardSlot,
} from '@/frontend/lib/nft-keycard-local-store'
import { setVaultPasswordSession } from '@/frontend/lib/vault-password-session'

const OID = '0x' + 'ef'.repeat(32)
const IMG = '0x' + 'ab'.repeat(32)

describe('nft-keycard vault (H.23 B2 P0)', () => {
  afterEach(() => {
    purgeNftKeycardVault()
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('merken ohne Vault-Session abgelehnt', () => {
    const r = upsertNftKeycardSlot({ objectId: OID, passphrase: 'card-pass-99' })
    expect(r.ok).toBe(false)
  })

  it('persistiert verschlüsselt und überlebt Lock+Unlock', async () => {
    setVaultPasswordSession('vault-pass-99')
    await unlockNftKeycardVault('vault-pass-99')
    expect(
      upsertNftKeycardSlot({ objectId: OID, passphrase: 'card-pass-99', note: 'PWMSG' }).ok
    ).toBe(true)
    await flushNftKeycardVaultPersist()
    expect(hasEncryptedNftKeycardVault()).toBe(true)
    expect(window.localStorage.getItem(NFT_KEYCARD_ENC_LS_KEY)).toContain(
      'morgendrot.nft-keycard.enc.v1'
    )

    lockNftKeycardVault()
    expect(getNftKeycard(OID)).toBeNull()
    expect(window.sessionStorage.getItem('morgendrot.nftKeycard.tab.v1')).toBeNull()

    setVaultPasswordSession('vault-pass-99')
    const again = await unlockNftKeycardVault('vault-pass-99')
    expect(again.ok).toBe(true)
    expect(getNftKeycard(OID)?.slots[0]?.passphrase).toBe('card-pass-99')
  })

  it('P2 Multi-Slot + gebundenes ImageNFT', () => {
    setVaultPasswordSession('vault-pass-99')
    expect(upsertNftKeycardSlot({ objectId: OID, passphrase: 'slot-default-1', note: 'PWMSG' }).ok).toBe(
      true
    )
    expect(
      upsertNftKeycardSlot({
        objectId: OID,
        slotId: 'img',
        passphrase: 'slot-img-9999',
        note: 'MORGIMGE1',
      }).ok
    ).toBe(true)
    expect(getNftKeycard(OID)?.slots.map((s) => s.id).sort()).toEqual(['default', 'img'])
    const shortImg = '0x' + 'ab'.repeat(31) // 62 Hex → pad auf 64
    expect(bindObjectToNftKeycard({ cardObjectId: OID, boundObjectId: shortImg, slotId: 'img' }).ok).toBe(
      true
    )
    expect(bindObjectToNftKeycard({ cardObjectId: OID, boundObjectId: IMG, slotId: 'img' }).ok).toBe(
      true
    )
    expect(lookupPassphraseForNftKeycard({ objectId: IMG })).toBe('slot-img-9999')
    expect(removeNftKeycardSlot({ objectId: OID, slotId: 'img' }).ok).toBe(true)
    expect(lookupPassphraseForNftKeycard({ objectId: IMG })).toBeNull()
    expect(getNftKeycard(OID)?.slots).toHaveLength(1)
  })

  it('unbind Object / Wire einzeln', () => {
    setVaultPasswordSession('vault-pass-99')
    expect(upsertNftKeycardSlot({ objectId: OID, passphrase: 'slot-default-1' }).ok).toBe(true)
    expect(bindObjectToNftKeycard({ cardObjectId: OID, boundObjectId: IMG, slotId: 'default' }).ok).toBe(
      true
    )
    expect(bindWireToNftKeycard({ objectId: OID, wireFingerprint: 'fnv:1:abc', slotId: 'default' }).ok).toBe(
      true
    )
    expect(unbindObjectFromNftKeycard({ cardObjectId: OID, boundObjectId: IMG }).ok).toBe(true)
    expect(lookupPassphraseForNftKeycard({ objectId: IMG })).toBeNull()
    expect(unbindWireFromNftKeycard({ objectId: OID, wireFingerprint: 'fnv:1:abc' }).ok).toBe(true)
    expect(getNftKeycard(OID)?.boundWires).toBeUndefined()
  })

  it('findNftKeycardBindingForWireFingerprint', () => {
    setVaultPasswordSession('vault-pass-99')
    expect(upsertNftKeycardSlot({ objectId: OID, passphrase: 'slot-default-1' }).ok).toBe(true)
    expect(bindWireToNftKeycard({ objectId: OID, wireFingerprint: 'fnv:9:zz', slotId: 'default' }).ok).toBe(
      true
    )
    expect(findNftKeycardBindingForWireFingerprint('fnv:9:zz')).toEqual({
      cardObjectId: OID,
      slotId: 'default',
    })
    expect(findNftKeycardBindingForWireFingerprint('missing')).toBeNull()
  })
})
