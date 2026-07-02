import { describe, expect, it } from 'vitest';
import { generateKeyPair, deriveSharedSecret } from './morgendrot-crypto';
import {
  buildSessionEnvelope,
  decryptIotaPeerSessionMessage,
  encryptIotaPeerSessionMessage,
  isSessionWireV2Ciphertext,
  packSessionWireV2,
  unpackSessionWireV2,
} from './morgendrot-crypto-session-wire';
import { deriveAesGcmKey, encryptMessage } from './morgendrot-crypto';
import { base64ToUint8, uint8ToBase64 } from './bytes-base64';

const PEER_A = `0x${'aa'.repeat(32)}`;
const PEER_B = `0x${'bb'.repeat(32)}`;

describe('morgendrot-crypto-session-wire (H.23 A2)', () => {
  it('v2 roundtrip Nest/Frontend-Pfade', async () => {
    const a = await generateKeyPair(true);
    const b = await generateKeyPair(true);
    const plain = 'Hallo Session v2';
    const enc = await encryptIotaPeerSessionMessage({
      plaintext: plain,
      myAddress: PEER_A,
      peerAddress: PEER_B,
      myPrivKey: a.privateKey,
      peerPubRaw: b.pubRaw,
      msgId: 'nonce-42',
      keyEpoch: 1,
      skid: 'a1b2c3d4',
      ts: 1_700_000_000_000,
    });
    expect(isSessionWireV2Ciphertext(enc.ciphertext)).toBe(true);
    const secretB = await deriveSharedSecret(b.privateKey, a.pubRaw);
    expect(secretB).toBeDefined();
    const dec = await decryptIotaPeerSessionMessage({
      iv: enc.iv,
      ciphertext: enc.ciphertext,
      tag: enc.tag,
      myAddress: PEER_B,
      peerAddress: PEER_A,
      myPrivKey: b.privateKey,
      peerPubRaw: a.pubRaw,
    });
    expect(dec).toBe(plain);
  });

  it('Legacy v1 ohne MG2-Prefix bleibt lesbar', async () => {
    const a = await generateKeyPair(true);
    const b = await generateKeyPair(true);
    const plain = 'Legacy v1';
    const secret = await deriveSharedSecret(a.privateKey, b.pubRaw);
    const aesKey = await deriveAesGcmKey(secret);
    const encrypted = await encryptMessage(aesKey, plain);
    const full = base64ToUint8(encrypted.ciphertext);
    const ciphertext = full.subarray(0, -16);
    const tag = full.subarray(-16);
    const iv = base64ToUint8(encrypted.iv);
    const dec = await decryptIotaPeerSessionMessage({
      iv,
      ciphertext,
      tag,
      myAddress: PEER_B,
      peerAddress: PEER_A,
      myPrivKey: b.privateKey,
      peerPubRaw: a.pubRaw,
    });
    expect(dec).toBe(plain);
    expect(isSessionWireV2Ciphertext(ciphertext)).toBe(false);
  });

  it('pack/unpack Envelope stabil', () => {
    const env = buildSessionEnvelope('id-1', { keyEpoch: 2, skid: 'deadbeef', ts: 99 });
    const body = new Uint8Array([1, 2, 3]);
    const packed = packSessionWireV2(env, body);
    const { envelope, cipherBody } = unpackSessionWireV2(packed);
    expect(envelope.epoch).toBe(2);
    expect(envelope.msgId).toBe('id-1');
    expect(uint8ToBase64(cipherBody)).toBe(uint8ToBase64(body));
  });
});
