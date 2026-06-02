'use client'

/**
 * Chat-ECDH (P-256) für **verschlüsselten** Direkt-Mailbox-Drain — getrennt vom IOTA-Ed25519-Session-Signer.
 * Peer-Public-Keys: **localStorage** (pro Empfängeradresse). Privater ECDH-Key: **nur RAM** (JWK einmalig einlesen).
 */

import { base64ToUint8, uint8ToBase64 } from '@morgendrot/shared/bytes-base64'

const LS_PEER_PUB = 'morgendrot.directChatEcdh.peerPubB64ByRecipient.v1'

const P256_RAW_PUB_LEN = 65

let ecdhPrivateKey: CryptoKey | null = null
let peerMapCache: Record<string, string> | null = null

function normalizeAddr(a: string): string {
  const t = String(a || '').trim().toLowerCase()
  if (!/^0x[a-f0-9]{64}$/.test(t)) return ''
  return t
}

function readPeerMap(): Record<string, string> {
  if (peerMapCache) return peerMapCache
  if (typeof window === 'undefined') {
    peerMapCache = {}
    return peerMapCache
  }
  try {
    const raw = window.localStorage.getItem(LS_PEER_PUB)?.trim()
    if (!raw) {
      peerMapCache = {}
      return peerMapCache
    }
    const j = JSON.parse(raw) as unknown
    peerMapCache = j != null && typeof j === 'object' && !Array.isArray(j) ? { ...(j as Record<string, string>) } : {}
    return peerMapCache
  } catch {
    peerMapCache = {}
    return peerMapCache
  }
}

function writePeerMap(m: Record<string, string>): void {
  peerMapCache = { ...m }
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_PEER_PUB, JSON.stringify(m))
  } catch {
    /* ignore */
  }
}

export function getDirectChatEcdhPrivateKey(): CryptoKey | null {
  return ecdhPrivateKey
}

/**
 * Importiert einen P-256-ECDH-Privatkey aus JWK (Web Crypto), **nur RAM**.
 */
export async function applyDirectChatEcdhPrivateJwk(
  jwkJson: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const raw = String(jwkJson || '').trim()
  if (!raw) {
    ecdhPrivateKey = null
    return { ok: true }
  }
  let jwk: JsonWebKey
  try {
    jwk = JSON.parse(raw) as JsonWebKey
  } catch {
    return { ok: false, error: 'Kein gültiges JSON (JWK).' }
  }
  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256') {
    return { ok: false, error: 'JWK muss EC / P-256 sein (wie Messenger-Handshake).' }
  }
  try {
    const subtle = globalThis.crypto?.subtle
    if (!subtle) throw new Error('Web Crypto fehlt.')
    ecdhPrivateKey = await subtle.importKey(
      'jwk',
      jwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveBits', 'deriveKey']
    )
    return { ok: true }
  } catch (e) {
    ecdhPrivateKey = null
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export function clearDirectChatEcdhPrivateKey(): void {
  ecdhPrivateKey = null
}

/** Roher P-256-Publickey (65 Byte, typ. `exportKey('raw')`), Base64-codiert. */
export function setDirectChatEcdhPeerPubBase64(recipientHex: string, peerPubRawBase64: string): { ok: true } | { ok: false; error: string } {
  const addr = normalizeAddr(recipientHex)
  if (!addr) return { ok: false, error: 'Empfänger: gültige 0x-Adresse (64 Hex).' }
  const b64 = String(peerPubRawBase64 || '').trim().replace(/\s+/g, '')
  if (!b64) {
    const m = readPeerMap()
    delete m[addr]
    writePeerMap(m)
    return { ok: true }
  }
  let raw: Uint8Array
  try {
    raw = base64ToUint8(b64)
  } catch {
    return { ok: false, error: 'Peer-Pub: ungültiges Base64.' }
  }
  if (raw.length !== P256_RAW_PUB_LEN) {
    return { ok: false, error: `Peer-Pub raw muss ${P256_RAW_PUB_LEN} Byte sein (P-256 uncompressed), ist ${raw.length}.` }
  }
  const m = readPeerMap()
  m[addr] = b64
  writePeerMap(m)
  return { ok: true }
}

export function getDirectChatEcdhPeerPubBase64(recipientHex: string): string | null {
  const addr = normalizeAddr(recipientHex)
  if (!addr) return null
  const v = readPeerMap()[addr]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

export function clearDirectChatEcdhPeerPubs(): void {
  peerMapCache = {}
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(LS_PEER_PUB)
  } catch {
    /* ignore */
  }
}

export type DirectChatEcdhMaterial = { ecdhPrivateKey: CryptoKey; peerPubRaw: Uint8Array }

export function getDirectChatEcdhMaterialForRecipient(recipientHex: string): DirectChatEcdhMaterial | null {
  const addr = normalizeAddr(recipientHex)
  if (!addr || !ecdhPrivateKey) return null
  const b64 = readPeerMap()[addr]
  if (!b64) return null
  try {
    const peerPubRaw = base64ToUint8(b64)
    if (peerPubRaw.length !== P256_RAW_PUB_LEN) return null
    return { ecdhPrivateKey, peerPubRaw }
  } catch {
    return null
  }
}

/** Alle Empfänger mit gespeichertem Peer-Pub (§ H.15 B.2 — Offline-Peering). */
export function listDirectChatEcdhPeerRecipientAddresses(): string[] {
  return Object.keys(readPeerMap()).filter((a) => /^0x[a-f0-9]{64}$/.test(a))
}

/** Nur Anzeige: ob für diese Adresse ein Peer-Pub in LS liegt. */
export function hasDirectChatEcdhPeerPubForRecipient(recipientHex: string): boolean {
  return getDirectChatEcdhPeerPubBase64(recipientHex) != null
}

/** Base64(raw) für UI / Export. */
export function exportDirectChatEcdhPeerPubPreview(recipientHex: string): string {
  return getDirectChatEcdhPeerPubBase64(recipientHex) ?? ''
}

function base64UrlToBytes(b64url: string): Uint8Array {
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4) b64 += '='
  return base64ToUint8(b64)
}

/** Eigener P-256-Publickey (65 Byte raw) für Peering-QR (§ H.16). */
export async function exportDirectChatEcdhPublicKeyRawBase64(): Promise<
  { ok: true; b64: string } | { ok: false; error: string }
> {
  if (!ecdhPrivateKey) {
    return { ok: false, error: 'Kein Chat-ECDH-Privatkey — im Puls JWK anwenden (oder Handshake/Connect).' }
  }
  try {
    const subtle = globalThis.crypto?.subtle
    if (!subtle) return { ok: false, error: 'Web Crypto fehlt.' }
    const jwk = await subtle.exportKey('jwk', ecdhPrivateKey)
    if (!jwk.x || !jwk.y) return { ok: false, error: 'JWK ohne öffentlichen Schlüssel (x/y).' }
    const x = base64UrlToBytes(jwk.x)
    const y = base64UrlToBytes(jwk.y)
    if (x.length !== 32 || y.length !== 32) return { ok: false, error: 'Ungültige JWK-Koordinaten.' }
    const raw = new Uint8Array(P256_RAW_PUB_LEN)
    raw[0] = 0x04
    raw.set(x, 1)
    raw.set(y, 33)
    return { ok: true, b64: uint8ToBase64(raw) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
