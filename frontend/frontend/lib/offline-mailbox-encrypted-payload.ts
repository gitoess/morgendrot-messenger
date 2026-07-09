'use client'

/**
 * Offline-Queue: verschlüsselte Payloads (kein Klartext in localStorage).
 */
import { uint8ToBase64, base64ToUint8 } from '@morgendrot/shared/bytes-base64'
import { encryptPlaintextWireForRecipient } from '@/frontend/lib/direct-iota-encrypted-submit'
import { getDirectChatEcdhMaterialForRecipient } from '@/frontend/lib/direct-chat-ecdh-session'
import { prepareEncryptedDirectSend } from '@/frontend/lib/direct-iota-encrypted-send-prep'
import { readMessagingPersistenceModeFromStorage } from '@/frontend/lib/messaging-persistence-mode'

export type OfflineEncryptedWireV1 = {
  v: 1
  ciphertextB64: string
  ivB64: string
  tagB64: string
  nonce: string
  keyEpoch?: number
}

export function isOfflineEncryptedWirePayload(payload: string): boolean {
  return parseOfflineEncryptedWirePayload(payload) != null
}

/** `encrypted_send` mit Klartext-Payload (vor P0-2) — nicht mehr drainen. */
export function isLegacyPlaintextEncryptedQueuePayload(
  kind: string,
  encrypted: boolean,
  payload: string
): boolean {
  return kind === 'encrypted_send' && encrypted === true && !isOfflineEncryptedWirePayload(payload)
}

export function parseOfflineEncryptedWirePayload(payload: string): OfflineEncryptedWireV1 | null {
  const raw = payload.trim()
  if (!raw.startsWith('{')) return null
  try {
    const o = JSON.parse(raw) as Partial<OfflineEncryptedWireV1>
    if (o.v !== 1) return null
    if (typeof o.ciphertextB64 !== 'string' || !o.ciphertextB64.trim()) return null
    if (typeof o.ivB64 !== 'string' || !o.ivB64.trim()) return null
    if (typeof o.tagB64 !== 'string' || !o.tagB64.trim()) return null
    if (typeof o.nonce !== 'string' || !o.nonce.trim()) return null
    return {
      v: 1,
      ciphertextB64: o.ciphertextB64,
      ivB64: o.ivB64,
      tagB64: o.tagB64,
      nonce: o.nonce,
      ...(typeof o.keyEpoch === 'number' && Number.isFinite(o.keyEpoch) ? { keyEpoch: o.keyEpoch } : {}),
    }
  } catch {
    return null
  }
}

export function serializeOfflineEncryptedWirePayload(wire: OfflineEncryptedWireV1): string {
  return JSON.stringify(wire)
}

/** Verschlüsselt Wire für Queue-Speicherung; schlägt fehl wenn ECDH fehlt. */
export async function buildOfflineEncryptedQueuePayload(
  recipient: string,
  wireForApi: string
): Promise<{ ok: true; payload: string } | { ok: false; error: string }> {
  const mode = readMessagingPersistenceModeFromStorage()
  const prep = await prepareEncryptedDirectSend(recipient, mode)
  if (!prep.ok) return prep
  const mat = getDirectChatEcdhMaterialForRecipient(recipient)
  if (!mat) {
    return { ok: false, error: 'ECDH-Material für Empfänger fehlt — verschlüsselte Warteschlange nicht möglich.' }
  }
  const enc = await encryptPlaintextWireForRecipient({
    recipient,
    plaintextUtf8: wireForApi,
    peerPubRaw: mat.peerPubRaw,
    ecdhPrivateKey: mat.ecdhPrivateKey,
  })
  if (!enc.ok) return enc
  const payload = serializeOfflineEncryptedWirePayload({
    v: 1,
    ciphertextB64: uint8ToBase64(enc.ciphertext),
    ivB64: uint8ToBase64(enc.iv),
    tagB64: uint8ToBase64(enc.tag),
    nonce: enc.nonce.toString(),
  })
  return { ok: true, payload }
}

export function offlineEncryptedWireToDirectSubmitInput(
  recipient: string,
  wire: OfflineEncryptedWireV1,
  mailboxObjectId?: string
) {
  return {
    recipient,
    ciphertext: base64ToUint8(wire.ciphertextB64),
    iv: base64ToUint8(wire.ivB64),
    tag: base64ToUint8(wire.tagB64),
    nonce: BigInt(wire.nonce),
    mailboxObjectId,
  }
}
