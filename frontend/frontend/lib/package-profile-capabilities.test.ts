import { describe, expect, it } from 'vitest'
import {
  defaultCapabilitiesFromRoleId,
  type MessengerCapabilitiesMatrix,
} from '@morgendrot/shared/messenger-capabilities-matrix'
import type { PackageProfile } from '@/frontend/lib/package-profile'
import { parsePackageProfile } from '@/frontend/lib/package-profile'
import {
  profileHasCapabilityOverride,
  resolveProfileCapabilities,
} from '@/frontend/lib/package-profile-capabilities'

const PKG = '0x' + 'a'.repeat(64)
const MB = '0x' + 'b'.repeat(64)

function baseMatrix(): MessengerCapabilitiesMatrix {
  // roleId 6 = listen(4)+send(2), iota-anchored → voller Transport
  return defaultCapabilitiesFromRoleId({ roleId: 6, transportProfile: 'iota-anchored' })
}

describe('parsePackageProfile capabilities (H.24a P4)', () => {
  it('liest capabilities-Override aus dem Manifest-Eintrag', () => {
    const p = parsePackageProfile({
      id: 'training',
      label: 'Training',
      packageId: PKG,
      mailboxId: MB,
      capabilities: { transport: { iota: { write: false } }, simpleMode: true },
    })
    expect(p?.capabilities).toBeTruthy()
    expect(p?.capabilities?.simpleMode).toBe(true)
  })

  it('ohne capabilities bleibt Feld leer', () => {
    const p = parsePackageProfile({ id: 'a', label: 'A', packageId: PKG, mailboxId: MB })
    expect(p?.capabilities).toBeUndefined()
  })
})

describe('resolveProfileCapabilities (H.24a P4)', () => {
  it('ohne Profil/Override bleibt die Basis unverändert', () => {
    const base = baseMatrix()
    expect(resolveProfileCapabilities(base, null)).toEqual(base)
    expect(resolveProfileCapabilities(base, { id: 'x', label: 'X', bundled: false, readOnly: false, resolved: false })).toEqual(base)
  })

  it('Profil-Override verfeinert die Matrix (Training: kein IOTA-Write)', () => {
    const base = baseMatrix()
    expect(base.transport.iota.write).toBe(true)
    const profile: PackageProfile = {
      id: 'training',
      label: 'Training',
      bundled: true,
      readOnly: true,
      resolved: true,
      capabilities: { transport: { iota: { write: false } }, simpleMode: true },
    }
    const resolved = resolveProfileCapabilities(base, profile)
    expect(resolved.transport.iota.write).toBe(false)
    expect(resolved.transport.iota.read).toBe(base.transport.iota.read)
    expect(resolved.simpleMode).toBe(true)
    expect(profileHasCapabilityOverride(profile)).toBe(true)
  })
})
