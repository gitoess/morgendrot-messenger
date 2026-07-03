/**
 * § H.23 Phase A3 — Session-Key-Archiv (Peer-Pub pro keyEpoch, kein Raw-Key on-disk).
 */
import { base64ToUint8, uint8ToBase64 } from './bytes-base64';
import { DEFAULT_SESSION_KEY_EPOCH } from './morgendrot-crypto-session';

export const SESSION_KEYS_SCHEMA = 1 as const;

export type PeerSessionArchiveEntry = {
  currentEpoch: number;
  peerPubCurrent: Uint8Array;
  peerPubArchive: Map<number, Uint8Array>;
};

export type SerializedPeerSessionEntry = {
  currentEpoch: number;
  peerPubCurrent: string;
  peerPubArchive: Record<string, string>;
};

export type SessionKeysArchiveFile = {
  schema: typeof SESSION_KEYS_SCHEMA;
  peers: Record<string, SerializedPeerSessionEntry>;
};

export function normalizeSessionPeerAddress(addr: string): string {
  const t = String(addr || '').trim().toLowerCase();
  if (!/^0x[a-f0-9]{64}$/.test(t)) return '';
  return t;
}

export function emptySessionKeysArchive(): SessionKeysArchiveFile {
  return { schema: SESSION_KEYS_SCHEMA, peers: {} };
}

export function peerSessionEntryToRuntime(entry: SerializedPeerSessionEntry): PeerSessionArchiveEntry {
  const peerPubArchive = new Map<number, Uint8Array>();
  for (const [epochKey, b64] of Object.entries(entry.peerPubArchive ?? {})) {
    const epoch = Number(epochKey);
    if (!Number.isInteger(epoch) || epoch < 1) continue;
    try {
      peerPubArchive.set(epoch, base64ToUint8(b64));
    } catch {
      /* skip */
    }
  }
  return {
    currentEpoch: entry.currentEpoch,
    peerPubCurrent: base64ToUint8(entry.peerPubCurrent),
    peerPubArchive,
  };
}

export function peerSessionEntryFromRuntime(entry: PeerSessionArchiveEntry): SerializedPeerSessionEntry {
  const peerPubArchive: Record<string, string> = {};
  for (const [epoch, pub] of entry.peerPubArchive.entries()) {
    peerPubArchive[String(epoch)] = uint8ToBase64(pub);
  }
  return {
    currentEpoch: entry.currentEpoch,
    peerPubCurrent: uint8ToBase64(entry.peerPubCurrent),
    peerPubArchive,
  };
}

export function deserializeSessionKeysArchive(obj: object | null): SessionKeysArchiveFile {
  if (!obj || typeof obj !== 'object') return emptySessionKeysArchive();
  const peers = (obj as SessionKeysArchiveFile).peers;
  if (!peers || typeof peers !== 'object') return emptySessionKeysArchive();
  const out: Record<string, SerializedPeerSessionEntry> = {};
  for (const [addr, entry] of Object.entries(peers)) {
    const key = normalizeSessionPeerAddress(addr);
    if (!key || !entry?.peerPubCurrent) continue;
    try {
      base64ToUint8(entry.peerPubCurrent);
      out[key] = {
        currentEpoch: Number(entry.currentEpoch) || DEFAULT_SESSION_KEY_EPOCH,
        peerPubCurrent: entry.peerPubCurrent,
        peerPubArchive: entry.peerPubArchive ?? {},
      };
    } catch {
      /* skip */
    }
  }
  return { schema: SESSION_KEYS_SCHEMA, peers: out };
}

export function upsertPeerSessionFromHandshakePub(
  file: SessionKeysArchiveFile,
  peerAddress: string,
  pubKeyRaw: Uint8Array
): SessionKeysArchiveFile {
  const key = normalizeSessionPeerAddress(peerAddress);
  if (!key) return file;
  const pubB64 = uint8ToBase64(pubKeyRaw);
  const existing = file.peers[key];
  if (!existing) {
    return {
      ...file,
      peers: {
        ...file.peers,
        [key]: {
          currentEpoch: DEFAULT_SESSION_KEY_EPOCH,
          peerPubCurrent: pubB64,
          peerPubArchive: {},
        },
      },
    };
  }
  if (existing.peerPubCurrent === pubB64) return file;
  const peerPubArchive = { ...existing.peerPubArchive };
  peerPubArchive[String(existing.currentEpoch)] = existing.peerPubCurrent;
  return {
    ...file,
    peers: {
      ...file.peers,
      [key]: {
        currentEpoch: existing.currentEpoch + 1,
        peerPubCurrent: pubB64,
        peerPubArchive,
      },
    },
  };
}

