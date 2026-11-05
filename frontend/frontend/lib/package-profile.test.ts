import { describe, expect, it } from 'vitest'
import {
  packageMailboxMap,
  parsePackageProfile,
  parsePackageProfilesManifest,
  resolvedPackageProfiles,
} from '@/frontend/lib/package-profile'

const PKG = '0x' + 'a'.repeat(64)
const MB = '0x' + 'b'.repeat(64)
const PKG2 = '0x' + 'c'.repeat(64)
const MB2 = '0x' + 'd'.repeat(64)

describe('parsePackageProfile (H.24b P0)', () => {
  it('nimmt gültiges Profil mit hex64-IDs an und markiert resolved', () => {
    const p = parsePackageProfile({
      id: 'katastrophenschutz',
      label: 'Katastrophenschutz',
      packageId: PKG,
      mailboxId: MB,
      color: '#b45309',
      bundled: true,
      readOnly: true,
    })
    expect(p).not.toBeNull()
    expect(p?.resolved).toBe(true)
    expect(p?.packageId).toBe(PKG)
    expect(p?.mailboxId).toBe(MB)
    expect(p?.bundled).toBe(true)
    expect(p?.readOnly).toBe(true)
  })

  it('REPLACE_-Platzhalter → resolved=false, IDs bleiben leer', () => {
    const p = parsePackageProfile({
      id: 'training',
      label: 'Training',
      packageId: 'REPLACE_PACKAGE_ID',
      mailboxId: 'REPLACE_MAILBOX_ID',
      bundled: true,
      readOnly: true,
    })
    expect(p).not.toBeNull()
    expect(p?.resolved).toBe(false)
    expect(p?.packageId).toBeUndefined()
    expect(p?.mailboxId).toBeUndefined()
  })

  it('verwirft Einträge ohne id oder label', () => {
    expect(parsePackageProfile({ label: 'Ohne id' })).toBeNull()
    expect(parsePackageProfile({ id: 'x' })).toBeNull()
    expect(parsePackageProfile({ id: 'bad id!', label: 'Slug ungültig' })).toBeNull()
    expect(parsePackageProfile(null)).toBeNull()
    expect(parsePackageProfile('nope')).toBeNull()
  })

  it('normalisiert packageId/mailboxId auf lowercase, filtert ungültige URLs', () => {
    const p = parsePackageProfile({
      id: 'fw',
      label: 'Feuerwehr',
      packageId: PKG.toUpperCase(),
      mailboxId: MB,
      rpcUrl: 'https://api.testnet.iota.cafe',
      apiBaseUrl: 'nicht-eine-url',
    })
    expect(p?.packageId).toBe(PKG)
    expect(p?.rpcUrl).toBe('https://api.testnet.iota.cafe')
    expect(p?.apiBaseUrl).toBeUndefined()
  })

  it('resolved nur wenn packageId UND mailboxId gültig', () => {
    const p = parsePackageProfile({ id: 'halb', label: 'Halb', packageId: PKG })
    expect(p?.resolved).toBe(false)
  })
})

describe('parsePackageProfilesManifest (H.24b P0)', () => {
  it('parst Version, meta und gültige Profile; dedupliziert nach id', () => {
    const m = parsePackageProfilesManifest({
      version: 1,
      meta: { title: 'Vorlage', description: 'Test' },
      profiles: [
        { id: 'a', label: 'A', packageId: PKG, mailboxId: MB },
        { id: 'A', label: 'A-Dup', packageId: PKG2, mailboxId: MB2 },
        { id: 'b', label: 'B', packageId: 'REPLACE_PACKAGE_ID' },
        { label: 'kaputt' },
      ],
    })
    expect(m.version).toBe(1)
    expect(m.meta?.title).toBe('Vorlage')
    expect(m.profiles.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('robust gegen Müll-Eingaben', () => {
    expect(parsePackageProfilesManifest(null).profiles).toEqual([])
    expect(parsePackageProfilesManifest({}).version).toBe(0)
    expect(parsePackageProfilesManifest({ profiles: 'nope' }).profiles).toEqual([])
  })

  it('resolvedPackageProfiles + packageMailboxMap liefern nur einsatzbereite', () => {
    const m = parsePackageProfilesManifest({
      version: 1,
      profiles: [
        { id: 'a', label: 'A', packageId: PKG, mailboxId: MB },
        { id: 'b', label: 'B', packageId: 'REPLACE_PACKAGE_ID', mailboxId: 'REPLACE_MAILBOX_ID' },
      ],
    })
    expect(resolvedPackageProfiles(m.profiles).map((p) => p.id)).toEqual(['a'])
    expect(packageMailboxMap(m.profiles)).toEqual({ [PKG]: MB })
  })
})
