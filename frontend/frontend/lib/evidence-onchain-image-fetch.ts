'use client'

import { createDirectIotaClient } from '@morgendrot/core/iota'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import {
  fetchEvidenceImageByObjectId,
  fetchEvidenceImagesByOwner,
  type FetchEvidenceImageResult,
  type FetchEvidenceImagesByOwnerResult,
} from '@/frontend/lib/evidence-onchain-image'

function requireDirectClient():
  | { ok: true; client: ReturnType<typeof createDirectIotaClient> }
  | { ok: false; error: string } {
  const rpc = getConfiguredDirectIotaRpcUrl()
  if (!rpc) {
    return {
      ok: false,
      error: 'Keine Direkt-RPC-URL — in den Einstellungen/Puls „Direkt“ bzw. RPC setzen.',
    }
  }
  return { ok: true, client: createDirectIotaClient({ rpcUrl: rpc }) }
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
  return fetchEvidenceImagesByOwner(c.client, owner, opts)
}
