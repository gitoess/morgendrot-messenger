/**
 * Lokaler Cache sichtbarer Nodes/Kanäle — überlebt Browser-Reload,
 * bis das Radio nach `configure()` wieder NodeInfo/Channel liefert.
 */

import type { MeshtasticVisibleNode } from '@/frontend/lib/meshtastic-visible-nodes'
import type { MeshtasticRadioChannel } from '@/frontend/lib/meshtastic-radio-channels'

const NODES_KEY = 'morgendrot.meshtastic.visibleNodes.v1'
const CHANNELS_KEY = 'morgendrot.meshtastic.radioChannels.v1'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

type CacheEnvelope<T> = { savedAt: number; items: T[] }

function readCache<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CacheEnvelope<T>
    if (!parsed || !Array.isArray(parsed.items)) return []
    if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > MAX_AGE_MS) return []
    return parsed.items
  } catch {
    return []
  }
}

function writeCache<T>(key: string, items: T[]): void {
  if (typeof window === 'undefined') return
  try {
    const envelope: CacheEnvelope<T> = { savedAt: Date.now(), items }
    window.localStorage.setItem(key, JSON.stringify(envelope))
  } catch {
    /* Quota / private mode */
  }
}

export function loadCachedMeshtasticVisibleNodes(): MeshtasticVisibleNode[] {
  return readCache<MeshtasticVisibleNode>(NODES_KEY).filter(
    (n) => n && typeof n.nodeNum === 'number' && n.nodeNum > 0 && typeof n.nodeId === 'string'
  )
}

export function saveCachedMeshtasticVisibleNodes(nodes: readonly MeshtasticVisibleNode[]): void {
  writeCache(NODES_KEY, [...nodes].slice(0, 128))
}

export function loadCachedMeshtasticRadioChannels(): MeshtasticRadioChannel[] {
  return readCache<MeshtasticRadioChannel>(CHANNELS_KEY).filter(
    (c) => c && typeof c.index === 'number' && c.index >= 0 && c.index <= 7
  )
}

export function saveCachedMeshtasticRadioChannels(channels: readonly MeshtasticRadioChannel[]): void {
  writeCache(CHANNELS_KEY, [...channels])
}

export function filterMeshtasticVisibleNodes(
  nodes: readonly MeshtasticVisibleNode[],
  query: string
): MeshtasticVisibleNode[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...nodes]
  return nodes.filter((n) => {
    const hay = `${n.nodeId} ${n.longName} ${n.shortName}`.toLowerCase()
    return hay.includes(q)
  })
}

export function filterMeshtasticRadioChannels(
  channels: readonly MeshtasticRadioChannel[],
  query: string
): MeshtasticRadioChannel[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...channels]
  return channels.filter((c) => {
    const hay = `${c.index} ${c.name} ${c.role}`.toLowerCase()
    return hay.includes(q)
  })
}
