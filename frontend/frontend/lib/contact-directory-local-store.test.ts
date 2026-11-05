import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  mergeContactEntryIntoDirectory,
  readPersistentContactDirectory,
  saveContactEntryToLocalStore,
  shouldPersistContactsLocallyOnly,
} from '@/frontend/lib/contact-directory-local-store'

const WALLET = `0x${'a'.repeat(64)}`

vi.mock('@/frontend/lib/capacitor-platform', () => ({
  isCapacitorNativePlatform: () => true,
}))

vi.mock('@/frontend/lib/standalone-device-mode', () => ({
  isStandaloneMessengerWithoutBasis: () => true,
}))

vi.mock('@/frontend/lib/api/api-base', () => ({
  getApiBase: () => '',
}))

describe('contact-directory-local-store', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('shouldPersistContactsLocallyOnly auf native ohne Basis', () => {
    expect(shouldPersistContactsLocallyOnly()).toBe(true)
  })

  it('speichert und liest Kontakt lokal', () => {
    const r = saveContactEntryToLocalStore({
      address: WALLET,
      label: 'Anna',
      meshNodeId: '!abc123',
    })
    expect(r.ok).toBe(true)
    const dir = readPersistentContactDirectory()
    expect(dir[WALLET]?.label).toBe('Anna')
    expect(dir[WALLET]?.meshNodeId).toBe('!abc123')
  })

  it('aktualisiert bestehenden Eintrag', () => {
    saveContactEntryToLocalStore({ address: WALLET, label: 'Alt' })
    saveContactEntryToLocalStore({ address: WALLET, label: 'Neu', mailboxPrivateId: `0x${'b'.repeat(64)}` })
    const dir = readPersistentContactDirectory()
    expect(dir[WALLET]?.label).toBe('Neu')
    expect(dir[WALLET]?.mailboxPrivateId).toBe(`0x${'b'.repeat(64)}`)
  })

  it('clearMesh setzt minimalen Eintrag', () => {
    saveContactEntryToLocalStore({ address: WALLET, label: 'Voll', meshNodeId: 'x' })
    const merged = mergeContactEntryIntoDirectory(readPersistentContactDirectory(), {
      address: WALLET,
      clearMesh: true,
      label: 'Partner',
    })
    expect(merged[WALLET]).toEqual({ label: 'Partner' })
  })
})
