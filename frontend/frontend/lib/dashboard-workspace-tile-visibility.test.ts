import { describe, expect, it } from 'vitest'
import {
  filterFeaturesByMessengerWorkspaceTileSet,
  projectTypeVisibleInMessengerWorkspace,
} from '@/frontend/lib/dashboard-workspace-tile-visibility'

const rows = [
  { id: 'chat' as const, n: 1 },
  { id: 'vault' as const, n: 2 },
  { id: 'boss' as const, n: 3 },
  { id: 'lock' as const, n: 4 },
  { id: 'monitor' as const, n: 5 },
]

describe('projectTypeVisibleInMessengerWorkspace', () => {
  it('messenger tile set: nur chat + vault', () => {
    const p = { workspaceTileSet: 'messenger' as const, liteMessengerFromApi: true, isBossRole: true }
    expect(projectTypeVisibleInMessengerWorkspace('chat', p)).toBe(true)
    expect(projectTypeVisibleInMessengerWorkspace('vault', p)).toBe(true)
    expect(projectTypeVisibleInMessengerWorkspace('boss', p)).toBe(false)
  })

  it('full + lite messenger + boss: chat, vault, boss', () => {
    const p = { workspaceTileSet: 'full' as const, liteMessengerFromApi: true, isBossRole: true }
    expect(projectTypeVisibleInMessengerWorkspace('boss', p)).toBe(true)
    expect(projectTypeVisibleInMessengerWorkspace('lock', p)).toBe(false)
  })

  it('full + lite messenger + nicht boss: alles (effectiveWorkspace erzwingt messenger — reine Funktion)', () => {
    const p = { workspaceTileSet: 'full' as const, liteMessengerFromApi: true, isBossRole: false }
    expect(projectTypeVisibleInMessengerWorkspace('lock', p)).toBe(true)
  })

  it('full + kein lite messenger: alle Typen', () => {
    const p = { workspaceTileSet: 'full' as const, liteMessengerFromApi: false, isBossRole: false }
    expect(projectTypeVisibleInMessengerWorkspace('monitor', p)).toBe(true)
  })
})

describe('filterFeaturesByMessengerWorkspaceTileSet', () => {
  it('filtert konsistent', () => {
    const p = { workspaceTileSet: 'full' as const, liteMessengerFromApi: true, isBossRole: true }
    const out = filterFeaturesByMessengerWorkspaceTileSet(rows, p)
    expect(out.map((x) => x.id).sort()).toEqual(['boss', 'chat', 'vault'])
  })
})
