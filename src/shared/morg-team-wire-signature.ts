/**
 * Boss-Signatur für Team-Sync-Wires (§ H.36 P3 / TEAM-MEMBER-UPDATE-WIZARD-SPEC §3.1).
 * Schema freeze: Ed25519 signPersonalMessage über kanonisches JSON ohne `sig`.
 */
import { uint8ToBase64 } from './bytes-base64';

export const TEAM_WIRE_SIG_SCHEME = 'ed25519-personal-message-v1' as const;
export const TEAM_WIRE_SIG_DOMAIN = 'MORG_TEAM_WIRE_SIG_V1' as const;

function normAddr(addr: string): string {
  return (addr || '').trim().toLowerCase();
}

/** 64 Hex-Zeichen ohne 0x — für Vergleich IOTA-Adressen. */
function toAddressHex64(addr: string): string | null {
  const t = normAddr(addr);
  const hex = t.startsWith('0x') ? t.slice(2) : t;
  return /^[a-f0-9]{64}$/.test(hex) ? hex : null;
}

/** Rekursive stabile JSON-Serialisierung (sortierte Objekt-Keys). */
export function stableTeamWireJsonStringify(value: unknown): string {
  if (value == null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((x) => stableTeamWireJsonStringify(x)).join(',')}]`;
  }
  const o = value as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableTeamWireJsonStringify(o[k])}`).join(',')}}`;
}

export function stripTeamWireSigField<T extends { sig?: string }>(payload: T): Omit<T, 'sig'> {
  const { sig: _sig, ...rest } = payload;
  return rest;
}

/** Bytes für signPersonalMessage / verifyPersonalMessageSignature. */
export function buildTeamWireSignBytes(payload: Record<string, unknown>): Uint8Array {
  const withoutSig = stripTeamWireSigField(payload as { sig?: string });
  const canonical = stableTeamWireJsonStringify(withoutSig);
  return new TextEncoder().encode(`${TEAM_WIRE_SIG_DOMAIN}:${canonical}`);
}

export function formatTeamWireSignatureBase64(signatureBytes: Uint8Array): string {
  return uint8ToBase64(signatureBytes);
}

function bytesToHex32(bytes: Uint8Array): string {
  return Array.from(bytes.slice(0, 32), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function deriveAddressFromSignerPubKey(signerPubKey: unknown): Promise<string | null> {
  const pk = signerPubKey as {
    toIotaAddress?: () => string
    toAddress?: () => string
    toRaw?: () => Uint8Array
  }
  if (typeof pk.toIotaAddress === 'function') return toAddressHex64(pk.toIotaAddress())
  if (typeof pk.toAddress === 'function') return toAddressHex64(pk.toAddress())
  const raw = pk.toRaw?.()
  if (raw && raw.length >= 32) return bytesToHex32(raw)
  return null
}

export type TeamWireSigVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'missing-boss' | 'missing-sig' | 'invalid-sig' | 'boss-mismatch' };

/** Prüft Ed25519-Personal-Message-Signatur gegen `boss`-Feld im Payload. */
export async function verifyTeamWireSignature(
  payload: Record<string, unknown> & { boss?: string; sig?: string }
): Promise<TeamWireSigVerifyResult> {
  const boss = toAddressHex64(String(payload.boss ?? ''));
  if (!boss) return { ok: false, reason: 'missing-boss' };
  const sig = String(payload.sig ?? '').trim();
  if (!sig) return { ok: false, reason: 'missing-sig' };
  try {
    const message = buildTeamWireSignBytes(payload);
    const { verifyPersonalMessageSignature } = await import('@iota/iota-sdk/verify');
    const signerPubKey = await verifyPersonalMessageSignature(message, sig);
    if (!signerPubKey) return { ok: false, reason: 'invalid-sig' };
    const derived = await deriveAddressFromSignerPubKey(signerPubKey);
    if (!derived) return { ok: false, reason: 'invalid-sig' };
    if (derived !== boss) return { ok: false, reason: 'boss-mismatch' };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'invalid-sig' };
  }
}
