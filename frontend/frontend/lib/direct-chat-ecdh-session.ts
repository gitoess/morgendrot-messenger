'use client'

/**
 * Chat-ECDH (P-256) für **verschlüsselten** Direkt-Mailbox-Drain — getrennt vom IOTA-Ed25519-Session-Signer.
 * Peer-Public-Keys: **localStorage** (pro Empfängeradresse). Privater ECDH-Key: RAM + optional JWK/Own-Pub in localStorage (Vault-Sync).
 */

import { base64ToUint8, uint8ToBase64 } from '@morgendrot/shared/bytes-base64'
import { syncPeerSessionArchiveFromPub } from '@/frontend/lib/direct-session-keys-archive'

const LS_PEER_PUB = 'morgendrot.directChatEcdh.peerPubB64ByRecipient.v1'
/** P-256-ECDH-Privatkey als JWK (Gerät) — für Standalone-APK nach Puls „JWK anwenden“. */
const LS_PRIVATE_JWK = 'morgendrot.directChatEcdh.privateJwk.v1'
/** Eigenes P-256-Pub (65 B raw, Base64) — aus Vault, für Handshake ohne exportKey. */
const LS_OWN_PUB = 'morgendrot.directChatEcdh.ownPubRawB64.v1'

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
function persistPrivateJwkJson(jwkJson: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_PRIVATE_JWK, jwkJson)
  } catch {
    /* ignore */
  }
}

export function clearPersistedDirectChatEcdhPrivateJwk(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(LS_PRIVATE_JWK)
    window.localStorage.removeItem(LS_OWN_PUB)
  } catch {
    /* ignore */
  }
}

function persistOwnPubRawBase64(b64: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_OWN_PUB, b64.trim())
  } catch {
    /* ignore */
  }
}

/** Eigenes ECDH-Pub aus Vault-Sync (Handshake/Peering ohne Privatkey-Export). */
export function setDirectChatEcdhOwnPubRawBase64(peerPubRawBase64: string): { ok: true } | { ok: false; error: string } {
  const b64 = String(peerPubRawBase64 || '').trim().replace(/\s+/g, '')
  if (!b64) {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(LS_OWN_PUB)
      } catch {
        /* ignore */
      }
    }
    return { ok: true }
  }
  let raw: Uint8Array
  try {
    raw = base64ToUint8(b64)
  } catch {
    return { ok: false, error: 'Own-Pub: ungültiges Base64.' }
  }
  if (raw.length !== P256_RAW_PUB_LEN) {
    return { ok: false, error: `Own-Pub raw muss ${P256_RAW_PUB_LEN} Byte sein, ist ${raw.length}.` }
  }
  persistOwnPubRawBase64(b64)
  return { ok: true }
}

export function getDirectChatEcdhOwnPubRawBase64(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(LS_OWN_PUB)?.trim()
    return v || null
  } catch {
    return null
  }
}

