import { beforeEach, describe, expect, it } from 'vitest'
import {
  GLOBAL_PROFILE_NAMESPACE,
  isPerProfileDomain,
  namespacedKey,
  profileNamespaceToken,
  readScoped,
  removeScoped,
  scopedKey,
  scopeForDomain,
  writeScoped,
} from '@/frontend/lib/package-profile-namespace'
import { writeRegistryState } from '@/frontend/lib/package-profile-registry'

describe('scope classification (H.24b P3)', () => {
  it('Telefonbuch/Kontakte global, Mailboxes/Handshakes pro Profil', () => {
    expect(scopeForDomain('telefonbuch')).toBe('global')
    expect(scopeForDomain('contacts')).toBe('global')
    expect(scopeForDomain('contactMailboxSlots')).toBe('per-profile')
    expect(scopeForDomain('privateMailboxes')).toBe('per-profile')
    expect(scopeForDomain('handshakes')).toBe('per-profile')
    expect(isPerProfileDomain('inbox')).toBe(true)
    expect(isPerProfileDomain('unbekannt')).toBe(true)
  })
})

describe('key building (H.24b P3)', () => {
  it('ohne Profil bleibt der Basis-Key unverändert (rückwärtskompatibel)', () => {
    expect(profileNamespaceToken(undefined)).toBe(GLOBAL_PROFILE_NAMESPACE)
    expect(namespacedKey('morg.mailboxes')).toBe('morg.mailboxes')
    expect(namespacedKey('morg.mailboxes', GLOBAL_PROFILE_NAMESPACE)).toBe('morg.mailboxes')
  })

  it('mit Profil wird der Key genamespaced (lowercase)', () => {
    expect(namespacedKey('morg.mailboxes', 'Katastrophenschutz')).toBe('morg.mailboxes::einsatz=katastrophenschutz')
  })
})

describe('scopedKey + scoped storage (H.24b P3)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('global-Domäne ignoriert aktives Profil', () => {
    writeRegistryState({ activeProfileId: 'sek', userProfiles: [] })
    expect(scopedKey('telefonbuch', 'morg.contacts')).toBe('morg.contacts')
  })

  it('per-profile-Domäne nutzt aktives Profil', () => {
    writeRegistryState({ activeProfileId: 'sek', userProfiles: [] })
    expect(scopedKey('privateMailboxes', 'morg.mb')).toBe('morg.mb::einsatz=sek')
  })

  it('readScoped/writeScoped/removeScoped trennen nach Profil', () => {
    writeRegistryState({ activeProfileId: 'a', userProfiles: [] })
    writeScoped('privateMailboxes', 'morg.mb', 'wert-a')
    writeRegistryState({ activeProfileId: 'b', userProfiles: [] })
    writeScoped('privateMailboxes', 'morg.mb', 'wert-b')

    writeRegistryState({ activeProfileId: 'a', userProfiles: [] })
    expect(readScoped('privateMailboxes', 'morg.mb')).toBe('wert-a')
    writeRegistryState({ activeProfileId: 'b', userProfiles: [] })
    expect(readScoped('privateMailboxes', 'morg.mb')).toBe('wert-b')

    removeScoped('privateMailboxes', 'morg.mb')
    expect(readScoped('privateMailboxes', 'morg.mb')).toBeNull()
    writeRegistryState({ activeProfileId: 'a', userProfiles: [] })
    expect(readScoped('privateMailboxes', 'morg.mb')).toBe('wert-a')
  })
})
