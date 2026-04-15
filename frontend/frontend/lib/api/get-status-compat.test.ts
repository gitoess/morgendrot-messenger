import { describe, it, expect } from 'vitest'
import { mapApiStatusFetchOkToLegacyGetStatusResponse } from './get-status-compat'
import type { ApiStatusFetchOk } from './status'

const hint = { okAtMs: 1, httpDateUtcMs: null as number | null }

function mk(p: Partial<ApiStatusFetchOk>): ApiStatusFetchOk {
  return { pollClockHint: hint, ...p } as ApiStatusFetchOk
}

describe('mapApiStatusFetchOkToLegacyGetStatusResponse', () => {
  it('ok und backendOnline folgen backendRunning', () => {
    const on = mapApiStatusFetchOkToLegacyGetStatusResponse(mk({ backendRunning: true }))
    expect(on.ok).toBe(true)
    expect(on.data?.backendOnline).toBe(true)
    const off = mapApiStatusFetchOkToLegacyGetStatusResponse(mk({ backendRunning: false }))
    expect(off.ok).toBe(false)
    expect(off.data?.backendOnline).toBe(false)
  })

  it('rpcUrlLabel schlägt network', () => {
    const r = mapApiStatusFetchOkToLegacyGetStatusResponse(
      mk({ backendRunning: true, rpcUrlLabel: 'Tor', network: 'Mainnet' })
    )
    expect(r.data?.network).toBe('Tor')
  })

  it('network ohne rpcUrlLabel', () => {
    const r = mapApiStatusFetchOkToLegacyGetStatusResponse(mk({ backendRunning: true, network: 'Test' }))
    expect(r.data?.network).toBe('Test')
  })

  it('Fallback netzwerk —', () => {
    const r = mapApiStatusFetchOkToLegacyGetStatusResponse(mk({ backendRunning: true }))
    expect(r.data?.network).toBe('—')
  })

  it('chatConnected aus connected', () => {
    const r = mapApiStatusFetchOkToLegacyGetStatusResponse(mk({ backendRunning: true, connected: true }))
    expect(r.data?.chatConnected).toBe(true)
  })

  it('locked true setzt Flag', () => {
    const r = mapApiStatusFetchOkToLegacyGetStatusResponse(mk({ backendRunning: true, locked: true }))
    expect(r.locked).toBe(true)
  })

  it('locked false weglassen', () => {
    const r = mapApiStatusFetchOkToLegacyGetStatusResponse(mk({ backendRunning: true, locked: false }))
    expect(r.locked).toBeUndefined()
  })

  it('Adresse und packageId', () => {
    const r = mapApiStatusFetchOkToLegacyGetStatusResponse(
      mk({ backendRunning: true, myAddress: '0xabc', packageId: '0xp' })
    )
    expect(r.data?.address).toBe('0xabc')
    expect(r.data?.packageId).toBe('0xp')
  })

  it('signer vault role', () => {
    const r = mapApiStatusFetchOkToLegacyGetStatusResponse(
      mk({
        backendRunning: true,
        signer: 'sdk',
        role: 'boss',
        vaultStatus: { hasLocal: true },
      })
    )
    expect(r.data?.signer).toBe('sdk')
    expect(r.data?.role).toBe('boss')
    expect(r.data?.vaultHasLocal).toBe(true)
  })

  it('role nur wenn string', () => {
    const raw = mk({ backendRunning: true, role: 'boss' })
    ;(raw as { role?: unknown }).role = 9
    const r = mapApiStatusFetchOkToLegacyGetStatusResponse(raw)
    expect(r.data?.role).toBeUndefined()
  })

  it('version nur wenn string', () => {
    const t = mk({ backendRunning: true })
    ;(t as { version?: unknown }).version = '1.2.3'
    expect(mapApiStatusFetchOkToLegacyGetStatusResponse(t).data?.version).toBe('1.2.3')
    ;(t as { version?: unknown }).version = 1
    expect(mapApiStatusFetchOkToLegacyGetStatusResponse(t).data?.version).toBeUndefined()
  })
})
