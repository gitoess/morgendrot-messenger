import { describe, expect, it } from 'vitest';
import { generateKeyPair } from './morgendrot-crypto';
import {
  encryptIotaPeerSessionMessage,
  decryptIotaPeerSessionMessage,
} from './morgendrot-crypto-session-wire';
import {
  peerSessionEntryToRuntime,
  upsertPeerSessionFromHandshakePub,
  emptySessionKeysArchive,
} from './morgendrot-session-keys-archive';

const PEER_A = `0x${'aa'.repeat(32)}`;
const PEER_B = `0x${'bb'.repeat(32)}`;

describe('morgendrot-crypto-session-wire + archive (H.23 A3)', () => {
  it('entschlüsselt alte epoch nach Remote-Pub-Rotation via Archiv', async () => {
    const a1 = await generateKeyPair(true);
    const a2 = await generateKeyPair(true);
    const b = await generateKeyPair(true);
    const plain = 'Nachricht epoch 1';
    const enc = await encryptIotaPeerSessionMessage({
      plaintext: plain,
      myAddress: PEER_A,
      peerAddress: PEER_B,
      myPrivKey: a1.privateKey,
      peerPubRaw: b.pubRaw,
      msgId: 'n1',
      keyEpoch: 1,
    });
    let file = upsertPeerSessionFromHandshakePub(emptySessionKeysArchive(), PEER_A, a1.pubRaw);
    file = upsertPeerSessionFromHandshakePub(file, PEER_A, a2.pubRaw);
    const archive = peerSessionEntryToRuntime(file.peers[PEER_A]!);
    expect(archive.currentEpoch).toBe(2);
    const dec = await decryptIotaPeerSessionMessage({
      iv: enc.iv,
      ciphertext: enc.ciphertext,
      tag: enc.tag,
      myAddress: PEER_B,
      peerAddress: PEER_A,
      myPrivKey: b.privateKey,
      peerPubRaw: a2.pubRaw,
      sessionArchive: archive,
    });
    expect(dec).toBe(plain);
  });
});
