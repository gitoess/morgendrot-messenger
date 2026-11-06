/**
 * B2-P4b — Client → Key-Broker `/api/nft-gate-seal/*`.
 */

import { getApiBase } from '@/frontend/lib/api/api-base'
import { fetchApiText } from '@/frontend/lib/api-fetch-text'

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function postJson<T extends { ok?: boolean; error?: string }>(
  path: string,
  body: unknown
): Promise<T> {
  const fr = await fetchApiText(getApiBase(), path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!fr.ok) throw new Error(fr.error)
  const parsed = JSON.parse(fr.text || '{}') as T
  if (!fr.response.ok && parsed?.error) throw new Error(parsed.error)
  if (!fr.response.ok) throw new Error(`HTTP ${fr.response.status}`)
  return parsed
}

export async function fetchNftSealBrokerStatus(): Promise<{ ready: boolean; error?: string }> {
  try {
    const fr = await fetchApiText(getApiBase(), '/api/nft-gate-seal/status')
    if (!fr.ok) return { ready: false, error: fr.error }
    const r = JSON.parse(fr.text || '{}') as { ok?: boolean; ready?: boolean; error?: string }
    if (!fr.response.ok || r.ok === false) {
      return { ready: false, error: r.error || `HTTP ${fr.response.status}` }
    }
    return { ready: Boolean(r.ready) }
  } catch (e) {
    return { ready: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function fetchNftSealWrapKey(opts: {
  nftObjectId: string
  requiredWallet?: string | null
}): Promise<{ ok: true; wrapKeyRaw: Uint8Array } | { ok: false; error: string }> {
  try {
    const r = await postJson<{ ok?: boolean; wrapKeyB64?: string; error?: string }>(
      '/api/nft-gate-seal/wrap-key',
      {
        nftObjectId: opts.nftObjectId,
        requiredWallet: opts.requiredWallet || undefined,
      }
    )
    if (!r?.ok || !r.wrapKeyB64) {
      return { ok: false, error: r?.error || 'wrap-key fehlgeschlagen.' }
    }
    const wrapKeyRaw = b64ToBytes(r.wrapKeyB64)
    if (wrapKeyRaw.length !== 32) return { ok: false, error: 'wrap-key Länge ≠ 32.' }
    return { ok: true, wrapKeyRaw }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function fetchNftSealUnwrapKey(opts: {
  nftObjectId: string
  requesterAddress: string
  requiredWallet?: string | null
}): Promise<{ ok: true; wrapKeyRaw: Uint8Array } | { ok: false; error: string }> {
  try {
    const r = await postJson<{ ok?: boolean; wrapKeyB64?: string; error?: string }>(
      '/api/nft-gate-seal/unwrap-key',
      {
        nftObjectId: opts.nftObjectId,
        requesterAddress: opts.requesterAddress,
        requiredWallet: opts.requiredWallet || undefined,
      }
    )
    if (!r?.ok || !r.wrapKeyB64) {
      return { ok: false, error: r?.error || 'unwrap-key verweigert.' }
    }
    const wrapKeyRaw = b64ToBytes(r.wrapKeyB64)
    if (wrapKeyRaw.length !== 32) return { ok: false, error: 'unwrap-key Länge ≠ 32.' }
    return { ok: true, wrapKeyRaw }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
