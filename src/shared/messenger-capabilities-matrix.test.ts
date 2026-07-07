import { describe, expect, it } from 'vitest'
import {
  defaultCapabilitiesFromRoleId,
  mergeCapabilitiesOverride,
  resolveMessengerCapabilities,
} from './messenger-capabilities-matrix.js'

describe('messenger-capabilities-matrix', () => {
  it('ROLE_ID 12 (BW+L): kein Senden legacy', () => {
    const c = defaultCapabilitiesFromRoleId({ roleId: 12, transportProfile: 'mesh-first' })
    expect(c.transport.lora.write).toBe(false)
    expect(c.transport.telegram.write).toBe(false)
    expect(c.transport.lora.read).toBe(true)
  })

  it('Override: LoRa schreiben, Telegram/IOTA nur lesen', () => {
    const c = resolveMessengerCapabilities({
      roleId: 12,
      transportProfile: 'mesh-first',
      override: {
        transport: {
          lora: { write: true },
          telegram: { read: true, write: false },
          iota: { read: false, write: false },
        },
      },
    })
    expect(c.transport.lora.write).toBe(true)
    expect(c.transport.telegram.write).toBe(false)
    expect(c.transport.iota.write).toBe(false)
    expect(c.roleId).toBe(12)
  })

  it('merge behält unberührte Kanäle', () => {
    const base = defaultCapabilitiesFromRoleId({ roleId: 14 })
    const merged = mergeCapabilitiesOverride(base, { transport: { iota: { write: false } } })
    expect(merged.transport.lora.write).toBe(true)
    expect(merged.transport.iota.write).toBe(false)
  })

  it('Boss ohne ROLE_ID (0): voller Transport bei iota-full', () => {
    const c = resolveMessengerCapabilities({
      roleId: 0,
      hierarchyRole: 'boss',
      transportProfile: 'iota-full',
    })
    expect(c.roleId).toBe(14)
    expect(c.transport.iota.write).toBe(true)
    expect(c.transport.lora.write).toBe(true)
    expect(c.transport.telegram.write).toBe(true)
  })

  it('Boss mit teilweisem Override: gezielte Sperre bleibt', () => {
    const c = resolveMessengerCapabilities({
      roleId: 14,
      hierarchyRole: 'boss',
      transportProfile: 'iota-full',
      override: { transport: { telegram: { write: false } } },
    })
    expect(c.transport.telegram.write).toBe(false)
    expect(c.transport.iota.write).toBe(true)
  })
})
