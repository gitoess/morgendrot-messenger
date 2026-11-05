'use client'

import { OFFLINE_CACHE_TTL_MS } from '@/frontend/lib/offline-cache-ttl'
import { readScoped, writeScoped } from '@/frontend/lib/package-profile-namespace'

const LS_KEY = 'morgendrot.connectedPeersSnapshot.v1'
const PEER_MAP_DOMAIN = 'peerMap'

export type ConnectedPeersSnapshot = {
  addresses: string[]
  savedAtMs: number
}

function normalizeAddr(a: string): string {
  const t = String(a || '').trim().toLowerCase()
  return /^0x[a-f0-9]{64}$/.test(t) ? t : ''
}

export function persistConnectedPeersSnapshot(addresses: string[]): void {
  if (typeof window === 'undefined') return
  const list = [...new Set(addresses.map(normalizeAddr).filter(Boolean))]
  try {
    const payload: ConnectedPeersSnapshot = { addresses: list, savedAtMs: Date.now() }
    writeScoped(PEER_MAP_DOMAIN, LS_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

export function readConnectedPeersSnapshot(
  nowMs: number = Date.now()
): { addresses: string[]; ageMinutes: number } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = readScoped(PEER_MAP_DOMAIN, LS_KEY)?.trim()
    if (!raw) return null
    const j = JSON.parse(raw) as Partial<ConnectedPeersSnapshot>
    const savedAtMs = Number(j.savedAtMs ?? 0)
    if (!Number.isFinite(savedAtMs) || savedAtMs <= 0) return null
    const ageMs = nowMs - savedAtMs
    if (ageMs < 0 || ageMs > OFFLINE_CACHE_TTL_MS) return null
    const addresses = Array.isArray(j.addresses)
      ? [...new Set(j.addresses.map((a) => normalizeAddr(String(a))).filter(Boolean))]
      : []
    return { addresses, ageMinutes: Math.floor(ageMs / 60_000) }
  } catch {
    return null
  }
}

/** Status-Liste oder letzter Snapshot (§ H.15 B.2). */
/** Partner lokal als „verbunden“ merken (§ H.15 B.2 — ohne Server-peerMap). */
export function addConnectedPeerToLocalSnapshot(peerAddress: string): void {
  const addr = normalizeAddr(peerAddress)
  if (!addr) return
  const cached = readConnectedPeersSnapshot()
  const merged = [...new Set([...(cached?.addresses ?? []), addr])]
  persistConnectedPeersSnapshot(merged)
}

export function resolveConnectedAddresses(opts: {
  fromStatus?: string[] | null
  preferCacheWhenEmpty?: boolean
}): { addresses: string[]; fromCache: boolean } {
  const fromStatus = [...new Set((opts.fromStatus ?? []).map(normalizeAddr).filter(Boolean))]
  if (fromStatus.length > 0) return { addresses: fromStatus, fromCache: false }
  if (!opts.preferCacheWhenEmpty) return { addresses: [], fromCache: false }
  const cached = readConnectedPeersSnapshot()
  if (!cached) return { addresses: [], fromCache: false }
  return { addresses: cached.addresses, fromCache: true }
}
