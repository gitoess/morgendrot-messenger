/**
 * H.23 B2 P1: Besitz-Check für NFT-Schlüsselkarte (Object Owner vs. Signer).
 */

import { createDirectIotaClient } from '@morgendrot/core/iota'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'

export type NftOwnershipCheck =
  | { ok: true; owned: boolean; ownerAddress: string | null; objectId: string }
  | { ok: false; error: string; objectId: string }

function normAddr(a: string): string {
  return a.trim().toLowerCase()
}

/** Extrahiert AddressOwner aus IOTA getObject-Owner-Feld. */
export function addressOwnerFromObjectOwner(owner: unknown): string | null {
  if (!owner || typeof owner !== 'object') return null
  const o = owner as Record<string, unknown>
  if (typeof o.AddressOwner === 'string' && o.AddressOwner.trim()) {
    return normAddr(o.AddressOwner)
  }
  return null
}

type GetObjectClient = {
  getObject: (input: {
    id: string
    options?: { showOwner?: boolean }
  }) => Promise<{ data?: { owner?: unknown } | null }>
}

export async function checkNftOwnedByAddress(
  client: GetObjectClient,
  objectIdRaw: string,
  expectedOwnerRaw: string
): Promise<NftOwnershipCheck> {
  const objectId = normAddr(objectIdRaw)
  const expected = normAddr(expectedOwnerRaw)
  if (!/^0x[a-f0-9]{64}$/.test(objectId)) {
    return { ok: false, error: 'Object-ID: 0x + 64 Hex nötig.', objectId }
  }
  if (!/^0x[a-f0-9]{64}$/.test(expected)) {
    return { ok: false, error: 'Besitzer-Adresse: 0x + 64 Hex nötig.', objectId }
  }
  try {
    const res = await client.getObject({ id: objectId, options: { showOwner: true } })
    const ownerAddress = addressOwnerFromObjectOwner(res.data?.owner)
    if (!ownerAddress) {
      return {
        ok: true,
        owned: false,
        ownerAddress: null,
        objectId,
      }
    }
    return {
      ok: true,
      owned: ownerAddress === expected,
      ownerAddress,
      objectId,
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      objectId,
    }
  }
}

/** Direkt-RPC-Wrapper für UI. */
export async function checkNftKeycardOwnedBySigner(
  objectId: string,
  signerAddress: string
): Promise<NftOwnershipCheck> {
  const rpc = getConfiguredDirectIotaRpcUrl()
  if (!rpc) {
    return {
      ok: false,
      error: 'Keine Direkt-RPC-URL — in den Einstellungen/Puls setzen.',
      objectId: objectId.trim().toLowerCase(),
    }
  }
  const client = createDirectIotaClient({ rpcUrl: rpc })
  return checkNftOwnedByAddress(client, objectId, signerAddress)
}
