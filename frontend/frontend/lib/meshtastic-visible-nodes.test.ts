import { describe, it, expect } from 'vitest'
import {
  isUsableMeshtasticNodeNum,
  meshtasticVisibleNodeLabel,
  parseMeshtasticVisibleNode,
  upsertMeshtasticVisibleNode,
} from '@/frontend/lib/meshtastic-visible-nodes'

describe('meshtastic-visible-nodes', () => {
  it('lehnt nodeNum 0 ab (mesh:!0)', () => {
    expect(isUsableMeshtasticNodeNum(0)).toBe(false)
    expect(parseMeshtasticVisibleNode({ num: 0, user: { longName: 'x' } })).toBeNull()
  })

  it('parst NodeInfo mit user', () => {
    const n = parseMeshtasticVisibleNode({
      num: 0x9eecc0cc,
      user: { id: '!9eecc0cc', longName: 'Meshtastic c0cc', shortName: 'c0cc' },
    })
    expect(n).toEqual({
      nodeNum: 0x9eecc0cc,
      nodeId: '!9eecc0cc',
      longName: 'Meshtastic c0cc',
      shortName: 'c0cc',
    })
    expect(meshtasticVisibleNodeLabel(n!)).toMatch(/c0cc/)
  })

  it('upsert ersetzt gleiche Node', () => {
    const a = parseMeshtasticVisibleNode({ num: 1, user: { longName: 'A' } })!
    const b = parseMeshtasticVisibleNode({ num: 1, user: { longName: 'B' } })!
    const list = upsertMeshtasticVisibleNode([a], b)
    expect(list).toHaveLength(1)
    expect(list[0].longName).toBe('B')
  })
})
