/**
 * § H.16 / H.15 B.2: Peering-QR — Wallet + optional ECDH-Pub (offline Peering ohne Basis).
 * @see docs/QR-CONTACT-SCHEMA-V2.md (Kontakt `mc`; Peering `mp` + optional `e` auf `mc`)
 */

import { setDirectChatEcdhPeerPubBase64 } from '@/frontend/lib/direct-chat-ecdh-session'
import { parseContactQrPayload } from '@/frontend/lib/contact-qr'

export type MorgendrotPeeringQrV2 = {
  v: 2
  k: 'mp'
  a: string
  /** P-256 ECDH public raw (65 Byte), Base64 — für verschlüsselten Direkt-Versand. */
  e?: string
  n?: string
}

export type ParsedPeeringQr = {
  address: string
  displayName?: string
  ecdhPubB64?: string
  source: 'mp' | 'mc' | 'plain'
}

export function buildPeeringQrPayload(input: {
  address: string
  ecdhPubB64?: string
  displayName?: string
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
      return {
        address: a,
        ...(n ? { displayName: n.slice(0, 64) } : {}),
        ...(e ? { ecdhPubB64: e } : {}),
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
      return {
        address: contact.address,
        ...(contact.displayName ? { displayName: contact.displayName } : {}),
        ...(e ? { ecdhPubB64: e } : {}),
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
  | { ok: true; address: string; displayName?: string; peerPubStored: boolean }
  | { ok: false; error: string }

/** Peer-Adresse + optional Pub in localStorage (§ H.15 B.2). */
export function applyPeeringQrImport(parsed: ParsedPeeringQr): ApplyPeeringQrResult {
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
  return {
    ok: true,
    address,
    ...(parsed.displayName ? { displayName: parsed.displayName } : {}),
    peerPubStored,
  }
}
