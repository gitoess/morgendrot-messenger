import '../install-webcrypto-node.js';
import { describe, expect, it } from 'vitest';
import {
  buildSessionKeyInfo,
  deriveSessionAesGcmKey,
  encryptSessionMessage,
  decryptSessionMessage,
  serializeMorgMsgAad,
  type MorgMsgEnvelopeV2,
} from './morgendrot-crypto-session.js';
import { deriveSharedSecret, generateKeyPair } from './morgendrot-crypto.js';

const PEER_A = '0x' + 'a'.repeat(64);
const PEER_B = '0x' + 'b'.repeat(64);

describe('morgendrot-crypto-session (H.23 A1)', () => {
  it('buildSessionKeyInfo sortiert Adresspaar symmetrisch', () => {
    const ab = new TextDecoder().decode(buildSessionKeyInfo(PEER_A, PEER_B, 1));
    const ba = new TextDecoder().decode(buildSessionKeyInfo(PEER_B, PEER_A, 1));
    expect(ab).toBe(ba);
    expect(ab).toContain('morgendrot-session-v2:');
  });

  it('Session-Key unterscheidet sich von epoch und v1-Info', async () => {
    const a = await generateKeyPair(true);
    const b = await generateKeyPair(true);
    const secret = await deriveSharedSecret(a.privateKey, b.pubRaw);
    const k0 = await deriveSessionAesGcmKey(secret, PEER_A, PEER_B, 0);
    const k1 = await deriveSessionAesGcmKey(secret, PEER_A, PEER_B, 1);
    const raw0 = new Uint8Array(await crypto.subtle.exportKey('raw', k0));
    const raw1 = new Uint8Array(await crypto.subtle.exportKey('raw', k1));
    expect(Buffer.compare(raw0, raw1)).not.toBe(0);
  });

  it('encrypt/decrypt mit Envelope-AAD roundtrip', async () => {
    const a = await generateKeyPair(true);
    const b = await generateKeyPair(true);
    const secretA = await deriveSharedSecret(a.privateKey, b.pubRaw);
    const secretB = await deriveSharedSecret(b.privateKey, a.pubRaw);
    const keyA = await deriveSessionAesGcmKey(secretA, PEER_A, PEER_B, 3);
    const keyB = await deriveSessionAesGcmKey(secretB, PEER_B, PEER_A, 3);

    const envelope: MorgMsgEnvelopeV2 = {
      v: 2,
      cs: 1,
      epoch: 3,
      skid: 'a1b2c3d4',
      msgId: 'msg-test-1',
      ts: 1_718_550_000_000,
    };
    const aad = serializeMorgMsgAad(envelope);
    const plain = 'Session Keys+ Test';
    const { iv, ciphertext } = await encryptSessionMessage(keyA, plain, aad);
    const dec = await decryptSessionMessage(keyB, iv, ciphertext, aad);
    expect(dec).toBe(plain);
  });

  it('AAD-Manipulation schlägt fehl', async () => {
    const a = await generateKeyPair(true);
    const b = await generateKeyPair(true);
    const secretA = await deriveSharedSecret(a.privateKey, b.pubRaw);
    const keyA = await deriveSessionAesGcmKey(secretA, PEER_A, PEER_B, 0);
    const aad = serializeMorgMsgAad({
      v: 2,
      cs: 1,
      epoch: 0,
      skid: '00000000',
      msgId: 'x',
      ts: 1,
    });
    const { iv, ciphertext } = await encryptSessionMessage(keyA, 'secret', aad);
    const tampered = serializeMorgMsgAad({
      v: 2,
      cs: 1,
      epoch: 99,
      skid: '00000000',
      msgId: 'x',
      ts: 1,
    });
    await expect(decryptSessionMessage(keyA, iv, ciphertext, tampered)).rejects.toThrow();
  });
});
