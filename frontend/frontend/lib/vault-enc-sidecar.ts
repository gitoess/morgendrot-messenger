/**
 * AES-GCM Sidecar in localStorage (Vault-Passwort), Schema-String pro Store.
 */

import {
  decryptHandoffEnvUtf8,
  encryptHandoffEnvUtf8,
  type HandoffCryptoMetaJson,
} from '@/frontend/lib/handoff-zip-crypto'

export type VaultEncSidecarPayload = {
  schema: string
  crypto: HandoffCryptoMetaJson
  ciphertextB64: string
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

export async function writeVaultEncSidecar(
  lsKey: string,
  schema: string,
  plainUtf8: string,
  password: string
): Promise<void> {
  if (typeof window === 'undefined') return
  const { meta, ciphertext } = await encryptHandoffEnvUtf8(plainUtf8, password)
  const payload: VaultEncSidecarPayload = {
    schema,
    crypto: meta,
    ciphertextB64: bytesToB64(ciphertext),
  }
  window.localStorage.setItem(lsKey, JSON.stringify(payload))
}

export async function readVaultEncSidecar(
  lsKey: string,
  schema: string,
  password: string
): Promise<{ ok: true; plainUtf8: string } | { ok: false; error: string; missing?: boolean }> {
  if (typeof window === 'undefined') return { ok: false, error: 'Kein Browser.' }
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(lsKey)
  } catch {
    return { ok: false, error: 'localStorage nicht lesbar.' }
  }
  if (!raw?.trim()) return { ok: false, error: 'Kein Sidecar.', missing: true }
  try {
    const payload = JSON.parse(raw) as Partial<VaultEncSidecarPayload>
    if (payload.schema !== schema || !payload.crypto || !payload.ciphertextB64) {
      return { ok: false, error: 'Unbekanntes Sidecar-Format.' }
    }
    const dec = await decryptHandoffEnvUtf8(payload.crypto, b64ToBytes(payload.ciphertextB64), password)
    if (!dec.ok) return { ok: false, error: dec.error }
    return { ok: true, plainUtf8: dec.envText }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export function removeVaultEncSidecar(lsKey: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(lsKey)
  } catch {
    /* ignore */
  }
}

export function hasVaultEncSidecar(lsKey: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return !!window.localStorage.getItem(lsKey)?.trim()
  } catch {
    return false
  }
}
