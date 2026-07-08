import { describe, expect, it, vi } from 'vitest'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import {
  emergencyFanOutAnyOk,
  formatEmergencyFanOutStatus,
  planEmergencyFanOutLegs,
  runEmergencyFanOut,
} from '@/frontend/features/send/chat-view-emergency-fanout'

const BOSS = '0x' + 'aa'.repeat(32)

describe('planEmergencyFanOutLegs', () => {
  it('privater Chat mit Partner → Funk + Online', () => {
    expect(
      planEmergencyFanOutLegs({
        isPrivate: true,
        plainMailboxRecipient: BOSS,
        composerRecipient: BOSS,
        composerPartner: BOSS,
        groupMailboxInternetChain: false,
      })
    ).toEqual(['mesh', 'internet'])
  })

  it('ohne 0x-Ziel nur Funk', () => {
    expect(
      planEmergencyFanOutLegs({
        isPrivate: true,
        plainMailboxRecipient: '',
        composerRecipient: '',
        composerPartner: '',
        groupMailboxInternetChain: false,
      })
    ).toEqual(['mesh'])
  })
})

describe('formatEmergencyFanOutStatus', () => {
  it('formatiert Teilergebnisse', () => {
    expect(
      formatEmergencyFanOutStatus([
        { leg: 'mesh', ok: true },
        { leg: 'internet', ok: false, detail: 'Tresor gesperrt' },
      ])
    ).toBe('Funk OK · Online: Tresor gesperrt')
  })
})

describe('runEmergencyFanOut', () => {
  it('parallelisiert Wege und behält Online-Erfolg', async () => {
    const send = vi.fn(async (t: ForcedTransport) =>
      t === 'internet'
        ? { ok: true, part: { ok: true as const } }
        : { ok: false, detail: 'NO_RESPONSE' }
    )
    const { results, best } = await runEmergencyFanOut(['mesh', 'internet'], send)
    expect(send).toHaveBeenCalledTimes(2)
    expect(emergencyFanOutAnyOk(results)).toBe(true)
    expect(best?.ok).toBe(true)
  })
})
