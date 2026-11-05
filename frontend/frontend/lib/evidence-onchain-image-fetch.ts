'use client'

import { createDirectIotaClient } from '@morgendrot/core/iota'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import {
  fetchEvidenceImageByObjectId,
  fetchEvidenceImagesByOwner,
  type FetchEvidenceImageResult,
  type FetchEvidenceImagesByOwnerResult,
} from '@/frontend/lib/evidence-onchain-image'

const CAFE_TESTNET = 'https://api.testnet.iota.cafe'
const CAFE_MAINNET = 'https://api.mainnet.iota.cafe'

function requireDirectClient():
  | { ok: true; client: ReturnType<typeof createDirectIotaClient>; rpcUrl: string }
  | { ok: false; error: string } {
  const rpc = getConfiguredDirectIotaRpcUrl()
  if (!rpc) {
    return {
      ok: false,
      error: 'Keine Direkt-RPC-URL — in den Einstellungen/Puls „Direkt“ bzw. RPC setzen.',
    }
  }
  return { ok: true, client: createDirectIotaClient({ rpcUrl: rpc }), rpcUrl: rpc }
}

function rpcNetworkLabel(url: string): string {
  const u = url.toLowerCase()
  if (u.includes('testnet')) return 'Testnet'
  if (u.includes('mainnet')) return 'Mainnet'
  return url.replace(/^https?:\/\//, '').slice(0, 40)
}

/** Gegenstück Cafe-Testnet ↔ Cafe-Mainnet (für leere Besitzer-Galerie). */
export function alternateIotaCafeRpcUrl(rpcUrl: string): string | null {
  const u = rpcUrl.trim().toLowerCase()
  if (u.includes('testnet.iota.cafe') || u.includes('testnet')) {
    if (u.includes('api.testnet.iota.cafe')) return CAFE_MAINNET
    if (u.includes('testnet')) return CAFE_MAINNET
  }
  if (u.includes('mainnet.iota.cafe') || u.includes('mainnet')) {
    if (u.includes('api.mainnet.iota.cafe')) return CAFE_TESTNET
    if (u.includes('mainnet')) return CAFE_TESTNET
  }
  return null
}

/** Nur lesen — kein Signer nötig. */
export async function loadEvidenceImageFromObjectId(objectId: string): Promise<FetchEvidenceImageResult> {
  const c = requireDirectClient()
  if (!c.ok) return { ok: false, error: c.error }
  return fetchEvidenceImageByObjectId(c.client, objectId)
}

export async function loadEvidenceImagesByOwner(
  owner: string,
  opts?: { cursor?: string | null; limit?: number }
): Promise<FetchEvidenceImagesByOwnerResult> {
  const c = requireDirectClient()
  if (!c.ok) return { ok: false, error: c.error }

  const primary = await fetchEvidenceImagesByOwner(c.client, owner, opts)
  if (!primary.ok) return primary

  const withRpc: FetchEvidenceImagesByOwnerResult = {
    ...primary,
    rpcUrl: c.rpcUrl,
  }

  if (primary.items.length > 0 || opts?.cursor) {
    return withRpc
  }

  const alt = alternateIotaCafeRpcUrl(c.rpcUrl)
  if (!alt || alt === c.rpcUrl) return withRpc

  try {
    const altClient = createDirectIotaClient({ rpcUrl: alt })
    const secondary = await fetchEvidenceImagesByOwner(altClient, owner, opts)
    if (secondary.ok && secondary.items.length > 0) {
      return {
        ...secondary,
        rpcUrl: alt,
        networkNote:
          `Keine Treffer auf ${rpcNetworkLabel(c.rpcUrl)} (${c.rpcUrl}). ` +
          `Anzeige von ${rpcNetworkLabel(alt)} — RPC in Einstellungen/Puls auf ${rpcNetworkLabel(alt)} stellen.`,
      }
    }
  } catch {
    /* ignore alt failure */
  }

  return {
    ...withRpc,
    networkNote: `RPC: ${rpcNetworkLabel(c.rpcUrl)} (${c.rpcUrl}). SimpleNFT-Demo oft nur auf Testnet.`,
  }
}
