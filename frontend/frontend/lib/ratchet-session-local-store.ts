'use client'

/**
 * H.23 C1.4 — Double-Ratchet Peer-State at rest (Vault-Passwort AES-GCM).
 * Nur Symmetric-Snapshots (DH-PKCS8 später). Kein Composer-Default.
 */

import {
  MorgRatchetSession,
  type RatchetPeerSnapshotV1,
} from '@morgendrot/shared/morgendrot-ratchet-session'
import {
  hasVaultEncSidecar,
  readVaultEncSidecar,
  removeVaultEncSidecar,
  writeVaultEncSidecar,
} from '@/frontend/lib/vault-enc-sidecar'
import {
  getVaultPasswordSession,
  hasVaultPasswordSession,
} from '@/frontend/lib/vault-password-session'

export const RATCHET_ENC_LS_KEY = 'morgendrot.ratchet.enc.v1'
export const RATCHET_ENC_SCHEMA = 'morgendrot.ratchet.enc.v1'
export const RATCHET_VAULT_CHANGED_EVENT = 'morgendrot:ratchet-vault'

const PERSIST_DEBOUNCE_MS = 400
const HEX64 = /^0x[a-f0-9]{64}$/

type PlainV1 = {
  v: 1
  peers: Record<string, RatchetPeerSnapshotV1>
}

let memoryPeers: Record<string, RatchetPeerSnapshotV1> = {}
let persistTimer: ReturnType<typeof setTimeout> | null = null
let sessionHydrated = false

function normPeer(addr: string): string {
  return addr.trim().toLowerCase()
}

function emitChanged(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new Event(RATCHET_VAULT_CHANGED_EVENT))
  } catch {
    /* ignore */
  }
}

function snapshotPlain(): PlainV1 {
  return { v: 1, peers: { ...memoryPeers } }
}

function applyPlain(p: PlainV1 | null | undefined): number {
  if (!p || p.v !== 1 || !p.peers) return 0
  let n = 0
  memoryPeers = {}
  for (const [id, snap] of Object.entries(p.peers)) {
    const peer = normPeer(id)
    if (!HEX64.test(peer) || !snap || snap.v !== 1 || snap.mode !== 'symmetric') continue
    memoryPeers[peer] = snap
    n++
  }
  return n
}

async function persistNow(): Promise<void> {
  const pw = getVaultPasswordSession()
  if (!pw || typeof window === 'undefined') return
  const plain = JSON.stringify(snapshotPlain())
  await writeVaultEncSidecar(RATCHET_ENC_LS_KEY, RATCHET_ENC_SCHEMA, plain, pw)
  emitChanged()
}

function schedulePersist(): void {
  if (!hasVaultPasswordSession()) return
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    void persistNow()
  }, PERSIST_DEBOUNCE_MS)
}

export function hasRatchetVaultSidecar(): boolean {
  return hasVaultEncSidecar(RATCHET_ENC_LS_KEY)
}

export async function unlockRatchetSessionVault(
  password: string
): Promise<{ ok: boolean; error?: string; count?: number }> {
  const pw = password.trim()
  if (pw.length < 8) return { ok: false, error: 'Vault-Passwort mindestens 8 Zeichen.' }
  if (!hasVaultEncSidecar(RATCHET_ENC_LS_KEY)) {
    memoryPeers = {}
    sessionHydrated = true
    return { ok: true, count: 0 }
  }
  const r = await readVaultEncSidecar(RATCHET_ENC_LS_KEY, RATCHET_ENC_SCHEMA, pw)
  if (!r.ok) {
    if (r.missing) {
      memoryPeers = {}
      sessionHydrated = true
      return { ok: true, count: 0 }
    }
    return { ok: false, error: r.error }
  }
  try {
    const n = applyPlain(JSON.parse(r.plainUtf8) as PlainV1)
    sessionHydrated = true
    return { ok: true, count: n }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export function lockRatchetSessionVault(): void {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  memoryPeers = {}
  sessionHydrated = false
  emitChanged()
}

export function purgeRatchetSessionVault(): void {
  lockRatchetSessionVault()
  removeVaultEncSidecar(RATCHET_ENC_LS_KEY)
  emitChanged()
}

export async function flushRatchetSessionVaultPersist(): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  await persistNow()
}

export function isRatchetSessionVaultHydrated(): boolean {
  return sessionHydrated
}

export function listRatchetPeerAddresses(): string[] {
  return Object.keys(memoryPeers)
}

export function getRatchetSessionForPeer(peerAddress: string): MorgRatchetSession | null {
  const snap = memoryPeers[normPeer(peerAddress)]
  if (!snap) return null
  try {
    return MorgRatchetSession.fromSymmetricSnapshot(snap)
  } catch {
    return null
  }
}

/** Speichert Symmetric-Session unter Peer-Adresse (RAM + Debounce Sidecar). */
export function putRatchetSessionForPeer(peerAddress: string, session: MorgRatchetSession): void {
  const peer = normPeer(peerAddress)
  if (!HEX64.test(peer)) throw new Error('putRatchetSessionForPeer: Peer-Adresse ungültig')
  if (session.mode !== 'symmetric') {
    throw new Error('putRatchetSessionForPeer: nur Symmetric-Sessions (C1.4)')
  }
  memoryPeers[peer] = session.exportSymmetricSnapshot()
  schedulePersist()
  emitChanged()
}

export function removeRatchetSessionForPeer(peerAddress: string): void {
  const peer = normPeer(peerAddress)
  if (!(peer in memoryPeers)) return
  delete memoryPeers[peer]
  schedulePersist()
  emitChanged()
}
