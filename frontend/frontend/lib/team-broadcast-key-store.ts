'use client'

/**
 * Team-Broadcast-Keys: Klartext nur im RAM; at rest AES-GCM mit Vault-Passwort
 * (`morgendrot.teamKeys.enc.v1` — Browser-Äquivalent zu Nest `.team-keys.enc`).
 */

import {
  DEFAULT_TEAM_BROADCAST_KEY_EPOCH,
  generateTeamBroadcastKeyRaw,
  teamBroadcastKeyFromBase64,
  teamBroadcastKeyToBase64,
} from '@morgendrot/shared/morgendrot-team-broadcast-crypto'
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

const LS_KEY_PREFIX = 'morgendrot.teamBroadcastKey.v1:'
const LS_EPOCH_PREFIX = 'morgendrot.teamBroadcastKeyEpoch.v1:'
/** Legacy Klartext-Archiv (wird beim Unlock migriert). */
const LS_ARCHIVE_LEGACY = 'morgendrot.teamKeysArchive.v1'
export const TEAM_KEYS_ENC_LS_KEY = 'morgendrot.teamKeys.enc.v1'
export const TEAM_KEYS_ENC_SCHEMA = 'morgendrot.team-keys.enc.v1'
export const TEAM_KEYS_VAULT_CHANGED_EVENT = 'morgendrot:team-keys-vault'
const SS_TAB = 'morgendrot.teamKeys.tab.v1'
const PERSIST_DEBOUNCE_MS = 400

/** Snapshot für Backup / Handoff. */
export type TeamBroadcastKeysSnapshot = {
  schema: 1
  keys: Record<string, { keyBase64: string; keyEpoch: number }>
}

export const TEAM_BROADCAST_KEY_MISSING_MSG =
  'Kein gemeinsamer Team-Key für dieses Postfach. Boss: in Gruppenverwaltung „Kanal einrichten“, dann Handoff-ZIP an Mitglieder — sonst entschlüsseln Geräte unterschiedliche Keys.'

type MemEntry = { keyBase64: string; keyEpoch: number }

let memoryKeys: Record<string, MemEntry> = {}
let persistTimer: ReturnType<typeof setTimeout> | null = null
let sessionHydrated = false

function normMb(teamMailboxObjectId: string): string {
  return teamMailboxObjectId.trim().toLowerCase()
}

function emitChanged(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new Event(TEAM_KEYS_VAULT_CHANGED_EVENT))
  } catch {
    /* ignore */
  }
}

function snapshotFromMemory(): TeamBroadcastKeysSnapshot {
  return { schema: 1, keys: { ...memoryKeys } }
}

function applySnapshotToMemory(snap: TeamBroadcastKeysSnapshot | null | undefined): number {
  if (!snap || snap.schema !== 1 || !snap.keys) return 0
  let n = 0
  for (const [id, entry] of Object.entries(snap.keys)) {
    const mb = normMb(id)
    const b64 = String(entry?.keyBase64 ?? '').trim()
    if (!/^0x[a-f0-9]{64}$/.test(mb) || !b64) continue
    const epoch =
      entry.keyEpoch != null && Number.isFinite(entry.keyEpoch) && entry.keyEpoch >= 1
        ? Math.floor(entry.keyEpoch)
        : DEFAULT_TEAM_BROADCAST_KEY_EPOCH
    memoryKeys[mb] = { keyBase64: b64, keyEpoch: epoch }
    n++
  }
  return n
}

function readLegacyPlainIntoMemory(): number {
  if (typeof window === 'undefined') return 0
  let n = 0
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (!k?.startsWith(LS_KEY_PREFIX)) continue
      const mb = k.slice(LS_KEY_PREFIX.length)
      if (!/^0x[a-f0-9]{64}$/.test(mb)) continue
      if (memoryKeys[mb]) continue
      const b64 = window.localStorage.getItem(k)?.trim()
      if (!b64) continue
      const epochRaw = Number(window.localStorage.getItem(LS_EPOCH_PREFIX + mb) || '')
      const keyEpoch =
        Number.isFinite(epochRaw) && epochRaw >= 1 ? Math.floor(epochRaw) : DEFAULT_TEAM_BROADCAST_KEY_EPOCH
      memoryKeys[mb] = { keyBase64: b64, keyEpoch }
      n++
    }
    const arch = window.localStorage.getItem(LS_ARCHIVE_LEGACY)?.trim()
    if (arch) {
      try {
        n += applySnapshotToMemory(JSON.parse(arch) as TeamBroadcastKeysSnapshot)
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  return n
}

function clearLegacyPlainStorage(): void {
  if (typeof window === 'undefined') return
  try {
    const toRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (
        k?.startsWith(LS_KEY_PREFIX) ||
        k?.startsWith(LS_EPOCH_PREFIX) ||
        k === LS_ARCHIVE_LEGACY
      ) {
        toRemove.push(k)
      }
    }
    for (const k of toRemove) window.localStorage.removeItem(k)
  } catch {
    /* ignore */
  }
}