export function mergeSessionKeysFromHandshakePeers(
  file: SessionKeysArchiveFile | null,
  handshakePeers: Iterable<[string, { pubKeyRaw: Uint8Array }]>
): SessionKeysArchiveFile {
  let merged = file ?? emptySessionKeysArchive();
  for (const [addr, peer] of handshakePeers) {
    merged = upsertPeerSessionFromHandshakePub(merged, addr, peer.pubKeyRaw);
  }
  return merged;
}

export function resolvePeerPubForEpoch(entry: PeerSessionArchiveEntry, epoch: number): Uint8Array | null {
  if (!Number.isInteger(epoch) || epoch < 1) return null;
  if (epoch === entry.currentEpoch) return entry.peerPubCurrent;
  const archived = entry.peerPubArchive.get(epoch);
  if (archived) return archived;
  if (epoch === DEFAULT_SESSION_KEY_EPOCH && entry.currentEpoch >= epoch) {
    return entry.peerPubCurrent;
  }
  return null;
}

/** Pubkeys zum Entschlüsseln einer v2-Nachricht (Reihenfolge: epoch-spezifisch, dann Live-Fallback). */
export function listPeerPubsForEpochDecrypt(
  entry: PeerSessionArchiveEntry | undefined,
  epoch: number,
  livePeerPub: Uint8Array
): Uint8Array[] {
  const out: Uint8Array[] = [];
  const seen = new Set<string>();
  const add = (pub: Uint8Array) => {
    const id = uint8ToBase64(pub);
    if (seen.has(id)) return;
    seen.add(id);
    out.push(pub);
  };
  if (entry) {
    const resolved = resolvePeerPubForEpoch(entry, epoch);
    if (resolved) add(resolved);
    if (entry.peerPubCurrent) add(entry.peerPubCurrent);
  }
  add(livePeerPub);
  return out;
}

export function getSendKeyEpoch(entry: PeerSessionArchiveEntry | undefined): number {
  return entry?.currentEpoch ?? DEFAULT_SESSION_KEY_EPOCH;
}

/** UI-Rotation (§ H.23 A4): keyEpoch++ bei gleichem Peer-Pub — alte Nachrichten bleiben lesbar. */
export function rotatePeerSessionEpoch(
  file: SessionKeysArchiveFile,
  peerAddress: string,
  peerPubRaw: Uint8Array
): { file: SessionKeysArchiveFile; newEpoch: number } {
  const key = normalizeSessionPeerAddress(peerAddress);
  if (!key) throw new Error('rotatePeerSessionEpoch: ungültige Peer-Adresse.');
  const pubB64 = uint8ToBase64(peerPubRaw);
  const existing = file.peers[key];
  if (!existing) {
    const newEpoch = DEFAULT_SESSION_KEY_EPOCH + 1;
    return {
      file: {
        ...file,
        peers: {
          ...file.peers,
          [key]: {
            currentEpoch: newEpoch,
            peerPubCurrent: pubB64,
            peerPubArchive: { [String(DEFAULT_SESSION_KEY_EPOCH)]: pubB64 },
          },
        },
      },
      newEpoch,
    };
  }
  const peerPubArchive = { ...existing.peerPubArchive };
  peerPubArchive[String(existing.currentEpoch)] = existing.peerPubCurrent;
  const newEpoch = existing.currentEpoch + 1;
  return {
    file: {
      ...file,
      peers: {
        ...file.peers,
        [key]: {
          currentEpoch: newEpoch,
          peerPubCurrent: pubB64,
          peerPubArchive,
        },
      },
    },
    newEpoch,
  };
}
