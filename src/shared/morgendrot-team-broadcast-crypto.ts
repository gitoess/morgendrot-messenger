/**
 * § H.23 B1 — Team-Key AEAD für Gruppen-Broadcast (symmetrisch, Key nur off-chain).
 */
import { base64ToUint8, uint8ToBase64 } from './bytes-base64'

export const DEFAULT_TEAM_BROADCAST_KEY_EPOCH = 1
export const TEAM_BROADCAST_AAD_DOMAIN = 'MORG_TEAM_BROADCAST_V1' as const

function getSubtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle
  if (!s) throw new Error('Web Crypto fehlt (crypto.subtle).')
  return s
}

function buf(u: Uint8Array): BufferSource {
  return u as BufferSource
}

export function buildTeamBroadcastAad(input: {
  teamMailboxObjectId: string
  groupId: string
  keyEpoch: number
}): Uint8Array {
  const mb = input.teamMailboxObjectId.trim().toLowerCase()
  const gid = input.groupId.trim().slice(0, 64)
  if (!/^0x[a-f0-9]{64}$/.test(mb)) throw new Error('teamMailboxObjectId ungültig.')
  if (!Number.isInteger(input.keyEpoch) || input.keyEpoch < 0) throw new Error('keyEpoch ungültig.')
  return new TextEncoder().encode(
    `${TEAM_BROADCAST_AAD_DOMAIN}:${mb}:${gid}:${input.keyEpoch}`
  )
}

export async function importTeamBroadcastAesKey(raw32: Uint8Array): Promise<CryptoKey> {
  if (raw32.length !== 32) throw new Error('Team-Key muss 32 Byte sein.')
  return await getSubtle().importKey('raw', buf(raw32), 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export function generateTeamBroadcastKeyRaw(): Uint8Array {
  const key = new Uint8Array(32)
  globalThis.crypto!.getRandomValues(key)
  return key
}

export async function encryptTeamBroadcastPayload(
  teamKeyRaw: Uint8Array,
  plaintext: string,
  aad: Uint8Array
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array }> {
  const aes = await importTeamBroadcastAesKey(teamKeyRaw)
  const iv = new Uint8Array(12)
  globalThis.crypto!.getRandomValues(iv)
  const encrypted = await getSubtle().encrypt(
    { name: 'AES-GCM', iv: buf(iv), additionalData: buf(aad), tagLength: 128 },
    aes,
    new TextEncoder().encode(plaintext)
  )
  const full = new Uint8Array(encrypted)
  if (full.length < 16) throw new Error('AES-GCM Ausgabe zu kurz.')
  return {
    ciphertext: full.subarray(0, -16),
    tag: full.subarray(-16),
    iv,
  }
}

export async function decryptTeamBroadcastPayload(
  teamKeyRaw: Uint8Array,
  ciphertext: Uint8Array,
  iv: Uint8Array,
  tag: Uint8Array,
  aad: Uint8Array
): Promise<string> {
  const aes = await importTeamBroadcastAesKey(teamKeyRaw)
  const combined = new Uint8Array(ciphertext.length + tag.length)
  combined.set(ciphertext, 0)
  combined.set(tag, ciphertext.length)
  const decrypted = await getSubtle().decrypt(
    { name: 'AES-GCM', iv: buf(iv), additionalData: buf(aad), tagLength: 128 },
    aes,
    buf(combined)
  )
  return new TextDecoder().decode(decrypted)
}

export function teamBroadcastKeyToBase64(raw: Uint8Array): string {
  return uint8ToBase64(raw)
}

export function teamBroadcastKeyFromBase64(b64: string): Uint8Array {
  const raw = base64ToUint8(b64.trim())
  if (raw.length !== 32) throw new Error('Team-Key Base64 muss 32 Byte dekodieren.')
  return raw
}
