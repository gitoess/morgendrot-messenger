import { beforeEach, describe, expect, it } from 'vitest'
import { readActiveProfileSnapshot, setActiveProfile, writeRegistryState } from '@/frontend/lib/package-profile-registry'
import { resolveEffectiveInboxPackageId } from '@/frontend/lib/package-profile-inbox'
import type { PackageProfile } from '@/frontend/lib/package-profile'

const PKG = '0x' + 'a'.repeat(64)
const MB = '0x' + 'b'.repeat(64)
const PKG2 = '0x' + 'c'.repeat(64)

function profile(over: Partial<PackageProfile> & { id: string; label: string }): PackageProfile {
  return {
    bundled: false,
    readOnly: false,
    resolved: Boolean(over.packageId && over.mailboxId),
    ...over,
  }
}

describe('resolveEffectiveInboxPackageId (H.24 Adoption)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('Filter gewinnt vor Profil und API', () => {
    const combined = [profile({ id: 'aktiv', label: 'Aktiv', packageId: PKG, mailboxId: MB })]
    const res = setActiveProfile({ userProfiles: [] }, 'aktiv', combined)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    writeRegistryState(res.state)
    expect(
      resolveEffectiveInboxPackageId({ inboxFilter: PKG2, apiPackageId: '0x' + 'd'.repeat(64) })
    ).toBe(PKG2)
  })

  it('aktives Profil, wenn Filter leer und Package = Server', () => {
    const combined = [profile({ id: 'aktiv', label: 'Aktiv', packageId: PKG, mailboxId: MB })]
    const res = setActiveProfile({ userProfiles: [] }, 'aktiv', combined)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    writeRegistryState(res.state)
    expect(readActiveProfileSnapshot()?.packageId).toBe(PKG)
    expect(resolveEffectiveInboxPackageId({ inboxFilter: '', apiPackageId: PKG })).toBe(PKG)
  })

  it('Server-Package gewinnt wenn Profil abweicht (keine leeren/fehlenden Inbox-Tage)', () => {
    const combined = [profile({ id: 'aktiv', label: 'Aktiv', packageId: PKG, mailboxId: MB })]
    const res = setActiveProfile({ userProfiles: [] }, 'aktiv', combined)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    writeRegistryState(res.state)
    expect(resolveEffectiveInboxPackageId({ inboxFilter: '', apiPackageId: PKG2 })).toBe(PKG2)
  })

  it('API-Fallback ohne aktives Profil', () => {
    expect(resolveEffectiveInboxPackageId({ apiPackageId: PKG2 })).toBe(PKG2)
  })

  it('direkter Snapshot-Roundtrip (parseActiveProfileSnapshot)', () => {
    writeRegistryState({
      activeProfileId: 'fw',
      activeProfileSnapshot: { id: 'fw', label: 'Feuerwehr', resolved: true, packageId: PKG, mailboxId: MB },
      userProfiles: [],
    })
    expect(readActiveProfileSnapshot()?.packageId).toBe(PKG)
    expect(resolveEffectiveInboxPackageId({ apiPackageId: PKG })).toBe(PKG)
    expect(resolveEffectiveInboxPackageId({ apiPackageId: PKG2 })).toBe(PKG2)
  })
})

describe('setActiveProfile snapshot (H.24 Adoption)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('persistiert activeProfileSnapshot', () => {
    const combined = [profile({ id: 'fw', label: 'Feuerwehr', packageId: PKG, mailboxId: MB })]
    const res = setActiveProfile({ userProfiles: [] }, 'fw', combined)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    writeRegistryState(res.state)
    expect(readActiveProfileSnapshot()?.label).toBe('Feuerwehr')
    expect(readActiveProfileSnapshot()?.packageId).toBe(PKG)
  })
})
