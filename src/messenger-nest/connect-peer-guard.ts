import { normalizeAddress } from '../utils.js'

export type ConnectPeerGuardInput = {
  myAddress: string
  /** Explizite /connect 0x… — sonst Default-Partnerliste. */
  connectAddr?: string | null
  /** Aktuelle Session-Peers (Keys = Adressen). */
  peerAddresses: Iterable<string>
}

export type ConnectPeerGuardResult =
  | { action: 'proceed'; targetAddrs: string[] }
  | { action: 'already'; message: string }
  | { action: 'reject'; message: string }

/**
 * /connect-Guard: „Bereits verbunden“ nur für denselben Peer — nicht für andere Adressen.
 * Selbst-Connect ablehnen; Self-Einträge in peerMap ignorieren.
 */
export function evaluateConnectPeerGuard(input: ConnectPeerGuardInput): ConnectPeerGuardResult {
  const me = normalizeAddress(input.myAddress || '')
  const peers = new Set(
    [...input.peerAddresses].map((a) => normalizeAddress(a)).filter((a) => a && a !== me)
  )
  const raw = (input.connectAddr || '').trim()
  const target = raw.startsWith('0x') ? normalizeAddress(raw) : ''

  if (target) {
    if (target === me) {
      return { action: 'reject', message: 'Connect an die eigene Adresse ist ungültig.' }
    }
    if (peers.has(target)) {
      return {
        action: 'already',
        message: `Bereits verbunden mit ${target.slice(0, 12)}…`,
      }
    }
    return { action: 'proceed', targetAddrs: [target] }
  }

  if (peers.size > 0) {
    return { action: 'already', message: 'Bereits verbunden.' }
  }
  return { action: 'proceed', targetAddrs: [] }
}

/** Merge neuer Connect-Peers in bestehende Map (ohne Self). */
export function mergePeerMaps<T>(
  myAddress: string,
  existing: Map<string, T> | null | undefined,
  incoming: Map<string, T>
): Map<string, T> {
  const me = normalizeAddress(myAddress || '')
  const out = new Map<string, T>()
  for (const [k, v] of existing || []) {
    if (normalizeAddress(k) !== me) out.set(normalizeAddress(k), v)
  }
  for (const [k, v] of incoming) {
    const n = normalizeAddress(k)
    if (n && n !== me) out.set(n, v)
  }
  return out
}
