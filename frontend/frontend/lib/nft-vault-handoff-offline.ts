/**
 * Offline-Weitergabe des Vault-Index: kompakt (Mesh/QR) + optional signiert.
 * Claim on-chain = später (Discovery/Digest); lokal reicht applyNftVaultHandoff.
 */

import QRCode from 'qrcode'
import {
  buildNftVaultTransferBundleText,
  encodeNftVaultHandoff,
  parseNftVaultHandoff,
  type NftVaultHandoffPack,
} from '@/frontend/lib/nft-vault-handoff'
import {
  getDirectIotaSessionSigner,
  getDirectIotaSessionSignerAddress,
} from '@/frontend/lib/direct-iota-mnemonic-session'

export const NFT_VAULT_HANDOFF_COMPACT_PREFIX = 'MORG_NFT_V1C:'
export const NFT_VAULT_HANDOFF_SIGNED_PREFIX = 'MORG_NFT_VAULT_V1S:'

type CompactBody = {
  k: 'b' | 'g'
  n: string
  v: string
  d?: string
  p?: string
  l?: string
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  const b64 = typeof btoa !== 'undefined' ? btoa(bin) : Buffer.from(bytes).toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): Uint8Array | null {
  try {
    const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad
    const bin = typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary')
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

export function encodeNftVaultHandoffCompact(pack: NftVaultHandoffPack): string {
  const body: CompactBody = {
    k: pack.kind === 'bearer' ? 'b' : 'g',
    n: pack.nftObjectId,
    v: pack.vaultObjectId,
    ...(pack.createDigest ? { d: pack.createDigest } : {}),
    ...(pack.messagingPackageId ? { p: pack.messagingPackageId } : {}),
    ...(pack.displayLabel ? { l: pack.displayLabel.slice(0, 24) } : {}),
  }
  const json = JSON.stringify(body)
  const bytes = new TextEncoder().encode(json)
  return NFT_VAULT_HANDOFF_COMPACT_PREFIX + b64urlEncode(bytes)
}

export function parseNftVaultHandoffCompact(raw: string): NftVaultHandoffPack | null {
  const t = raw.trim()
  if (!t.startsWith(NFT_VAULT_HANDOFF_COMPACT_PREFIX)) return null
  const bytes = b64urlDecode(t.slice(NFT_VAULT_HANDOFF_COMPACT_PREFIX.length))
  if (!bytes) return null
  try {
    const j = JSON.parse(new TextDecoder().decode(bytes)) as CompactBody
    if (j.k !== 'b' && j.k !== 'g') return null
    const nftObjectId = String(j.n || '').trim().toLowerCase()
    const vaultObjectId = String(j.v || '').trim().toLowerCase()
    if (!/^0x[a-f0-9]{64}$/.test(nftObjectId) || !/^0x[a-f0-9]{64}$/.test(vaultObjectId)) return null
    return {
      v: 1,
      kind: j.k === 'b' ? 'bearer' : 'guarded',
      nftObjectId,
      vaultObjectId,
      ...(j.d?.trim() ? { createDigest: j.d.trim() } : {}),
      ...(j.p?.trim() ? { messagingPackageId: j.p.trim().toLowerCase() } : {}),
      ...(j.l?.trim() ? { displayLabel: j.l.trim() } : {}),
    }
  } catch {
    return null
  }
}

function signBytes(pack: NftVaultHandoffPack, issuer: string, ts: number): Uint8Array {
  const payload = `MORG_NFT_VAULT_SIGN_V1|${issuer}|${ts}|${pack.kind}|${pack.nftObjectId}|${pack.vaultObjectId}|${pack.createDigest || ''}`
  return new TextEncoder().encode(payload)
}

export async function encodeNftVaultHandoffSigned(
  pack: NftVaultHandoffPack
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const signer = getDirectIotaSessionSigner() as {
    signPersonalMessage?: (msg: Uint8Array) => Promise<{ signature?: string }>
  } | null
  const issuer = getDirectIotaSessionSignerAddress()
  if (!signer?.signPersonalMessage || !issuer) {
    return { ok: false, error: 'Kein Session-Signer zum Signieren — Tresor entsperren.' }
  }
  const ts = Date.now()
  try {
    const { signature } = await signer.signPersonalMessage(signBytes(pack, issuer, ts))
    if (!signature) return { ok: false, error: 'Signatur leer.' }
    const envelope = {
      v: 1 as const,
      pack,
      iss: issuer.toLowerCase(),
      ts,
      sig: signature,
    }
    return { ok: true, text: NFT_VAULT_HANDOFF_SIGNED_PREFIX + JSON.stringify(envelope) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export function parseNftVaultHandoffSigned(raw: string): {
  pack: NftVaultHandoffPack
  issuer: string
  issuedAtMs: number
  signature: string
} | null {
  const t = raw.trim()
  if (!t.startsWith(NFT_VAULT_HANDOFF_SIGNED_PREFIX)) return null
  try {
    const j = JSON.parse(t.slice(NFT_VAULT_HANDOFF_SIGNED_PREFIX.length)) as {
      v?: number
      pack?: unknown
      iss?: string
      ts?: number
      sig?: string
    }
    if (j.v !== 1 || !j.pack || !j.iss || !j.sig || typeof j.ts !== 'number') return null
    const rawPack = j.pack as Partial<NftVaultHandoffPack>
    const pack = parseNftVaultHandoff(
      JSON.stringify({
        v: 1,
        kind: rawPack.kind,
        nftObjectId: rawPack.nftObjectId,
        vaultObjectId: rawPack.vaultObjectId,
        createDigest: rawPack.createDigest,
        messagingPackageId: rawPack.messagingPackageId,
        displayLabel: rawPack.displayLabel,
      })
    )
    if (!pack) return null
    return { pack, issuer: j.iss.toLowerCase(), issuedAtMs: j.ts, signature: j.sig }
  } catch {
    return null
  }
}

/** Akzeptiert V1 / Compact / Signed — auch aus Bundle-Text (mehrzeilig). */
export function parseAnyNftVaultHandoff(raw: string): NftVaultHandoffPack | null {
  const t = raw.trim()
  if (t.startsWith(NFT_VAULT_HANDOFF_SIGNED_PREFIX)) {
    return parseNftVaultHandoffSigned(t)?.pack || null
  }
  if (t.startsWith(NFT_VAULT_HANDOFF_COMPACT_PREFIX)) {
    return parseNftVaultHandoffCompact(t)
  }
  const direct = parseNftVaultHandoff(t)
  if (direct) return direct
  for (const line of t.split(/\r?\n/)) {
    const L = line.trim()
    if (!L) continue
    if (L.startsWith(NFT_VAULT_HANDOFF_SIGNED_PREFIX)) {
      const p = parseNftVaultHandoffSigned(L)?.pack
      if (p) return p
    }
    if (L.startsWith(NFT_VAULT_HANDOFF_COMPACT_PREFIX)) {
      const p = parseNftVaultHandoffCompact(L)
      if (p) return p
    }
    if (L.startsWith('MORG_NFT_VAULT_V1:')) {
      const p = parseNftVaultHandoff(L)
      if (p) return p
    }
  }
  return null
}

export async function nftVaultHandoffToQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { width: 280, margin: 1, errorCorrectionLevel: 'M' })
}

/** Bevorzugt Compact für QR/Mesh (kürzer); Bundle = Chat/Mesh mit NFT+Vault. */
export function preferOfflineHandoffText(pack: NftVaultHandoffPack): {
  compact: string
  full: string
  /** Chat/Mesh: lesbare NFT+Vault-Zeilen + Compact (ein Paste). */
  bundle: string
} {
  const compact = encodeNftVaultHandoffCompact(pack)
  return {
    compact,
    full: encodeNftVaultHandoff(pack),
    bundle: buildNftVaultTransferBundleText(pack, compact),
  }
}
