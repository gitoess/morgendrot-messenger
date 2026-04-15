'use client'

/**
 * Session-Signer für Direkt-IOTA (nur RAM). **Wird nicht persistiert.**
 * Gleiche Import-Regeln wie Node `sdk-signer-import`: Mnemonic (12+ Wörter), Bech32-Secret oder 64-Hex.
 */
import type { Signer } from '@iota/iota-sdk/cryptography'
import { Ed25519Keypair } from '@iota/iota-sdk/keypairs/ed25519'

let sessionSigner: Signer | null = null
let sessionAddress: string | null = null

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
    return { ok: true, address: addr }
  } catch (e) {
    clearDirectIotaSessionSigner()
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
