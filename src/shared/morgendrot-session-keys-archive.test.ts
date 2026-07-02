import { describe, expect, it } from 'vitest';
import { uint8ToBase64 } from './bytes-base64';
import {
  mergeSessionKeysFromHandshakePeers,
  peerSessionEntryToRuntime,
  resolvePeerPubForEpoch,
  upsertPeerSessionFromHandshakePub,
  rotatePeerSessionEpoch,
  emptySessionKeysArchive,
} from './morgendrot-session-keys-archive';

const PEER = `0x${'cc'.repeat(32)}`;
const PUB_A = new Uint8Array(65).fill(0x04);
const PUB_B = new Uint8Array(65).fill(0x05);

describe('morgendrot-session-keys-archive (H.23 A3)', () => {
  it('legt epoch=1 bei neuem Peer an', () => {
    const file = upsertPeerSessionFromHandshakePub(emptySessionKeysArchive(), PEER, PUB_A);
    expect(file.peers[PEER]?.currentEpoch).toBe(1);
    expect(file.peers[PEER]?.peerPubCurrent).toBe(uint8ToBase64(PUB_A));
  });

  it('archiviert alten Pub und erhöht epoch bei Pub-Wechsel', () => {
    let file = upsertPeerSessionFromHandshakePub(emptySessionKeysArchive(), PEER, PUB_A);
    file = upsertPeerSessionFromHandshakePub(file, PEER, PUB_B);
    const rt = peerSessionEntryToRuntime(file.peers[PEER]!);
    expect(rt.currentEpoch).toBe(2);
    expect(uint8ToBase64(rt.peerPubCurrent)).toBe(uint8ToBase64(PUB_B));
    expect(uint8ToBase64(rt.peerPubArchive.get(1)!)).toBe(uint8ToBase64(PUB_A));
    expect(resolvePeerPubForEpoch(rt, 1)).toEqual(PUB_A);
    expect(resolvePeerPubForEpoch(rt, 2)).toEqual(PUB_B);
  });

  it('migriert aus Handshake-Peer-Map', () => {
    const merged = mergeSessionKeysFromHandshakePeers(null, [[PEER, { pubKeyRaw: PUB_A }]]);
    expect(merged.peers[PEER]?.currentEpoch).toBe(1);
  });

  it('rotatePeerSessionEpoch erhöht keyEpoch ohne Pub-Löschung', () => {
    let file = upsertPeerSessionFromHandshakePub(emptySessionKeysArchive(), PEER, PUB_A);
    const r = rotatePeerSessionEpoch(file, PEER, PUB_A);
    expect(r.newEpoch).toBe(2);
    const rt = peerSessionEntryToRuntime(r.file.peers[PEER]!);
    expect(rt.currentEpoch).toBe(2);
    expect(uint8ToBase64(rt.peerPubCurrent)).toBe(uint8ToBase64(PUB_A));
    expect(uint8ToBase64(rt.peerPubArchive.get(1)!)).toBe(uint8ToBase64(PUB_A));
  });
});
