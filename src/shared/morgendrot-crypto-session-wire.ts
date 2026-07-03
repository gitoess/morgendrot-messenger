/**
 * § H.23 Phase A2 — IOTA 1:1 Send/Decrypt mit Envelope v2 (Move-Felder unverändert).
 * v2: MG2-Prefix + Envelope-JSON in `ciphertext`; v1: roher Cipher-Body (Legacy).
 */
import { base64ToUint8, uint8ToBase64 } from './bytes-base64';
import { deriveAesGcmKey, deriveSharedSecret, decryptMessage } from './morgendrot-crypto';
import {
  type MorgMsgEnvelopeV2,
  DEFAULT_SESSION_KEY_EPOCH,
  SESSION_CIPHER_SUITE_P256_AES_GCM,
  deriveSessionAesGcmKey,
  serializeMorgMsgAad,
  encryptSessionMessage,
  decryptSessionMessage,
} from './morgendrot-crypto-session';
import {
  type PeerSessionArchiveEntry,
  listPeerPubsForEpochDecrypt,
} from './morgendrot-session-keys-archive';

const MORG_SESSION_WIRE_MAGIC = new Uint8Array([0x4d, 0x47, 0x32, 0x02]);

export { DEFAULT_SESSION_KEY_EPOCH, SESSION_CIPHER_SUITE_P256_AES_GCM };

export type IotaPeerSessionEncryptParams = {
  plaintext: string;
  myAddress: string;
  peerAddress: string;
  myPrivKey: CryptoKey;
  peerPubRaw: Uint8Array;
  msgId: string;
  keyEpoch?: number;
  skid?: string;
  ts?: number;
};

export type IotaPeerSessionDecryptParams = {
  iv: Uint8Array;
  ciphertext: Uint8Array;
  tag: Uint8Array;
  myAddress: string;
  peerAddress: string;
  myPrivKey: CryptoKey;
  peerPubRaw: Uint8Array;
  sessionArchive?: PeerSessionArchiveEntry;
};

function readU32Be(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0
  );
}

