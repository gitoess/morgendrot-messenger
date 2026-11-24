import { describe, it, expect, beforeEach } from 'vitest'
import {
  filterMeshtasticRadioChannels,
  filterMeshtasticVisibleNodes,
  loadCachedMeshtasticRadioChannels,
  loadCachedMeshtasticVisibleNodes,
  saveCachedMeshtasticRadioChannels,
  saveCachedMeshtasticVisibleNodes,
} from '@/frontend/lib/meshtastic-mesh-cache'

describe('meshtastic-mesh-cache', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('persistiert und lädt Nodes', () => {
    saveCachedMeshtasticVisibleNodes([
      { nodeNum: 1, nodeId: '!1', longName: 'Heltec B', shortName: 'c0cc' },
    ])
    expect(loadCachedMeshtasticVisibleNodes()).toHaveLength(1)
    expect(loadCachedMeshtasticVisibleNodes()[0].shortName).toBe('c0cc')
  })

  it('filtert Nodes und Kanäle', () => {
    const nodes = [
      { nodeNum: 1, nodeId: '!9eecc0cc', longName: 'Meshtastic c0cc', shortName: 'c0cc' },
      { nodeNum: 2, nodeId: '!abc', longName: 'Other', shortName: 'othr' },
    ]
    expect(filterMeshtasticVisibleNodes(nodes, 'c0cc')).toHaveLength(1)
    expect(filterMeshtasticVisibleNodes(nodes, '!abc')).toHaveLength(1)

    const ch = [
      { index: 0, name: 'LongFast', role: 'primary' as const, hasPsk: true },
      { index: 2, name: 'Freiraum', role: 'secondary' as const, hasPsk: true },
    ]
    expect(filterMeshtasticRadioChannels(ch, 'frei')).toHaveLength(1)
    saveCachedMeshtasticRadioChannels(ch)
    expect(loadCachedMeshtasticRadioChannels().map((c) => c.name)).toContain('Freiraum')
  })
})