function writeTabBackup(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(SS_TAB, JSON.stringify(snapshotFromMemory()))
  } catch {
    /* ignore */
  }
}

function readTabBackup(): TeamBroadcastKeysSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(SS_TAB)?.trim()
    if (!raw) return null
    return JSON.parse(raw) as TeamBroadcastKeysSnapshot
  } catch {
    return null
  }
}

function clearTabBackup(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(SS_TAB)
  } catch {
    /* ignore */
  }
}

async function persistEncryptedNow(): Promise<void> {
  const pw = getVaultPasswordSession()
  if (!pw || typeof window === 'undefined') {
    writeTabBackup()
    return
  }
  await writeVaultEncSidecar(
    TEAM_KEYS_ENC_LS_KEY,
    TEAM_KEYS_ENC_SCHEMA,
    JSON.stringify(snapshotFromMemory()),
    pw
  )
  clearLegacyPlainStorage()
  clearTabBackup()
}

function schedulePersist(): void {
  writeTabBackup()
  if (!hasVaultPasswordSession()) return
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    void persistEncryptedNow().catch(() => undefined)
  }, PERSIST_DEBOUNCE_MS)
}

export function hasEncryptedTeamKeysVault(): boolean {
  return hasVaultEncSidecar(TEAM_KEYS_ENC_LS_KEY)
}

export async function unlockTeamBroadcastKeyVault(password?: string): Promise<
  { ok: true; migratedLegacy: boolean } | { ok: false; error: string }
