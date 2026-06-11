import { describe, expect, it } from 'vitest'
import { buildLocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'
import { broadcastPinnwandStatusFromHandoff } from '@/frontend/lib/broadcast-pinnwand-handoff-status'

const BOARD = '0x' + 'f'.repeat(64)
const BOSS = '0x' + 'b'.repeat(64)

describe('handoff Lagebild snapshot', () => {
  it('parst ENABLE_BROADCAST_PINNWAND aus Handoff-.env', () => {
    const snap = buildLocalHandoffAppliedSnapshot(
      `ENABLE_BROADCAST_PINNWAND=true\nBROADCAST_PINNWAND_ADDRESS=${BOARD}\n`
    )
    expect(snap.broadcastPinnwandEnabled).toBe(true)
    expect(snap.broadcastPinnwandAddress).toBe(BOARD)
    const status = broadcastPinnwandStatusFromHandoff(snap)
    expect(status?.enabled).toBe(true)
    expect(status?.address).toBe(BOARD.toLowerCase())
  })

  it('parst BROADCAST_AUTHORIZED_SENDERS für Helfer-Filter', () => {
    const snap = buildLocalHandoffAppliedSnapshot(
      `ENABLE_BROADCAST_PINNWAND=true\nBROADCAST_PINNWAND_ADDRESS=${BOARD}\nBROADCAST_AUTHORIZED_SENDERS=${BOSS}\n`
    )
    expect(snap.broadcastPinnwandAuthorizedSenders).toEqual([BOSS])
    const status = broadcastPinnwandStatusFromHandoff(snap)
    expect(status?.authorizedSenders).toEqual([BOSS])
  })
})
