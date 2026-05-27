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
  it('messenger tile set: chat + vault (+ einsatzleitung für Kommandant)', () => {
    const boss = { workspaceTileSet: 'messenger' as const, liteMessengerFromApi: true, isBossRole: true, role: 'boss' }
    expect(projectTypeVisibleInMessengerWorkspace('chat', boss)).toBe(true)
    expect(projectTypeVisibleInMessengerWorkspace('vault', boss)).toBe(true)
    expect(projectTypeVisibleInMessengerWorkspace('einsatzleitung', boss)).toBe(true)
    expect(projectTypeVisibleInMessengerWorkspace('boss', boss)).toBe(false)

    const kom = { workspaceTileSet: 'messenger' as const, liteMessengerFromApi: true, isBossRole: false, role: 'kommandant' }
    expect(projectTypeVisibleInMessengerWorkspace('einsatzleitung', kom)).toBe(true)
    expect(projectTypeVisibleInMessengerWorkspace('boss', kom)).toBe(false)

    const arbeiter = { workspaceTileSet: 'messenger' as const, liteMessengerFromApi: true, isBossRole: false, role: 'arbeiter' }
    expect(projectTypeVisibleInMessengerWorkspace('einsatzleitung', arbeiter)).toBe(false)
  })

  it('full + lite messenger + boss: chat, vault, boss, einsatzleitung', () => {
    const p = { workspaceTileSet: 'full' as const, liteMessengerFromApi: true, isBossRole: true, role: 'boss' }
    expect(projectTypeVisibleInMessengerWorkspace('boss', p)).toBe(true)
    expect(projectTypeVisibleInMessengerWorkspace('einsatzleitung', p)).toBe(true)
    expect(projectTypeVisibleInMessengerWorkspace('lock', p)).toBe(false)
  })

  it('full + lite messenger + kommandant: einsatzleitung, kein boss', () => {
    const p = { workspaceTileSet: 'full' as const, liteMessengerFromApi: true, isBossRole: false, role: 'kommandant' }
    expect(projectTypeVisibleInMessengerWorkspace('einsatzleitung', p)).toBe(true)
    expect(projectTypeVisibleInMessengerWorkspace('boss', p)).toBe(false)
  })

  it('full + kein lite messenger: alle Typen', () => {
    const p = { workspaceTileSet: 'full' as const, liteMessengerFromApi: false, isBossRole: false, role: 'arbeiter' }
    expect(projectTypeVisibleInMessengerWorkspace('monitor', p)).toBe(true)
    expect(projectTypeVisibleInMessengerWorkspace('einsatzleitung', p)).toBe(false)
  })
})

describe('shouldShowWorkerActionCenter', () => {
  it('Messenger-Arbeiter: kein Action Center', () => {
    expect(
      shouldShowWorkerActionCenter({ role: 'arbeiter', showAllTiles: false, liteMessengerFromApi: true })
    ).toBe(false)
  })

  it('Volldashboard-Arbeiter ohne Kacheln: Action Center', () => {
    expect(
      shouldShowWorkerActionCenter({ role: 'arbeiter', showAllTiles: false, liteMessengerFromApi: false })
    ).toBe(true)
  })
})

describe('filterFeaturesByMessengerWorkspaceTileSet', () => {
  it('filtert konsistent für Boss lite', () => {
    const p = { workspaceTileSet: 'full' as const, liteMessengerFromApi: true, isBossRole: true, role: 'boss' }
    const out = filterFeaturesByMessengerWorkspaceTileSet(rows, p)
    expect(out.map((x) => x.id).sort()).toEqual(['boss', 'chat', 'einsatzleitung', 'vault'])
  })
})
