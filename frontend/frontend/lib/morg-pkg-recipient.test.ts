import { describe, expect, it } from 'vitest'
import { resolveMorgPkgRecipientAddress } from './morg-pkg-recipient'

const A = '0x' + 'a'.repeat(64)
const B = '0x' + 'b'.repeat(64)

describe('resolveMorgPkgRecipientAddress', () => {
  it('lehnt bei gesperrtem Tresor ab', () => {
    expect(
      resolveMorgPkgRecipientAddress({ locked: true, connectedAddresses: [A], partner: '', recipient: '' })
    ).toMatchObject({
      recipient: null,
    })
  })

  it('nimmt einzigen verbundenen Partner', () => {
    expect(resolveMorgPkgRecipientAddress({ connectedAddresses: [A], partner: '', recipient: '' })).toEqual({
      recipient: A,
      error: null,
    })
  })

  it('matcht recipient-Feld bei mehreren Partnern', () => {
    expect(
      resolveMorgPkgRecipientAddress({ connectedAddresses: [A, B], partner: '', recipient: B })
    ).toEqual({ recipient: B, error: null })
  })

  it('nutzt exportRecipient aus Pakete-Menü', () => {
    expect(
      resolveMorgPkgRecipientAddress({
        connectedAddresses: [A, B],
        partner: '',
        recipient: '',
        exportRecipient: A,
      })
    ).toEqual({ recipient: A, error: null })
  })
})
