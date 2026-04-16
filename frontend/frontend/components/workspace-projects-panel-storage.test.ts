import { afterEach, describe, expect, it } from 'vitest'
import { readWorkspaceTileSet, writeWorkspaceTileSet } from './workspace-projects-panel'

describe('workspace tile set (localStorage)', () => {
  afterEach(() => {
    localStorage.removeItem('morgendrot_workspace_tile_set')
  })

  it('readWorkspaceTileSet: default full', () => {
    expect(readWorkspaceTileSet()).toBe('full')
  })

  it('readWorkspaceTileSet: messenger', () => {
    localStorage.setItem('morgendrot_workspace_tile_set', 'messenger')
    expect(readWorkspaceTileSet()).toBe('messenger')
  })

  it('readWorkspaceTileSet: unbekannter Wert → full', () => {
    localStorage.setItem('morgendrot_workspace_tile_set', 'other')
    expect(readWorkspaceTileSet()).toBe('full')
  })

  it('writeWorkspaceTileSet', () => {
    writeWorkspaceTileSet('messenger')
    expect(localStorage.getItem('morgendrot_workspace_tile_set')).toBe('messenger')
    writeWorkspaceTileSet('full')
    expect(localStorage.getItem('morgendrot_workspace_tile_set')).toBe('full')
  })
})
