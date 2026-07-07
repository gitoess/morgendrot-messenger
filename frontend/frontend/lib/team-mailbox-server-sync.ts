'use client'

import { getConfig, setConfig } from '@/frontend/lib/api/dashboard-rest'
import { readMyTeamMailboxes } from '@/frontend/lib/my-team-mailbox-store'

const OBJECT_ID_RE = /^0x[a-fA-F0-9]{64}$/i

export type TeamMailboxSyncResult = {
  ok: boolean
  message?: string
  error?: string
  syncedIds?: string[]
}

export function parseTeamMailboxIdsCsv(raw: string | undefined | null): string[] {
  if (!raw?.trim()) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(/[\s,;]+/)) {
    const t = part.trim()
    if (!OBJECT_ID_RE.test(t)) continue
    const n = t.toLowerCase()
    if (seen.has(n)) continue
    seen.add(n)
    out.push(t)
  }
  return out
}

export function mergeTeamMailboxIdLists(existing: string[], add: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of [...existing, ...add]) {
    const t = raw.trim()
    if (!OBJECT_ID_RE.test(t)) continue
    const n = t.toLowerCase()
    if (seen.has(n)) continue
    seen.add(n)
    out.push(t)
  }
  return out
}

/** Liest TEAM_MAILBOX_IDS aus GET /api/config (falls exponiert). */
export async function readServerTeamMailboxIds(): Promise<string[]> {
  try {
    const r = await getConfig()
    if (!r.ok || !r.config) return []
    const row = r.config.find((c) => c.envKey === 'TEAM_MAILBOX_IDS' || c.key === 'TEAM_MAILBOX_IDS')
    return parseTeamMailboxIdsCsv(row?.value)
  } catch {
    return []
  }
}

/**
 * Schreibt lokale Team-Postfächer nach Server `.env` TEAM_MAILBOX_IDS.
 * Privates Server-MAILBOX_ID wird nicht in die Team-Liste übernommen.
 */
export async function syncLocalTeamMailboxesToServer(opts?: {
  privateServerMailboxId?: string
}): Promise<TeamMailboxSyncResult> {
  const local = readMyTeamMailboxes().map((e) => e.objectId.trim()).filter((id) => OBJECT_ID_RE.test(id))
  const priv = opts?.privateServerMailboxId?.trim().toLowerCase()
  const teamOnly = local.filter((id) => id.toLowerCase() !== priv)

  if (!teamOnly.length) {
    return { ok: true, message: 'Keine Team-Postfächer zum Synchronisieren.', syncedIds: [] }
  }

  const existing = await readServerTeamMailboxIds()
  const merged = mergeTeamMailboxIdLists(existing, teamOnly)
  const r = await setConfig('TEAM_MAILBOX_IDS', merged.join(','))
  if (!r.ok) {
    return { ok: false, error: r.error || r.message || 'TEAM_MAILBOX_IDS setzen fehlgeschlagen.' }
  }
  return {
    ok: true,
    message:
      merged.length === 1
        ? '1 Team-Postfach auf dem Server übernommen (TEAM_MAILBOX_IDS).'
        : `${merged.length} Team-Postfächer auf dem Server übernommen (TEAM_MAILBOX_IDS).`,
    syncedIds: merged,
  }
}

/** Nach Erstellung einer Team-Mailbox: lokal bereits gesetzt → Server-Liste mergen. */
export async function mergeTeamMailboxIdOnServer(
  objectId: string,
  opts?: { privateServerMailboxId?: string }
): Promise<TeamMailboxSyncResult> {
  const id = objectId.trim()
  if (!OBJECT_ID_RE.test(id)) {
    return { ok: false, error: 'Team-Mailbox-ID ungültig.' }
  }
  const existing = await readServerTeamMailboxIds()
  const priv = opts?.privateServerMailboxId?.trim().toLowerCase()
  if (id.toLowerCase() === priv) {
    return { ok: true, message: 'ID ist das private Server-Postfach — nicht in TEAM_MAILBOX_IDS.', syncedIds: existing }
  }
  const merged = mergeTeamMailboxIdLists(existing, [id])
  const r = await setConfig('TEAM_MAILBOX_IDS', merged.join(','))
  if (!r.ok) {
    return { ok: false, error: r.error || r.message || 'TEAM_MAILBOX_IDS setzen fehlgeschlagen.' }
  }
  return {
    ok: true,
    message: 'Team-Mailbox auf Server übernommen (TEAM_MAILBOX_IDS).',
    syncedIds: merged,
  }
}

export type TeamMailboxSyncDiff = {
  localTeamIds: string[]
  serverUnionIds: string[]
  serverPrivateMailboxId?: string
  missingOnServer: string[]
  onlyOnServerUnion: string[]
  inSync: boolean
}

/** Vergleich lokaler Team-Store vs. Server-Posteingang-Union (ApiStatus). */
export function diffTeamMailboxSync(opts: {
  inboxUnionMailboxIds?: string[]
  privateServerMailboxId?: string
}): TeamMailboxSyncDiff {
  const localTeamIds = readMyTeamMailboxes().map((e) => e.objectId.trim().toLowerCase()).filter(Boolean)
  const localSet = new Set(localTeamIds)
  const priv = opts.privateServerMailboxId?.trim().toLowerCase()
  const union = (opts.inboxUnionMailboxIds ?? [])
    .map((id) => id.trim().toLowerCase())
    .filter((id) => OBJECT_ID_RE.test(id))
  const unionSet = new Set(union)

  const missingOnServer = localTeamIds.filter((id) => !unionSet.has(id))
  const onlyOnServerUnion = union.filter((id) => id !== priv && !localSet.has(id))

  return {
    localTeamIds,
    serverUnionIds: union,
    serverPrivateMailboxId: priv,
    missingOnServer,
    onlyOnServerUnion,
    inSync: missingOnServer.length === 0,
  }
}
