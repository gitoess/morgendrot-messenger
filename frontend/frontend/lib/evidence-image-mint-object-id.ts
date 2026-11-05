/**
 * Nach ImageNFT-Mint: Object-ID aus TX-Events (NFTMinted) lesen.
 */

import { createDirectIotaClient } from '@morgendrot/core/iota'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

export async function resolveImageNftObjectIdFromDigest(digest: string): Promise<string | null> {
  const d = digest.trim()
  if (!d) return null
  const rpc = getConfiguredDirectIotaRpcUrl()
  if (!rpc) return null
  try {
    const client = createDirectIotaClient({ rpcUrl: rpc })
    const tx = (await client.getTransactionBlock({
      digest: d,
      options: { showEvents: true, showObjectChanges: true },
    } as Parameters<typeof client.getTransactionBlock>[0])) as {
      events?: Array<{ type?: string; parsedJson?: Record<string, unknown> }>
      objectChanges?: Array<{ type?: string; objectType?: string; objectId?: string }>
    }

    for (const ev of tx.events || []) {
      const t = String(ev.type || '')
      if (!/::image_nft::NFTMinted$/i.test(t)) continue
      const oid = ev.parsedJson?.object_id ?? ev.parsedJson?.objectId
      const s = typeof oid === 'string' ? oid : oid != null ? String(oid) : ''
      if (HEX64.test(s)) return s.toLowerCase()
    }

    for (const ch of tx.objectChanges || []) {
      if (String(ch.type || '').toLowerCase() !== 'created') continue
      const ot = String(ch.objectType || '')
      if (!/::image_nft::ImageNFT$/i.test(ot)) continue
      const id = String(ch.objectId || '')
      if (HEX64.test(id)) return id.toLowerCase()
    }
  } catch {
    return null
  }
  return null
}