> {
  const pw = (password ?? getVaultPasswordSession() ?? '').trim()
  if (pw.length < 8) return { ok: false, error: 'Vault-Passwort mindestens 8 Zeichen.' }

  memoryKeys = {}
  sessionHydrated = true

  const enc = await readVaultEncSidecar(TEAM_KEYS_ENC_LS_KEY, TEAM_KEYS_ENC_SCHEMA, pw)
  if (enc.ok) {
    try {
      applySnapshotToMemory(JSON.parse(enc.plainUtf8) as TeamBroadcastKeysSnapshot)
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  } else if (!enc.missing) {
    return { ok: false, error: enc.error }
  }

  const migratedLegacy = readLegacyPlainIntoMemory() > 0
  applySnapshotToMemory(readTabBackup())

  if (Object.keys(memoryKeys).length > 0 || migratedLegacy) {
    await persistEncryptedNow()
  }
  emitChanged()
  return { ok: true, migratedLegacy }
}

export function lockTeamBroadcastKeyVault(): void {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  memoryKeys = {}
  sessionHydrated = false
  clearTabBackup()
  emitChanged()
}

export function purgeTeamBroadcastKeyVault(): void {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  memoryKeys = {}
  sessionHydrated = false
  removeVaultEncSidecar(TEAM_KEYS_ENC_LS_KEY)
  clearLegacyPlainStorage()
  clearTabBackup()
  emitChanged()
}

export function hasTeamBroadcastKey(teamMailboxObjectId: string): boolean {
  const id = normMb(teamMailboxObjectId)
  return Boolean(memoryKeys[id]?.keyBase64)
}

export function readTeamBroadcastKeyRaw(teamMailboxObjectId: string): Uint8Array | null {
  const id = normMb(teamMailboxObjectId)
  const mem = memoryKeys[id]
  if (!mem?.keyBase64) return null
  try {
    return teamBroadcastKeyFromBase64(mem.keyBase64)
  } catch {
    return null
  }
}

export function writeTeamBroadcastKeyRaw(teamMailboxObjectId: string, raw32: Uint8Array): void {
  const id = normMb(teamMailboxObjectId)
  const prev = memoryKeys[id]
  memoryKeys[id] = {
    keyBase64: teamBroadcastKeyToBase64(raw32),
    keyEpoch: prev?.keyEpoch ?? DEFAULT_TEAM_BROADCAST_KEY_EPOCH,
  }
  sessionHydrated = true
  schedulePersist()
  emitChanged()
}

export function writeTeamBroadcastKeyEpoch(teamMailboxObjectId: string, epoch: number): void {
  const id = normMb(teamMailboxObjectId)
  const n = Number.isFinite(epoch) && epoch >= 1 ? Math.floor(epoch) : DEFAULT_TEAM_BROADCAST_KEY_EPOCH
  const prev = memoryKeys[id]
  if (!prev?.keyBase64) return
  memoryKeys[id] = { ...prev, keyEpoch: n }
  schedulePersist()
  emitChanged()
}

export function readTeamBroadcastKeyEpoch(teamMailboxObjectId: string): number {
  const id = normMb(teamMailboxObjectId)
  const mem = memoryKeys[id]
  if (mem && mem.keyEpoch >= 1) return mem.keyEpoch
  return DEFAULT_TEAM_BROADCAST_KEY_EPOCH
}

/**
 * Explizit erzeugen (Gruppenverwaltung / Boss).
 * `rotate=true` ersetzt vorhandenen Key und erhöht Epoch (Mitglieder brauchen neuen Handoff).
 */
export function createTeamBroadcastKey(
  teamMailboxObjectId: string,
  opts?: { rotate?: boolean }
): { ok: true; created: boolean; rotated: boolean; epoch: number } | { ok: false; error: string } {
  const id = normMb(teamMailboxObjectId)
  if (!/^0x[a-f0-9]{64}$/.test(id)) {
    return { ok: false, error: 'Ungültige Team-Mailbox-Object-ID.' }
  }
  const existing = readTeamBroadcastKeyRaw(id)
  if (existing && !opts?.rotate) {
    return { ok: true, created: false, rotated: false, epoch: readTeamBroadcastKeyEpoch(id) }
  }
  const raw = generateTeamBroadcastKeyRaw()
  const prevEpoch = readTeamBroadcastKeyEpoch(id)
  const epoch = opts?.rotate && existing ? prevEpoch + 1 : DEFAULT_TEAM_BROADCAST_KEY_EPOCH
  memoryKeys[id] = { keyBase64: teamBroadcastKeyToBase64(raw), keyEpoch: epoch }
  sessionHydrated = true
  schedulePersist()
  emitChanged()
  return { ok: true, created: !existing, rotated: Boolean(opts?.rotate && existing), epoch }
}

export function ensureTeamBroadcastKey(teamMailboxObjectId: string): Uint8Array {
  const existing = readTeamBroadcastKeyRaw(teamMailboxObjectId)
  if (existing) return existing
  const created = createTeamBroadcastKey(teamMailboxObjectId)
  if (!created.ok) throw new Error(created.error)
  const raw = readTeamBroadcastKeyRaw(teamMailboxObjectId)
  if (!raw) throw new Error(TEAM_BROADCAST_KEY_MISSING_MSG)
  return raw
}

export function requireTeamBroadcastKey(teamMailboxObjectId: string): Uint8Array {
  const existing = readTeamBroadcastKeyRaw(teamMailboxObjectId)
  if (existing) return existing
  throw new Error(TEAM_BROADCAST_KEY_MISSING_MSG)
}

export function exportTeamBroadcastKeysSnapshot(teamMailboxObjectIds: string[]): TeamBroadcastKeysSnapshot {
  const keys: TeamBroadcastKeysSnapshot['keys'] = {}
  for (const rawId of teamMailboxObjectIds) {
    const id = normMb(rawId)
    const raw = readTeamBroadcastKeyRaw(id)
    if (!raw) continue
    keys[id] = {
      keyBase64: teamBroadcastKeyToBase64(raw),
      keyEpoch: readTeamBroadcastKeyEpoch(id),
    }
  }
  return { schema: 1, keys }
}

export function importTeamBroadcastKeysSnapshot(snap: TeamBroadcastKeysSnapshot | null | undefined): number {
  const n = applySnapshotToMemory(snap)
  if (n > 0) {
    sessionHydrated = true
    schedulePersist()
    emitChanged()
  }
  return n
}

/**
 * Legacy-Klartext nur noch beim Vault-Unlock migrieren — kein RAM-Hydrate ohne Session.
 * @deprecated No-op; Migration in unlockTeamBroadcastKeyVault.
 */
export function hydrateTeamBroadcastKeysFromArchiveSidecar(): number {
  return 0
}

export async function flushTeamBroadcastKeyVaultPersist(): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  await persistEncryptedNow()
}
