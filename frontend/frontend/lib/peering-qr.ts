/**
 * § H.16 / H.15 B.2: Peering-QR — Wallet + optional ECDH-Pub (offline Peering ohne Basis).
 * @see docs/QR-CONTACT-SCHEMA-V2.md (Kontakt `mc`; Peering `mp` + optional `e` auf `mc`)
 */

import { addConnectedPeerToLocalSnapshot } from '@/frontend/lib/connected-peers-snapshot'
import { persistDirectChainFieldIds } from '@/frontend/lib/direct-iota-chain-context'
import { setDirectChatEcdhPeerPubBase64 } from '@/frontend/lib/direct-chat-ecdh-session'
import { setBrowserDirectIotaRpcUrlOverride } from '@/frontend/lib/direct-iota-rpc'
import { parseContactQrPayload } from '@/frontend/lib/contact-qr'

export type MorgendrotPeeringQrV2 = {
  v: 2
  k: 'mp'
  a: string
  /** P-256 ECDH public raw (65 Byte), Base64 — für verschlüsselten Direkt-Versand. */
  e?: string
  n?: string
  /** Optional: IOTA Fullnode (§ QR-CONTACT-SCHEMA-V2 `u`). */
  u?: string
  /** Optional: Package-ID (`p`). */
  p?: string
}

export type ParsedPeeringQr = {
  address: string
  displayName?: string
  ecdhPubB64?: string
  rpcUrl?: string
  packageId?: string
  source: 'mp' | 'mc' | 'plain'
}

export type PeeringQrNetworkHints = {
  rpcUrl?: string
  packageId?: string
}

function pickNetworkHintsFromJson(j: Record<string, unknown>): PeeringQrNetworkHints {
  const u =
    (typeof j.u === 'string' ? j.u : typeof j.rpcUrl === 'string' ? j.rpcUrl : '').trim()
  const p =
    (typeof j.p === 'string' ? j.p : typeof j.packageId === 'string' ? j.packageId : '').trim()
  const out: PeeringQrNetworkHints = {}
  if (u && /^https?:\/\//i.test(u)) out.rpcUrl = u
  if (p && /^0x[a-fA-F0-9]{64}$/i.test(p)) out.packageId = p
  return out
}

export function peeringQrHasNetworkHints(parsed: ParsedPeeringQr): boolean {
  return Boolean(parsed.rpcUrl?.trim() || parsed.packageId?.trim())
}

export function buildPeeringQrPayload(input: {
  address: string
  ecdhPubB64?: string
  displayName?: string
  rpcUrl?: string
  packageId?: string
}): string {
  const a = input.address.trim()
  if (!/^0x[a-fA-F0-9]{64}$/i.test(a)) {
    throw new Error('Adresse: 0x + 64 Hex.')
  }
  const o: MorgendrotPeeringQrV2 = { v: 2, k: 'mp', a }
  const e = (input.ecdhPubB64 ?? '').trim().replace(/\s+/g, '')
  if (e) o.e = e
  const n = (input.displayName ?? '').trim()
  if (n) o.n = n.slice(0, 64)
  const u = (input.rpcUrl ?? '').trim()
  if (u && /^https?:\/\//i.test(u)) o.u = u
  const p = (input.packageId ?? '').trim()
  if (p && /^0x[a-fA-F0-9]{64}$/i.test(p)) o.p = p
  return JSON.stringify(o)
}

export function parsePeeringQrPayload(raw: string): ParsedPeeringQr | null {
  const t = raw.trim()
  if (!t) return null
  try {
    const j = JSON.parse(t) as Record<string, unknown>
    const k = j.k
    const v = j.v
    if (v === 2 && k === 'mp') {
      const a = typeof j.a === 'string' ? j.a.trim() : ''
      if (!/^0x[a-fA-F0-9]{64}$/i.test(a)) return null
      const e = typeof j.e === 'string' ? j.e.trim().replace(/\s+/g, '') : undefined
      const n = typeof j.n === 'string' ? j.n.trim() : undefined
      const net = pickNetworkHintsFromJson(j)
      return {
        address: a,
        ...(n ? { displayName: n.slice(0, 64) } : {}),
        ...(e ? { ecdhPubB64: e } : {}),
        ...(net.rpcUrl ? { rpcUrl: net.rpcUrl } : {}),
        ...(net.packageId ? { packageId: net.packageId } : {}),
        source: 'mp',
      }
    }
  } catch {
    /* fall through */
  }
  const contact = parseContactQrPayload(t)
  if (contact) {
    try {
      const j = JSON.parse(t) as Record<string, unknown>
      const e = typeof j.e === 'string' ? j.e.trim().replace(/\s+/g, '') : undefined
      const net = pickNetworkHintsFromJson(j)
      return {
        address: contact.address,
        ...(contact.displayName ? { displayName: contact.displayName } : {}),
        ...(e ? { ecdhPubB64: e } : {}),
        ...(net.rpcUrl ? { rpcUrl: net.rpcUrl } : {}),
        ...(net.packageId ? { packageId: net.packageId } : {}),
        source: 'mc',
      }
    } catch {
      return { address: contact.address, ...(contact.displayName ? { displayName: contact.displayName } : {}), source: 'mc' }
    }
  }
  if (/^0x[a-fA-F0-9]{64}$/i.test(t)) {
    return { address: t, source: 'plain' }
  }
  return null
}

export type ApplyPeeringQrResult =
  | {
      ok: true
      address: string
      displayName?: string
      peerPubStored: boolean
      networkApplied?: string[]
    }
  | { ok: false; error: string }

/** Optional RPC/Package aus QR (Boss-LAN / Standalone-Helfer). */
export function applyPeeringQrNetworkHints(hints: PeeringQrNetworkHints): {
  ok: true
  applied: string[]
} {
  const applied: string[] = []
  const rpc = (hints.rpcUrl ?? '').trim()
  if (rpc && /^https?:\/\//i.test(rpc)) {
    setBrowserDirectIotaRpcUrlOverride(rpc)
    applied.push('RPC-URL')
  }
  const pkg = (hints.packageId ?? '').trim()
  if (pkg && /^0x[a-fA-F0-9]{64}$/i.test(pkg)) {
    persistDirectChainFieldIds({ packageId: pkg })
    applied.push('Package-ID')
  }
  return { ok: true, applied }
}

/** Peer-Adresse + optional Pub in localStorage (§ H.15 B.2). */
export function applyPeeringQrImport(
  parsed: ParsedPeeringQr,
  opts?: { applyNetworkHints?: boolean }
): ApplyPeeringQrResult {
  const address = parsed.address.trim()
  if (!/^0x[a-fA-F0-9]{64}$/i.test(address)) {
    return { ok: false, error: 'Ungültige Wallet-Adresse im QR.' }
  }
  let peerPubStored = false
  const e = (parsed.ecdhPubB64 ?? '').trim()
  if (e) {
    const r = setDirectChatEcdhPeerPubBase64(address, e)
    if (!r.ok) return { ok: false, error: r.error }
    peerPubStored = true
  }
  addConnectedPeerToLocalSnapshot(address)

  let networkApplied: string[] | undefined
  if (opts?.applyNetworkHints && peeringQrHasNetworkHints(parsed)) {
    const net = applyPeeringQrNetworkHints({
      rpcUrl: parsed.rpcUrl,
      packageId: parsed.packageId,
    })
    if (net.applied.length > 0) networkApplied = net.applied
  }

  return {
    ok: true,
    address,
    ...(parsed.displayName ? { displayName: parsed.displayName } : {}),
    peerPubStored,
    ...(networkApplied?.length ? { networkApplied } : {}),
  }
}
