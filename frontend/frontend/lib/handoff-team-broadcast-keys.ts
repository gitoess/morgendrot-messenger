'use client'

/**
 * § H.23 B1 — Team-Broadcast-Keys im Handoff-ZIP (`.morgendrot-handoff-extras.json`).
 * Keys nur off-chain; bei Passwort-Export im verschlüsselten Bundle (siehe handoff-zip-payload).
 */
import type { HandoffExtras, HandoffTeamBroadcastKeyEntry } from '@/frontend/lib/handoff-extras'
import { parseMessengerGroupHandoff } from '@/frontend/lib/messenger-group-handoff'
import { parseTeamMailboxIdsCsv } from '@/frontend/lib/team-mailbox-server-sync'
import {
  ensureTeamBroadcastKey,
  readTeamBroadcastKeyEpoch,
  readTeamBroadcastKeyRaw,
  writeTeamBroadcastKeyEpoch,
  writeTeamBroadcastKeyRaw,
} from '@/frontend/lib/team-broadcast-key-store'
import {
  teamBroadcastKeyFromBase64,
  teamBroadcastKeyToBase64,
} from '@morgendrot/shared/morgendrot-team-broadcast-crypto'

const ADDR = /^0x[a-f0-9]{64}$/

function normMb(id: string): string {
  return id.trim().toLowerCase()
}

/** Team-Mailbox-IDs aus Handoff-.env (TEAM_MAILBOX_IDS + MESSENGER_GROUP_HANDOFF). */
export function collectTeamMailboxIdsFromHandoffEnv(env: Record<string, string>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const add = (raw?: string) => {
    const id = normMb(String(raw ?? ''))
    if (!ADDR.test(id) || seen.has(id)) return
    seen.add(id)
    out.push(id)
  }
  add(env.MAILBOX_ID)
  for (const id of parseTeamMailboxIdsCsv(env.TEAM_MAILBOX_IDS)) add(id)
  const group = parseMessengerGroupHandoff(env.MESSENGER_GROUP_HANDOFF)
  if (group?.teamMailboxObjectId) add(group.teamMailboxObjectId)
  return out
}

function parseHandoffEnvQuick(envText: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of envText.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 1) continue
    const k = line.slice(0, i).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) continue
    out[k] = line.slice(i + 1).trim()
  }
  return out
}

/** Boss-Export: vorhandene Keys + fehlende erzeugen, in Extras eintragen. */
export function buildTeamBroadcastKeyEntriesForExport(teamMailboxObjectIds: string[]): HandoffTeamBroadcastKeyEntry[] {
  const entries: HandoffTeamBroadcastKeyEntry[] = []
  const seen = new Set<string>()
  for (const raw of teamMailboxObjectIds) {
    const id = normMb(raw)
    if (!ADDR.test(id) || seen.has(id)) continue
    seen.add(id)
    const keyRaw = ensureTeamBroadcastKey(id)
    entries.push({
      teamMailboxObjectId: id,
      keyBase64: teamBroadcastKeyToBase64(keyRaw),
      keyEpoch: readTeamBroadcastKeyEpoch(id),
    })
  }
  return entries
}

export function enrichHandoffExtrasWithTeamBroadcastKeys(
  extras: HandoffExtras | undefined,
  teamMailboxObjectIds: string[]
): HandoffExtras {
  const keys = buildTeamBroadcastKeyEntriesForExport(teamMailboxObjectIds)
  if (keys.length === 0) return extras ?? {}
  return { ...(extras ?? {}), teamBroadcastKeys: keys }
}

/** ZIP-Build: Team-IDs aus generierter .env ableiten. */
export function enrichHandoffExtrasFromEnvContent(
  extras: HandoffExtras | undefined,
  envContent: string
): HandoffExtras {
  const env = parseHandoffEnvQuick(envContent)
  const ids = collectTeamMailboxIdsFromHandoffEnv(env)
  return enrichHandoffExtrasWithTeamBroadcastKeys(extras, ids)
}

export function applyTeamBroadcastKeysFromExtras(extras: HandoffExtras | null | undefined): number {
  const list = extras?.teamBroadcastKeys
  if (!list?.length) return 0
  let n = 0
  for (const entry of list) {
    const id = normMb(entry.teamMailboxObjectId ?? '')
    const b64 = String(entry.keyBase64 ?? '').trim()
    if (!ADDR.test(id) || !b64) continue
    try {
      const raw = teamBroadcastKeyFromBase64(b64)
      writeTeamBroadcastKeyRaw(id, raw)
      if (entry.keyEpoch != null && Number.isFinite(entry.keyEpoch) && entry.keyEpoch >= 1) {
        writeTeamBroadcastKeyEpoch(id, Math.floor(entry.keyEpoch))
      }
      n++
    } catch {
      /* skip invalid entry */
    }
  }
  return n
}

export function countExportableTeamBroadcastKeys(teamMailboxObjectIds: string[]): number {
  let n = 0
  for (const raw of teamMailboxObjectIds) {
    const id = normMb(raw)
    if (!ADDR.test(id)) continue
    if (readTeamBroadcastKeyRaw(id)) n++
  }
  return n
}
