'use client'

/**
 * Session-Signer für Direkt-IOTA (RAM) + optionale lokale, passwortgeschützte Ablage.
 * Gleiche Import-Regeln wie Node `sdk-signer-import`: Mnemonic (12+ Wörter), Bech32-Secret oder 64-Hex.
 */
import type { Signer } from '@iota/iota-sdk/cryptography'
import { Ed25519Keypair } from '@iota/iota-sdk/keypairs/ed25519'
import {
  decryptHandoffEnvUtf8,
  encryptHandoffEnvUtf8,
  type HandoffCryptoMetaJson,
} from '@/frontend/lib/handoff-zip-crypto'
import { persistDirectChainFieldIds } from '@/frontend/lib/direct-iota-chain-context'

let sessionSigner: Signer | null = null
let sessionAddress: string | null = null
const LS_DIRECT_IOTA_SIGNER_ENC = 'morgendrot.directIotaSigner.enc.v1'

function countMnemonicWords(s: string): number {
  return String(s || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

export function getDirectIotaSessionSigner(): Signer | null {
  return sessionSigner
}

export function getDirectIotaSessionSignerAddress(): string | null {
  return sessionAddress
}

export function clearDirectIotaSessionSigner(): void {
  sessionSigner = null
  sessionAddress = null
}

function bytesToB64(u8: Uint8Array): string {
  let s = ''
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!)
  return btoa(s)
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

type StoredDirectIotaSignerEncV1 = {
  schema: 'morgendrot.direct-iota-signer.enc.v1'
  crypto: HandoffCryptoMetaJson
  ciphertextB64: string
}

export function hasPersistedDirectIotaSessionSigner(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return !!window.localStorage.getItem(LS_DIRECT_IOTA_SIGNER_ENC)
  } catch {
    return false
  }
}

export function clearPersistedDirectIotaSessionSigner(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(LS_DIRECT_IOTA_SIGNER_ENC)
  } catch {
    /* ignore */
  }
}

export async function persistDirectIotaSessionSignerEncrypted(opts: {
  signerImportRaw: string
  password: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof window === 'undefined') return { ok: false, error: 'Kein Browser.' }
  const raw = String(opts.signerImportRaw || '').trim()
  const password = String(opts.password || '')
  if (!raw) return { ok: false, error: 'Signer-Eingabe fehlt.' }
  if (!password || password.length < 8) {
    return { ok: false, error: 'Passwort für lokale Ablage: mindestens 8 Zeichen.' }
  }
  try {
    const plain = JSON.stringify({ signerImportRaw: raw })
    const { meta, ciphertext } = await encryptHandoffEnvUtf8(plain, password)
    const payload: StoredDirectIotaSignerEncV1 = {
      schema: 'morgendrot.direct-iota-signer.enc.v1',
      crypto: meta,
      ciphertextB64: bytesToB64(ciphertext),
    }
    window.localStorage.setItem(LS_DIRECT_IOTA_SIGNER_ENC, JSON.stringify(payload))
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function restoreDirectIotaSessionSignerFromEncryptedStorage(opts: {
  password: string
  derivationPath?: string
}): Promise<{ ok: true; address: string } | { ok: false; error: string }> {
  if (typeof window === 'undefined') return { ok: false, error: 'Kein Browser.' }
  try {
    const raw = window.localStorage.getItem(LS_DIRECT_IOTA_SIGNER_ENC)?.trim() ?? ''
    if (!raw) return { ok: false, error: 'Kein gespeicherter Session-Signer gefunden.' }
    const payload = JSON.parse(raw) as Partial<StoredDirectIotaSignerEncV1>
    if (payload.schema !== 'morgendrot.direct-iota-signer.enc.v1' || !payload.crypto || !payload.ciphertextB64) {
      return { ok: false, error: 'Gespeicherter Signer hat ein unbekanntes Format.' }
    }
    const dec = await decryptHandoffEnvUtf8(payload.crypto, b64ToBytes(payload.ciphertextB64), String(opts.password || ''))
    if (!dec.ok) return { ok: false, error: dec.error }
    const j = JSON.parse(dec.envText) as { signerImportRaw?: unknown }
    const signerImportRaw = typeof j.signerImportRaw === 'string' ? j.signerImportRaw : ''
    if (!signerImportRaw.trim()) return { ok: false, error: 'Gespeicherter Signer ist leer oder beschädigt.' }
    return applyDirectIotaMnemonicSession(signerImportRaw, opts.derivationPath)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export function applyDirectIotaMnemonicSession(
  raw: string,
  derivationPath?: string
): { ok: true; address: string } | { ok: false; error: string } {
  const t = String(raw || '').trim()
  if (!t) {
    clearDirectIotaSessionSigner()
    return { ok: false, error: 'Leer — Signer gelöscht.' }
  }
  try {
    let keypair: Ed25519Keypair
    if (countMnemonicWords(t) >= 12) {
      keypair = Ed25519Keypair.deriveKeypair(t, derivationPath)
    } else {
      try {
        keypair = Ed25519Keypair.fromSecretKey(t)
      } catch {
        const hex = t.replace(/^0x/i, '').replace(/\s+/g, '')
        if (/^[a-fA-F0-9]{64}$/i.test(hex)) {
          const u = new Uint8Array(32)
          for (let i = 0; i < 32; i++) u[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
          keypair = Ed25519Keypair.fromSecretKey(u)
        } else {
          return {
            ok: false,
            error:
              'Ungültiger Signer: Mnemonic (12+ Wörter), IOTA-Bech32-Secret oder 64 Hex (32 Bytes).',
          }
        }
      }
    }
    sessionSigner = keypair
    let addr = String(keypair.toIotaAddress() || '').trim()
    if (addr && !/^0x/i.test(addr)) addr = '0x' + addr
    sessionAddress = addr
    if (addr) {
      persistDirectChainFieldIds({ senderAddress: addr })
    }
    return { ok: true, address: addr }
  } catch (e) {
    clearDirectIotaSessionSigner()
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
