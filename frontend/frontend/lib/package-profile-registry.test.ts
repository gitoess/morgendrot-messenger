import { describe, expect, it } from 'vitest'
import type { PackageProfile } from '@/frontend/lib/package-profile'
import {
  activeProfile,
  addUserProfile,
  buildSwitchWarning,
  combineProfiles,
  defaultRegistryState,
  removeUserProfile,
  setActiveProfile,
  shortPackageId,
} from '@/frontend/lib/package-profile-registry'

const PKG = '0x' + 'a'.repeat(64)
const MB = '0x' + 'b'.repeat(64)
const PKG2 = '0x' + 'c'.repeat(64)
const MB2 = '0x' + 'd'.repeat(64)

function profile(over: Partial<PackageProfile> & { id: string; label: string }): PackageProfile {
  return {
    bundled: false,
    readOnly: false,
    resolved: Boolean(over.packageId && over.mailboxId),
    ...over,
  }
}

const bundled: PackageProfile[] = [
  profile({ id: 'katastrophenschutz', label: 'Katastrophenschutz', packageId: PKG, mailboxId: MB, bundled: true, readOnly: true, resolved: true }),
]

describe('combineProfiles (H.24b P1b)', () => {
  it('bundled zuerst, dann user; bundled bleibt read-only', () => {
    const state = { userProfiles: [profile({ id: 'sek', label: 'SEK', packageId: PKG2, mailboxId: MB2, resolved: true })] }
    const combined = combineProfiles(bundled, state)
    expect(combined.map((p) => p.id)).toEqual(['katastrophenschutz', 'sek'])
    expect(combined[0].bundled).toBe(true)
    expect(combined[0].readOnly).toBe(true)
    expect(combined[1].bundled).toBe(false)
  })

  it('bundled gewinnt bei id-Kollision (user verworfen)', () => {
    const state = { userProfiles: [profile({ id: 'Katastrophenschutz', label: 'Fake', packageId: PKG2, mailboxId: MB2, resolved: true })] }
    const combined = combineProfiles(bundled, state)
    expect(combined).toHaveLength(1)
    expect(combined[0].label).toBe('Katastrophenschutz')
  })
})

describe('addUserProfile (H.24b P1b)', () => {
  it('legt gültiges Profil an und erzwingt bundled:false/readOnly:false', () => {
    const res = addUserProfile(defaultRegistryState(), {
      id: 'sek',
      label: 'SEK',
      packageId: PKG2,
      mailboxId: MB2,
      bundled: true,
      readOnly: true,
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.state.userProfiles).toHaveLength(1)
    expect(res.state.userProfiles[0].bundled).toBe(false)
    expect(res.state.userProfiles[0].readOnly).toBe(false)
  })

  it('lehnt ungültige Eingabe ab', () => {
    const res = addUserProfile(defaultRegistryState(), { label: 'kein id' })
    expect(res.ok).toBe(false)
  })

  it('schützt Bundle-ids vor Überschreiben', () => {
    const res = addUserProfile(defaultRegistryState(), { id: 'katastrophenschutz', label: 'x' }, { bundledIds: ['katastrophenschutz'] })
    expect(res.ok).toBe(false)
  })

  it('ersetzt vorhandenes user-Profil mit gleicher id', () => {
    const s1 = addUserProfile(defaultRegistryState(), { id: 'sek', label: 'Alt' })
    expect(s1.ok).toBe(true)
    if (!s1.ok) return
    const s2 = addUserProfile(s1.state, { id: 'sek', label: 'Neu' })
    expect(s2.ok).toBe(true)
    if (!s2.ok) return
    expect(s2.state.userProfiles).toHaveLength(1)
    expect(s2.state.userProfiles[0].label).toBe('Neu')
  })
})

describe('active profile handling (H.24b P1b)', () => {
  const combined = combineProfiles(bundled, {
    userProfiles: [profile({ id: 'sek', label: 'SEK', packageId: PKG2, mailboxId: MB2, resolved: true })],
  })

  it('setActiveProfile nur für existierende id', () => {
    const ok = setActiveProfile({ userProfiles: [] }, 'sek', combined)
    expect(ok.ok).toBe(true)
    if (ok.ok) {
      expect(ok.state.activeProfileId).toBe('sek')
      expect(ok.state.activeProfileSnapshot?.label).toBe('SEK')
    }
    const bad = setActiveProfile({ userProfiles: [] }, 'gibtsnicht', combined)
    expect(bad.ok).toBe(false)
  })

  it('activeProfile löst korrekt auf', () => {
    expect(activeProfile(combined, { activeProfileId: 'sek', userProfiles: [] })?.label).toBe('SEK')
    expect(activeProfile(combined, { activeProfileId: 'weg', userProfiles: [] })).toBeUndefined()
    expect(activeProfile(combined, { userProfiles: [] })).toBeUndefined()
  })

  it('removeUserProfile entfernt und leert aktive id', () => {
    const state = { activeProfileId: 'sek', userProfiles: [profile({ id: 'sek', label: 'SEK' })] }
    const out = removeUserProfile(state, 'sek')
    expect(out.userProfiles).toHaveLength(0)
    expect(out.activeProfileId).toBeUndefined()
  })
})

describe('shortPackageId + buildSwitchWarning (H.24b P1b)', () => {
  it('kürzt gültige hex64 und meldet fehlende Konfiguration', () => {
    expect(shortPackageId(PKG)).toBe(`0xaaaa…aaaa`)
    expect(shortPackageId(undefined)).toBe('— (nicht konfiguriert)')
    expect(shortPackageId('REPLACE_PACKAGE_ID')).toBe('— (nicht konfiguriert)')
  })

  it('warnt mit Ziel-Label und Pflichttext; markiert unresolved', () => {
    const w = buildSwitchWarning(profile({ id: 'sek', label: 'SEK', packageId: PKG2, mailboxId: MB2, resolved: true }))
    expect(w.title).toContain('Einsatz wechseln')
    expect(w.targetLine).toContain('SEK')
    expect(w.targetLine).toContain('0xcccc…cccc')
    expect(w.unresolved).toBe(false)
    expect(w.lines.length).toBeGreaterThanOrEqual(4)

    const wu = buildSwitchWarning(profile({ id: 'x', label: 'X' }))
    expect(wu.unresolved).toBe(true)
    expect(wu.lines.some((l) => l.includes('noch keine gültigen IDs'))).toBe(true)
  })
})
