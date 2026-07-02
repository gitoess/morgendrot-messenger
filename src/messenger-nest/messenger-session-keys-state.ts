/**
 * § H.23 A3 — RAM-Spiegel des Vault Session-Key-Archivs (Nest/API).
 */
import {
  type PeerSessionArchiveEntry,
  type SessionKeysArchiveFile,
  peerSessionEntryToRuntime,
  peerSessionEntryFromRuntime,
  mergeSessionKeysFromHandshakePeers,
  emptySessionKeysArchive,
  getSendKeyEpoch,
  rotatePeerSessionEpoch,
} from '../shared/morgendrot-session-keys-archive.js';
import { loadSessionKeysArchive, saveSessionKeysArchive } from '../vault-local.js';
import { normalizeAddress } from '../utils.js';

let byPeer = new Map<string, PeerSessionArchiveEntry>();

export function clearPeerSessionArchiveState(): void {
  byPeer = new Map();
}

export function getPeerSessionArchive(peerAddr: string): PeerSessionArchiveEntry | undefined {
  const key = normalizeAddress(peerAddr);
  return byPeer.get(key) ?? byPeer.get(peerAddr);
}

export function getSendKeyEpochForPeer(peerAddr: string): number {
  return getSendKeyEpoch(getPeerSessionArchive(peerAddr));
}

export function setPeerSessionArchiveMap(entries: Map<string, PeerSessionArchiveEntry>): void {
  byPeer = new Map(entries);
}

function exportSessionKeysArchiveFile(): SessionKeysArchiveFile {
  const file = emptySessionKeysArchive();
  for (const [addr, entry] of byPeer) {
    const key = normalizeAddress(addr) || addr;
    file.peers[key] = peerSessionEntryFromRuntime(entry);
  }
  return file;
}

function importSessionKeysArchiveFile(file: SessionKeysArchiveFile): void {
  const next = new Map<string, PeerSessionArchiveEntry>();
  for (const [addr, serialized] of Object.entries(file.peers)) {
    try {
      next.set(normalizeAddress(addr) || addr, peerSessionEntryToRuntime(serialized));
    } catch {
      /* skip */
    }
  }
  byPeer = next;
}

export function syncPeerSessionArchiveFromHandshakeMap(
  peers: Map<string, { pubKeyRaw: Uint8Array; handshakeNonce?: bigint }>
): void {
  const iterable: [string, { pubKeyRaw: Uint8Array }][] = [];
  for (const [addr, e] of peers) iterable.push([addr, { pubKeyRaw: e.pubKeyRaw }]);
  const merged = mergeSessionKeysFromHandshakePeers(exportSessionKeysArchiveFile(), iterable);
  importSessionKeysArchiveFile(merged);
}

export async function restoreSessionKeysFromVault(
  vaultPath: string,
  password: string,
  handshakePeers?: Map<string, { pubKeyRaw: Uint8Array; handshakeNonce?: bigint }>
): Promise<void> {
  const loaded = await loadSessionKeysArchive(vaultPath, password);
  let file = loaded;
  if (handshakePeers && handshakePeers.size > 0) {
    const iterable: [string, { pubKeyRaw: Uint8Array }][] = [];
    for (const [addr, e] of handshakePeers) iterable.push([addr, { pubKeyRaw: e.pubKeyRaw }]);
    file = mergeSessionKeysFromHandshakePeers(file, iterable);
    await saveSessionKeysArchive(vaultPath, password, file);
  }
  importSessionKeysArchiveFile(file);
}

export async function persistSessionKeysToVault(vaultPath: string, password: string): Promise<void> {
  await saveSessionKeysArchive(vaultPath, password, exportSessionKeysArchiveFile());
}

export function rotatePeerSessionEpochForPeer(peerAddress: string, peerPubRaw: Uint8Array): number {
  const { file, newEpoch } = rotatePeerSessionEpoch(exportSessionKeysArchiveFile(), peerAddress, peerPubRaw);
  importSessionKeysArchiveFile(file);
  return newEpoch;
}
