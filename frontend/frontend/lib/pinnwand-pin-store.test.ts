import { beforeEach, describe, expect, it } from 'vitest'
import { readPinnedPinnwandIds, togglePinnedPinnwandId, writePinnedPinnwandIds } from './pinnwand-pin-store'

describe('pinnwand-pin-store', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('pinnt und entpinnt gültige IDs', () => {
    expect(togglePinnedPinnwandId('msg-1')).toBe(true)
    expect(readPinnedPinnwandIds().has('msg-1')).toBe(true)
    expect(togglePinnedPinnwandId('msg-1')).toBe(false)
    expect(readPinnedPinnwandIds().has('msg-1')).toBe(false)
  })

  it('lehnt unsichere IDs ab', () => {
    expect(togglePinnedPinnwandId('<script>')).toBe(false)
    expect(readPinnedPinnwandIds().size).toBe(0)
  })

  it('filtert korruptes JSON beim Lesen', () => {
    sessionStorage.setItem('morg.pinnwand.pinned.ids.v1', JSON.stringify(['ok-id', 42, '<x>']))
    const ids = readPinnedPinnwandIds()
    expect(ids.has('ok-id')).toBe(true)
    expect(ids.size).toBe(1)
  })

  it('begrenzt Schreiben auf 200 IDs', () => {
    const many = new Set(Array.from({ length: 250 }, (_, i) => `id-${i}`))
    writePinnedPinnwandIds(many)
    expect(readPinnedPinnwandIds().size).toBe(200)
  })
})
