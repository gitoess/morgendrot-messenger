import { describe, expect, it } from 'vitest'
import {
  iotaActivityMatchesFilter,
  type IotaActivityEntry,
} from '@/frontend/lib/iota-activity-local-log'

function row(partial: Partial<IotaActivityEntry> & Pick<IotaActivityEntry, 'kind' | 'summary'>): IotaActivityEntry {
  return {
    id: 't',
    atMs: 1,
    ...partial,
  }
}

describe('iotaActivityMatchesFilter', () => {
  it('groups in/out/nft/coin/msg/lease', () => {
    expect(iotaActivityMatchesFilter(row({ kind: 'nft_received', summary: 'x' }), 'in')).toBe(true)
    expect(iotaActivityMatchesFilter(row({ kind: 'coin_out', summary: 'x' }), 'out')).toBe(true)
    expect(iotaActivityMatchesFilter(row({ kind: 'nft_mint', summary: 'x' }), 'nft')).toBe(true)
    expect(iotaActivityMatchesFilter(row({ kind: 'msg_burned', summary: 'x' }), 'msg')).toBe(true)
    expect(
      iotaActivityMatchesFilter(row({ kind: 'nft_sent', summary: 'Zeitkapsel-Verleih' }), 'lease')
    ).toBe(true)
    expect(iotaActivityMatchesFilter(row({ kind: 'coin_in', summary: 'x' }), 'nft')).toBe(false)
  })
})
