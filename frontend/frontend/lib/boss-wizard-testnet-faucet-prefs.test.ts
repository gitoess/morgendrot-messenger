import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearBossTestnetFaucetPrefs,
  readBossTestnetFaucetPrefs,
  resolveBossTestnetFaucetOpenUrl,
  resolveBossTestnetFaucetRecipient,
  writeBossTestnetFaucetPrefs,
} from './boss-wizard-testnet-faucet-prefs'

const ADDR_A = '0x' + 'a'.repeat(64)
const ADDR_B = '0x' + 'b'.repeat(64)

describe('boss-wizard-testnet-faucet-prefs', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
  })

  it('nutzt Wallet-Adresse wenn kein Override', () => {
    expect(resolveBossTestnetFaucetRecipient(ADDR_A, { recipientOverride: '' })).toBe(ADDR_A)
  })

  it('nutzt Override wenn gesetzt', () => {
    writeBossTestnetFaucetPrefs({ recipientOverride: ADDR_B })
    expect(resolveBossTestnetFaucetRecipient(ADDR_A)).toBe(ADDR_B)
  })

  it('baut URL mit aktueller Adresse neu', () => {
    const u1 = resolveBossTestnetFaucetOpenUrl(ADDR_A).url
    const u2 = resolveBossTestnetFaucetOpenUrl(ADDR_B).url
    expect(u1).toContain(encodeURIComponent(ADDR_A))
    expect(u2).toContain(encodeURIComponent(ADDR_B))
    expect(u1).not.toBe(u2)
  })

  it('eigener Voll-Link hat Vorrang', () => {
    const custom = 'https://example.test/faucet?address=custom'
    writeBossTestnetFaucetPrefs({ customOpenUrl: custom })
    const r = resolveBossTestnetFaucetOpenUrl(ADDR_A)
    expect(r.mode).toBe('custom')
    expect(r.url).toBe(custom)
  })

  it('clear setzt zurück', () => {
    writeBossTestnetFaucetPrefs({ customOpenUrl: 'https://x.test', recipientOverride: ADDR_B })
    clearBossTestnetFaucetPrefs()
    expect(readBossTestnetFaucetPrefs()).toEqual({
      customOpenUrl: '',
      faucetBase: '',
      recipientOverride: '',
    })
  })
})
