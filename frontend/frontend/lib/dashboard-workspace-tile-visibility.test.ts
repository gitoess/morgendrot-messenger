import { describe, expect, it } from 'vitest'
import {
  filterFeaturesByMessengerWorkspaceTileSet,
  projectTypeVisibleInMessengerWorkspace,
  shouldShowWorkerActionCenter,
} from '@/frontend/lib/dashboard-workspace-tile-visibility'

const rows = [
  { id: 'chat' as const, n: 1 },
  { id: 'vault' as const, n: 2 },
  { id: 'einsatzleitung' as const, n: 3 },
  { id: 'boss' as const, n: 4 },
  { id: 'lock' as const, n: 5 },
  { id: 'monitor' as const, n: 6 },
]

describe('projectTypeVisibleInMessengerWorkspace', () => {
  it('Messenger-Produkt: chat; Boss + Steuerung; Kommandant + Einsatzleitung', () => {
    const boss = { workspaceTileSet: 'messenger' as const, liteMessengerFromApi: true, isBossRole: true, role: 'boss' }
    expect(projectTypeVisibleInMessengerWorkspace('chat', boss)).toBe(true)
    expect(projectTypeVisibleInMessengerWorkspace('vault', boss)).toBe(false)
    expect(projectTypeVisibleInMessengerWorkspace('einsatzleitung', boss)).toBe(true)
    expect(projectTypeVisibleInMessengerWorkspace('boss', boss)).toBe(true)
    expect(projectTypeVisibleInMessengerWorkspace('lock', boss)).toBe(false)
    expect(projectTypeVisibleInMessengerWorkspace('monitor', boss)).toBe(false)

    const kom = { workspaceTileSet: 'messenger' as const, liteMessengerFromApi: true, isBossRole: false, role: 'kommandant' }
    expect(projectTypeVisibleInMessengerWorkspace('einsatzleitung', kom)).toBe(true)
    expect(projectTypeVisibleInMessengerWorkspace('boss', kom)).toBe(false)

    const arbeiter = { workspaceTileSet: 'messenger' as const, liteMessengerFromApi: true, isBossRole: false, role: 'arbeiter' }
    expect(projectTypeVisibleInMessengerWorkspace('einsatzleitung', arbeiter)).toBe(false)
    expect(projectTypeVisibleInMessengerWorkspace('lock', arbeiter)).toBe(false)
  })

  it('Messenger-Produkt: gespeichertes full in localStorage ändert nichts', () => {
    const p = { workspaceTileSet: 'full' as const, liteMessengerFromApi: true, isBossRole: true, role: 'boss' }
    expect(projectTypeVisibleInMessengerWorkspace('lock', p)).toBe(false)
    expect(projectTypeVisibleInMessengerWorkspace('boss', p)).toBe(true)
  })

  it('Morgendrot Projekt + full: alle Kacheltypen für Arbeiter', () => {
    const p = { workspaceTileSet: 'full' as const, liteMessengerFromApi: false, isBossRole: false, role: 'arbeiter' }
    expect(projectTypeVisibleInMessengerWorkspace('monitor', p)).toBe(true)
    expect(projectTypeVisibleInMessengerWorkspace('einsatzleitung', p)).toBe(false)
  })

  it('Morgendrot Projekt + Messenger-Vorschau: nur chat', () => {
    const p = { workspaceTileSet: 'messenger' as const, liteMessengerFromApi: false, isBossRole: true, role: 'boss' }
    expect(projectTypeVisibleInMessengerWorkspace('chat', p)).toBe(true)
    expect(projectTypeVisibleInMessengerWorkspace('vault', p)).toBe(false)
    expect(projectTypeVisibleInMessengerWorkspace('boss', p)).toBe(false)
    expect(projectTypeVisibleInMessengerWorkspace('lock', p)).toBe(false)
  })
})

describe('shouldShowWorkerActionCenter', () => {
  it('Messenger-Produkt: kein Action Center', () => {
    expect(
      shouldShowWorkerActionCenter({ role: 'arbeiter', showAllTiles: false, liteMessengerFromApi: true })
    ).toBe(false)
  })

  it('Morgendrot Projekt: Action Center für Arbeiter', () => {
    expect(
      shouldShowWorkerActionCenter({ role: 'arbeiter', showAllTiles: false, liteMessengerFromApi: false })
    ).toBe(true)
  })
})

describe('filterFeaturesByMessengerWorkspaceTileSet', () => {
  it('Messenger-Produkt Boss: kein lock/monitor', () => {
    const p = { workspaceTileSet: 'full' as const, liteMessengerFromApi: true, isBossRole: true, role: 'boss' }
    const out = filterFeaturesByMessengerWorkspaceTileSet(rows, p)
    expect(out.map((x) => x.id).sort()).toEqual(['boss', 'chat', 'einsatzleitung'])
  })
})