function writeU32Be(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function randomSkid(): string {
  const b = new Uint8Array(4);
  globalThis.crypto!.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function buildSessionEnvelope(
  msgId: string,
  opts?: { keyEpoch?: number; skid?: string; ts?: number }
): MorgMsgEnvelopeV2 {
  return {
    v: 2,
    cs: SESSION_CIPHER_SUITE_P256_AES_GCM,
    epoch: opts?.keyEpoch ?? DEFAULT_SESSION_KEY_EPOCH,
    skid: opts?.skid ?? randomSkid(),
    msgId,
    ts: opts?.ts ?? Date.now(),
  };
}

export function isSessionWireV2Ciphertext(ciphertext: Uint8Array): boolean {
  if (ciphertext.length < MORG_SESSION_WIRE_MAGIC.length + 4) return false;
  for (let i = 0; i < MORG_SESSION_WIRE_MAGIC.length; i++) {
    if (ciphertext[i] !== MORG_SESSION_WIRE_MAGIC[i]) return false;
  }
  return true;
}

export function parseSessionEnvelopeJson(json: string): MorgMsgEnvelopeV2 {
  const parsed = JSON.parse(json) as Partial<MorgMsgEnvelopeV2>;
  if (parsed.v !== 2 || typeof parsed.epoch !== 'number' || typeof parsed.msgId !== 'string') {
    throw new Error('parseSessionEnvelopeJson: kein gültiges Envelope v2');
  }
  return {
    v: 2,
    cs: typeof parsed.cs === 'number' ? parsed.cs : SESSION_CIPHER_SUITE_P256_AES_GCM,
    epoch: parsed.epoch,
    skid: String(parsed.skid ?? ''),
    msgId: parsed.msgId,
    ts: typeof parsed.ts === 'number' ? parsed.ts : 0,
  };
}

export function unpackSessionWireV2(ciphertext: Uint8Array): { envelope: MorgMsgEnvelopeV2; cipherBody: Uint8Array } {
  if (!isSessionWireV2Ciphertext(ciphertext)) {
    throw new Error('unpackSessionWireV2: kein MG2-Wire');
  }
  const envLen = readU32Be(ciphertext, MORG_SESSION_WIRE_MAGIC.length);
  const envStart = MORG_SESSION_WIRE_MAGIC.length + 4;
  const envEnd = envStart + envLen;
  if (envEnd > ciphertext.length) {
    throw new Error('unpackSessionWireV2: Envelope-Länge ungültig');
  }
  const envelope = parseSessionEnvelopeJson(new TextDecoder().decode(ciphertext.subarray(envStart, envEnd)));
  return { envelope, cipherBody: ciphertext.subarray(envEnd) };
}

export function packSessionWireV2(envelope: MorgMsgEnvelopeV2, cipherBody: Uint8Array): Uint8Array {
  const envBytes = serializeMorgMsgAad(envelope);
  const out = new Uint8Array(MORG_SESSION_WIRE_MAGIC.length + 4 + envBytes.length + cipherBody.length);
  out.set(MORG_SESSION_WIRE_MAGIC, 0);
  writeU32Be(out, MORG_SESSION_WIRE_MAGIC.length, envBytes.length);
  out.set(envBytes, MORG_SESSION_WIRE_MAGIC.length + 4);
  out.set(cipherBody, MORG_SESSION_WIRE_MAGIC.length + 4 + envBytes.length);
  return out;
}

function splitGcmCipherAndTag(full: Uint8Array): { cipherBody: Uint8Array; tag: Uint8Array } {
  if (full.length < 16) throw new Error('splitGcmCipherAndTag: Nutzlast zu kurz');
  return {
    cipherBody: full.subarray(0, -16),
    tag: full.subarray(-16),
  };
}

/** Verschlüsselt mit Session Keys+ v2 (Standard für neue IOTA-1:1-Sends). */
export async function encryptIotaPeerSessionMessage(
  params: IotaPeerSessionEncryptParams
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array }> {
  const sharedSecret = await deriveSharedSecret(params.myPrivKey, params.peerPubRaw);
  const envelope = buildSessionEnvelope(params.msgId, {
    keyEpoch: params.keyEpoch,
    skid: params.skid,
    ts: params.ts,
  });
  const aad = serializeMorgMsgAad(envelope);
  const aesKey = await deriveSessionAesGcmKey(
    sharedSecret,
    params.myAddress,
    params.peerAddress,
    envelope.epoch
  );
  const encrypted = await encryptSessionMessage(aesKey, params.plaintext, aad);
  const full = base64ToUint8(encrypted.ciphertext);
  const { cipherBody, tag } = splitGcmCipherAndTag(full);
  return {
    ciphertext: packSessionWireV2(envelope, cipherBody),
    iv: base64ToUint8(encrypted.iv),
    tag,
  };
}

/** Entschlüsselt v2 (MG2-Wire) oder fällt auf v1 Legacy zurück. */
export async function decryptIotaPeerSessionMessage(params: IotaPeerSessionDecryptParams): Promise<string> {
  const ivB64 = uint8ToBase64(params.iv);

  if (isSessionWireV2Ciphertext(params.ciphertext)) {
    const { envelope, cipherBody } = unpackSessionWireV2(params.ciphertext);
    const combined = uint8ToBase64(new Uint8Array([...cipherBody, ...params.tag]));
    const aad = serializeMorgMsgAad(envelope);
    const pubs = listPeerPubsForEpochDecrypt(params.sessionArchive, envelope.epoch, params.peerPubRaw);
    let lastErr: unknown;
    for (const peerPub of pubs) {
      try {
        const sharedSecret = await deriveSharedSecret(params.myPrivKey, peerPub);
        const aesKey = await deriveSessionAesGcmKey(
          sharedSecret,
          params.myAddress,
          params.peerAddress,
          envelope.epoch
        );
        return await decryptSessionMessage(aesKey, ivB64, combined, aad);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('Session v2 Entschlüsselung fehlgeschlagen.');
  }

  const sharedSecret = await deriveSharedSecret(params.myPrivKey, params.peerPubRaw);
  const aesKey = await deriveAesGcmKey(sharedSecret);
  const combined = uint8ToBase64(new Uint8Array([...params.ciphertext, ...params.tag]));
  return await decryptMessage(aesKey, ivB64, combined);
}