/** Letzten JWK aus Puls wiederherstellen (Standalone / nach App-Neustart). */
export async function restoreDirectChatEcdhPrivateFromLocalStorage(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  if (typeof window === 'undefined') return { ok: false, error: 'Kein Browser.' }
  try {
    const raw = window.localStorage.getItem(LS_PRIVATE_JWK)?.trim() ?? ''
    if (!raw) return { ok: false, error: 'Kein gespeicherter Chat-ECDH-JWK.' }
    return applyDirectChatEcdhPrivateJwk(raw)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Standalone-Helfer: ECDH automatisch erzeugen, wenn noch keiner da ist (Peering-QR später). */
export async function ensureStandaloneChatEcdhKeypair(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  if (getDirectChatEcdhPrivateKey()) return { ok: true }
  const restored = await restoreDirectChatEcdhPrivateFromLocalStorage()
  if (restored.ok) return { ok: true }
  if (typeof window === 'undefined' || !globalThis.crypto?.subtle) {
    return { ok: false, error: 'Web Crypto fehlt — Chat-ECDH kann nicht erzeugt werden.' }
  }
  try {
    const pair = await globalThis.crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits', 'deriveKey']
    )
    const jwk = await globalThis.crypto.subtle.exportKey('jwk', pair.privateKey)
    const pubRaw = await globalThis.crypto.subtle.exportKey('raw', pair.publicKey)
    setDirectChatEcdhOwnPubRawBase64(uint8ToBase64(new Uint8Array(pubRaw)))
    return applyDirectChatEcdhPrivateJwk(JSON.stringify(jwk))
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function applyDirectChatEcdhPrivateJwk(
  jwkJson: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const raw = String(jwkJson || '').trim()
  if (!raw) {
    ecdhPrivateKey = null
    clearPersistedDirectChatEcdhPrivateJwk()
    return { ok: true }
  }
  let jwk: JsonWebKey
  try {
    jwk = JSON.parse(raw) as JsonWebKey
  } catch {
    return { ok: false, error: 'Kein gültiges JSON (JWK).' }
  }
  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || typeof jwk.d !== 'string' || !jwk.d.trim()) {
    return { ok: false, error: 'JWK muss EC / P-256 Privatkey sein (Feld „d“ fehlt).' }
  }
  try {
    const subtle = globalThis.crypto?.subtle
    if (!subtle) throw new Error('Web Crypto fehlt.')
    ecdhPrivateKey = await subtle.importKey(
      'jwk',
      jwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits', 'deriveKey']
    )
    persistPrivateJwkJson(raw)
    return { ok: true }
  } catch (e) {
    ecdhPrivateKey = null
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export function clearDirectChatEcdhPrivateKey(): void {
  ecdhPrivateKey = null
}

/** RAM + gespeichertes JWK/Own-Pub entfernen (Puls „ECDH löschen“, Einsatz-Ende). */
export function clearDirectChatEcdhKeyMaterial(): void {
  clearDirectChatEcdhPrivateKey()
  clearPersistedDirectChatEcdhPrivateJwk()
}

/** Vault-Sync: Privatkey + optional Own-Pub (65 B raw) aus Boss-Tresor. */
export async function applyDirectChatEcdhVaultMaterial(opts: {
  ecdhPrivateJwk?: string
  ecdhPrivatePkcs8Base64?: string
  ecdhPubRawBase64?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (opts.ecdhPubRawBase64?.trim()) {
    const pub = setDirectChatEcdhOwnPubRawBase64(opts.ecdhPubRawBase64)
    if (!pub.ok) return pub
  }
  if (opts.ecdhPrivateJwk?.trim()) {
    return applyDirectChatEcdhPrivateJwk(opts.ecdhPrivateJwk)
  }
  const pkcs8B64 = opts.ecdhPrivatePkcs8Base64?.trim()
  if (pkcs8B64) {
    return applyDirectChatEcdhPrivatePkcs8(pkcs8B64)
  }
  return { ok: false, error: 'Kein Chat-ECDH-Material aus Vault.' }
}

/** PKCS#8 (Base64) — Fallback wenn JWK-Export auf dem Server blockiert ist. */
export async function applyDirectChatEcdhPrivatePkcs8(
  pkcs8Base64: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const b64 = String(pkcs8Base64 || '').trim().replace(/\s+/g, '')
  if (!b64) {
    ecdhPrivateKey = null
    return { ok: true }
  }
  try {
    const subtle = globalThis.crypto?.subtle
    if (!subtle) throw new Error('Web Crypto fehlt.')
    const pkcs8 = base64ToUint8(b64)
    ecdhPrivateKey = await subtle.importKey(
      'pkcs8',
      pkcs8,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits', 'deriveKey']
    )
    const jwk = await subtle.exportKey('jwk', ecdhPrivateKey)
    persistPrivateJwkJson(JSON.stringify(jwk))
    return { ok: true }
  } catch (e) {
    ecdhPrivateKey = null
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
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
  syncPeerSessionArchiveFromPub(addr, raw)
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
  const cached = getDirectChatEcdhOwnPubRawBase64()
  if (cached) return { ok: true, b64: cached }
  if (!ecdhPrivateKey) {
    return { ok: false, error: 'Kein Chat-ECDH-Privatkey — Tresor entsperren oder Handshake/Connect.' }
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

/**
 * § H.33e — Self-Archiv: eigenes Pubkey als „Peer“ hinterlegen, damit ECDH an MY_ADDRESS funktioniert.
 */
export async function ensureSelfForensicEcdhMaterial(myAddress: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const addr = normalizeAddr(myAddress)
  if (!addr) return { ok: false, error: 'MY_ADDRESS ungültig.' }
  if (getDirectChatEcdhMaterialForRecipient(addr)) return { ok: true }
  const ensured = await ensureStandaloneChatEcdhKeypair()
  if (!ensured.ok) return ensured
  const pub = await exportDirectChatEcdhPublicKeyRawBase64()
  if (!pub.ok) return pub
  const set = setDirectChatEcdhPeerPubBase64(addr, pub.b64)
  return set.ok ? { ok: true } : set
}
