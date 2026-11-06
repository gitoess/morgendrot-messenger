import { describe, expect, it } from 'vitest'
import {
  addressOwnerFromObjectOwner,
  checkNftOwnedByAddress,
} from '@/frontend/lib/nft-keycard-ownership'

const OID = '0x' + 'ab'.repeat(32)
const OWNER = '0x' + 'cd'.repeat(32)

describe('nft-keycard-ownership', () => {
  it('parst AddressOwner', () => {
    expect(addressOwnerFromObjectOwner({ AddressOwner: OWNER })).toBe(OWNER)
    expect(addressOwnerFromObjectOwner({ ObjectOwner: OID })).toBeNull()
    expect(addressOwnerFromObjectOwner('Shared')).toBeNull()
  })

  it('checkNftOwnedByAddress: owned true/false', async () => {
    const client = {
      getObject: async () => ({ data: { owner: { AddressOwner: OWNER } } }),
    }
    const yes = await checkNftOwnedByAddress(client, OID, OWNER)
    expect(yes.ok && yes.owned).toBe(true)
    const no = await checkNftOwnedByAddress(client, OID, '0x' + '11'.repeat(32))
    expect(no.ok && no.owned).toBe(false)
  })
})
