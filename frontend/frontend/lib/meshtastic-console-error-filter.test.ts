import { describe, expect, it } from 'vitest'
import {
  isMeshtasticBenignConsoleErrorArgs,
  isMeshtasticBenignUnhandledReason,
  isMeshtasticSdkPacketConsoleError,
} from '@/frontend/lib/meshtastic-console-error-filter'

describe('isMeshtasticBenignUnhandledReason', () => {
  it('schluckt SDK Routing-Rejects inkl. RATE_LIMIT 38', () => {
    expect(isMeshtasticBenignUnhandledReason({ id: 720788287, error: 38 })).toBe(true)
    expect(isMeshtasticBenignUnhandledReason({ id: 1, error: 5 })).toBe(true)
  })

  it('schluckt Break / device lost / NetworkError', () => {
    expect(isMeshtasticBenignUnhandledReason(new DOMException('Break received', 'BreakError'))).toBe(
      true
    )
    expect(
      isMeshtasticBenignUnhandledReason(new DOMException('The device has been lost.', 'NetworkError'))
    ).toBe(true)
  })

  it('lässt normale Errors durch', () => {
    expect(isMeshtasticBenignUnhandledReason(new Error('echte App-Exception'))).toBe(false)
  })

  it('schluckt Next coerceError E394 / message [object Object]', () => {
    const coerced = new Error('[object Object]') as Error & { __NEXT_ERROR_CODE?: string }
    coerced.__NEXT_ERROR_CODE = 'E394'
    expect(isMeshtasticBenignUnhandledReason(coerced)).toBe(true)
  })

  it('schluckt SDK packet console line (Next Console Error Flut)', () => {
    const line = 'Error received for packet 306803125: undefined'
    expect(isMeshtasticSdkPacketConsoleError(line)).toBe(true)
    expect(isMeshtasticBenignConsoleErrorArgs([line])).toBe(true)
  })
})
