'use client'

import {
  DEFAULT_TEAM_BROADCAST_KEY_EPOCH,
  generateTeamBroadcastKeyRaw,
  teamBroadcastKeyFromBase64,
  teamBroadcastKeyToBase64,
} from '@morgendrot/shared/morgendrot-team-broadcast-crypto'

const LS_KEY_PREFIX = 'morgendrot.teamBroadcastKey.v1:'
const LS_EPOCH_PREFIX = 'morgendrot.teamBroadcastKeyEpoch.v1:'
const LS_ARCHIVE = 'morgendrot.teamKeysArchive.v1'

/** Snapshot für Backup / später Nest Vault `.team-keys.enc`. */
export type TeamBroadcastKeysSnapshot = {
  schema: 1
  keys: Record<string, { keyBase64: string; keyEpoch: number }>
}

/** Klartext-Fehler wenn Enc-Send ohne gemeinsamen Key (kein Auto-Fork). */
export const TEAM_BROADCAST_KEY_MISSING_MSG =
  'Kein gemeinsamer Team-Key für dieses Postfach. Boss: in Gruppenverwaltung „Team-Key erzeugen“, dann Handoff-ZIP an Mitglieder — sonst entschlüsseln Geräte unterschiedliche Keys.'

function normMb(teamMailboxObjectId: string): string {
  return teamMailboxObjectId.trim().toLowerCase()
}

export function hasTeamBroadcastKey(teamMailboxObjectId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const v = window.localStorage.getItem(LS_KEY_PREFIX + normMb(teamMailboxObjectId))
    return Boolean(v?.trim())
  } catch {
    return false
  }
}

export function readTeamBroadcastKeyRaw(teamMailboxObjectId: string): Uint8Array | null {
  if (typeof window === 'undefined') return null
  try {
    const b64 = window.localStorage.getItem(LS_KEY_PREFIX + normMb(teamMailboxObjectId))?.trim()
    if (!b64) return null
    return teamBroadcastKeyFromBase64(b64)
  } catch {
    return null
  }
}

function persistArchiveSidecar(): void {
  if (typeof window === 'undefined') return
  try {
    const ids: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k?.startsWith(LS_KEY_PREFIX)) ids.push(k.slice(LS_KEY_PREFIX.length))
    }
    window.localStorage.setItem(LS_ARCHIVE, JSON.stringify(exportTeamBroadcastKeysSnapshot(ids)))
  } catch {
    /* ignore */
  }
}

/** Beim Start: Archiv-Sidecar → Einzelkeys (Vault-/Backup-Restore). */
export function hydrateTeamBroadcastKeysFromArchiveSidecar(): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = window.localStorage.getItem(LS_ARCHIVE)?.trim()
    if (!raw) return 0
    return importTeamBroadcastKeysSnapshot(JSON.parse(raw) as TeamBroadcastKeysSnapshot)
  } catch {
    return 0
  }
}

export function writeTeamBroadcastKeyRaw(teamMailboxObjectId: string, raw32: Uint8Array): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LS_KEY_PREFIX + normMb(teamMailboxObjectId), teamBroadcastKeyToBase64(raw32))
  persistArchiveSidecar()
}

export function writeTeamBroadcastKeyEpoch(teamMailboxObjectId: string, epoch: number): void {
  if (typeof window === 'undefined') return
  const n = Number.isFinite(epoch) && epoch >= 1 ? Math.floor(epoch) : DEFAULT_TEAM_BROADCAST_KEY_EPOCH
  window.localStorage.setItem(LS_EPOCH_PREFIX + normMb(teamMailboxObjectId), String(n))
  persistArchiveSidecar()
}

export function readTeamBroadcastKeyEpoch(teamMailboxObjectId: string): number {
  if (typeof window === 'undefined') return DEFAULT_TEAM_BROADCAST_KEY_EPOCH
  try {
    const n = Number(window.localStorage.getItem(LS_EPOCH_PREFIX + normMb(teamMailboxObjectId)) || '')
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_TEAM_BROADCAST_KEY_EPOCH
  } catch {
    return DEFAULT_TEAM_BROADCAST_KEY_EPOCH
  }
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
  writeTeamBroadcastKeyRaw(id, raw)
  const prevEpoch = readTeamBroadcastKeyEpoch(id)
  const epoch = opts?.rotate && existing ? prevEpoch + 1 : DEFAULT_TEAM_BROADCAST_KEY_EPOCH
  writeTeamBroadcastKeyEpoch(id, epoch)
  return { ok: true, created: !existing, rotated: Boolean(opts?.rotate && existing), epoch }
}

/**
 * Nur Handoff-Export: fehlenden Key einmalig anlegen.
 * Enc-Send darf dies **nicht** nutzen (Geräte-Fork).
 */
export function ensureTeamBroadcastKey(teamMailboxObjectId: string): Uint8Array {
  const existing = readTeamBroadcastKeyRaw(teamMailboxObjectId)
  if (existing) return existing
  const created = createTeamBroadcastKey(teamMailboxObjectId)
  if (!created.ok) throw new Error(created.error)
  const raw = readTeamBroadcastKeyRaw(teamMailboxObjectId)
  if (!raw) throw new Error(TEAM_BROADCAST_KEY_MISSING_MSG)
  return raw
}

/** Enc-Send / Decrypt-Vorbereitung: vorhandenen Key oder Fehler (kein Auto-Generate). */
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
  if (!snap || snap.schema !== 1 || !snap.keys) return 0
  let n = 0
  for (const [id, entry] of Object.entries(snap.keys)) {
    const mb = normMb(id)
    const b64 = String(entry?.keyBase64 ?? '').trim()
    if (!/^0x[a-f0-9]{64}$/.test(mb) || !b64) continue
    try {
      writeTeamBroadcastKeyRaw(mb, teamBroadcastKeyFromBase64(b64))
      if (entry.keyEpoch != null && Number.isFinite(entry.keyEpoch) && entry.keyEpoch >= 1) {
        writeTeamBroadcastKeyEpoch(mb, Math.floor(entry.keyEpoch))
      }
      n++
    } catch {
      /* skip */
    }
  }
  return n
}
