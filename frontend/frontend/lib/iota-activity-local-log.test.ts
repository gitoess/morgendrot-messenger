import { afterEach, describe, expect, it } from 'vitest'
import {
  clearIotaActivityLocal,
  listIotaActivity,
  recordMsgBurnActivity,
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
})
