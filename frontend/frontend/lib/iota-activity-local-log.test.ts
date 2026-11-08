import { afterEach, describe, expect, it } from 'vitest'
import {
  clearIotaActivityLocal,
  listIotaActivity,
  recordMsgBurnActivity,
  recordNftVaultActivity,
} from '@/frontend/lib/iota-activity-local-log'
import { clearNftActivity, recordNftActivity } from '@/frontend/lib/nft-activity-local-log'

const OID = `0x${'ab'.repeat(32)}`
const MB = `0x${'cd'.repeat(32)}`

describe('iota-activity-local-log', () => {
  afterEach(() => {
    clearIotaActivityLocal()
    clearNftActivity()
  })

  it('merkt Msg-Burn und mischt NFT-Einträge', () => {
    recordMsgBurnActivity({ digest: 'd1', mailboxObjectId: MB, nonce: '42' })
    recordNftActivity({ kind: 'burned', objectId: OID, digest: 'd2' })
    const list = listIotaActivity(10)
    expect(list.some((e) => e.kind === 'msg_burned')).toBe(true)
    expect(list.some((e) => e.kind === 'nft_burned')).toBe(true)
  })

  it('merkt Guarded-Purse / Vault in Aktivität', () => {
    recordNftVaultActivity({
      op: 'purse_create',
      vaultObjectId: OID,
      nftObjectId: MB,
      amountMist: 2_000_000_000n,
      digest: 'd3',
      nftLabel: 'Testkarte',
    })
    const list = listIotaActivity(10)
    const row = list.find((e) => e.kind === 'coin_out' && e.digest === 'd3')
    expect(row?.summary).toMatch(/Guarded-Purse angelegt/)
    expect(row?.summary).toMatch(/2 IOTA/)
    expect(row?.summary).toMatch(/Testkarte/)
  })
})
