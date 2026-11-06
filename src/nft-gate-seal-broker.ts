/**
 * B2-P4b Key-Broker — Master + Ownership-Check → Wrap-Key.
 */

import fs from 'node:fs'
import path from 'node:path'
import { getClient } from './chain-access.js'
import { addressOwnsObject } from './chain-access.js'
import {
  bytesToBase64,
  deriveNftSealWrapKeyRaw,
  parseNftGateSealMaster,
} from './shared/nft-gate-seal-crypto.js'

const MASTER_FILE = process.env.NFT_GATE_SEAL_MASTER_FILE || '.morgendrot-nft-gate-seal-master'

let cachedMaster: Uint8Array | null = null

function masterFilePath(): string {
  return path.resolve(process.cwd(), MASTER_FILE)
}

export function loadOrCreateNftGateSealMaster(): Uint8Array {
  if (cachedMaster) return cachedMaster
  const fromEnv = (process.env.NFT_GATE_SEAL_MASTER || '').trim()
  if (fromEnv) {
    cachedMaster = parseNftGateSealMaster(fromEnv)
    return cachedMaster
  }
  const fp = masterFilePath()
  try {
    if (fs.existsSync(fp)) {
      const raw = fs.readFileSync(fp, 'utf8').trim()
      cachedMaster = parseNftGateSealMaster(raw)
      return cachedMaster
    }
  } catch {
    /* generate */
  }
  const fresh = new Uint8Array(32)
  globalThis.crypto!.getRandomValues(fresh)
  const b64 = bytesToBase64(fresh)
  try {
    fs.writeFileSync(fp, b64 + '\n', { encoding: 'utf8', mode: 0o600 })
    console.warn(
      `[nft-gate-seal] Neuer Master geschrieben nach ${MASTER_FILE} — sichern; nicht committen.`
    )
  } catch (e) {
    console.warn('[nft-gate-seal] Master-Datei nicht schreibbar:', e)
  }
  cachedMaster = fresh
  return cachedMaster
}

export function isNftGateSealBrokerReady(): boolean {
  try {
    loadOrCreateNftGateSealMaster()
    return true
  } catch {
    return false
  }
}

export async function issueNftSealWrapKey(opts: {
  nftObjectId: string
  requiredWallet?: string | null
}): Promise<{ ok: true; wrapKeyB64: string } | { ok: false; error: string }> {
  try {
    const master = loadOrCreateNftGateSealMaster()
    const key = await deriveNftSealWrapKeyRaw(master, opts.nftObjectId, opts.requiredWallet)
    return { ok: true, wrapKeyB64: bytesToBase64(key) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function issueNftSealUnwrapKey(opts: {
  nftObjectId: string
  requesterAddress: string
  requiredWallet?: string | null
}): Promise<{ ok: true; wrapKeyB64: string } | { ok: false; error: string }> {
  const req = opts.requesterAddress.trim().toLowerCase()
  if (!/^0x[a-f0-9]{64}$/.test(req)) {
    return { ok: false, error: 'requesterAddress ungültig.' }
  }
  if (opts.requiredWallet) {
    const need = opts.requiredWallet.trim().toLowerCase()
    if (need !== req) {
      return { ok: false, error: 'Requester ≠ requiredWallet (P4b Dual-Policy).' }
    }
  }
  try {
    const client = getClient()
    const owns = await addressOwnsObject(client, opts.nftObjectId, req)
    if (!owns) {
      return {
        ok: false,
        error: 'Kein AddressOwner der Schlüsselkarte — Broker gibt keinen Key frei (P4b).',
      }
    }
    return issueNftSealWrapKey({
      nftObjectId: opts.nftObjectId,
      requiredWallet: opts.requiredWallet,
    })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
