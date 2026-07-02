'use client'

/**
 * § H.23 A3 — Browser-Spiegel des Session-Key-Archivs (localStorage, sync mit Peer-Pub-Map).
 */
import {
  type PeerSessionArchiveEntry,
  type SessionKeysArchiveFile,
  deserializeSessionKeysArchive,
  emptySessionKeysArchive,
  getSendKeyEpoch,
  mergeSessionKeysFromHandshakePeers,
  peerSessionEntryToRuntime,
  upsertPeerSessionFromHandshakePub,
  rotatePeerSessionEpoch,
} from '@morgendrot/shared/morgendrot-session-keys-archive'

const LS_SESSION_KEYS = 'morgendrot.directSessionKeys.v1'

let cache: SessionKeysArchiveFile | null = null

function readFile(): SessionKeysArchiveFile {
  if (cache) return cache
  if (typeof window === 'undefined') {
    cache = emptySessionKeysArchive()
    return cache
  }
  try {
    const raw = window.localStorage.getItem(LS_SESSION_KEYS)?.trim()
    if (!raw) {
      cache = emptySessionKeysArchive()
      return cache
    }
    cache = deserializeSessionKeysArchive(JSON.parse(raw) as object)
    return cache
  } catch {
    cache = emptySessionKeysArchive()
    return cache
  }
}

function writeFile(file: SessionKeysArchiveFile): void {
  cache = file
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_SESSION_KEYS, JSON.stringify(file))
  } catch {
    /* ignore */
  }
}

export function getPeerSessionArchiveForRecipient(peerAddr: string): PeerSessionArchiveEntry | undefined {
  const key = peerAddr.trim().toLowerCase()
  const serialized = readFile().peers[key]
  if (!serialized) return undefined
  try {
    return peerSessionEntryToRuntime(serialized)
  } catch {
    return undefined
  }
}

export function getSendKeyEpochForRecipient(peerAddr: string): number {
  return getSendKeyEpoch(getPeerSessionArchiveForRecipient(peerAddr))
}

export function syncPeerSessionArchiveFromPub(peerAddress: string, peerPubRaw: Uint8Array): void {
  const file = upsertPeerSessionFromHandshakePub(readFile(), peerAddress, peerPubRaw)
  writeFile(file)
}

export function clearDirectSessionKeysArchive(): void {
  cache = emptySessionKeysArchive()
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(LS_SESSION_KEYS)
  } catch {
    /* ignore */
  }
}

export function mergeDirectSessionKeysFromPeerMap(
  peerEntries: Iterable<[string, { pubKeyRaw: Uint8Array }]>
): void {
  const merged = mergeSessionKeysFromHandshakePeers(readFile(), peerEntries)
  writeFile(merged)
}

export function rotatePeerSessionEpochForRecipient(
  peerAddress: string,
  peerPubRaw: Uint8Array
): { ok: true; newEpoch: number } | { ok: false; error: string } {
  try {
    const { file, newEpoch } = rotatePeerSessionEpoch(readFile(), peerAddress, peerPubRaw)
    writeFile(file)
    return { ok: true, newEpoch }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export function importDirectSessionKeysArchiveFromVault(file: SessionKeysArchiveFile): void {
  writeFile(deserializeSessionKeysArchive(file))
}
