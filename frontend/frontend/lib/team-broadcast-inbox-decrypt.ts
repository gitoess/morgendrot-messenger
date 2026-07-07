'use client'

import {
  buildTeamBroadcastAad,
  decryptTeamBroadcastPayload,
} from '@morgendrot/shared/morgendrot-team-broadcast-crypto'
import { readTeamBroadcastKeyRaw } from '@/frontend/lib/team-broadcast-key-store'
import { resolveGroupIdForTeamMailbox } from '@/frontend/lib/group-team-broadcast'

export type TeamEncInboxPayload = {
  teamMailboxObjectId: string
  ciphertext: Uint8Array
  iv: Uint8Array
  tag: Uint8Array
  keyEpoch: number
}

export async function decryptTeamBroadcastInboxPayload(
  payload: TeamEncInboxPayload
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const teamMb = payload.teamMailboxObjectId.trim()
  const keyRaw = readTeamBroadcastKeyRaw(teamMb)
  if (!keyRaw) {
    return {
      ok: false,
      error: '[Team-Broadcast verschlüsselt] Kein lokaler Team-Key — Handoff/Provision prüfen.',
    }
  }
  const groupId = resolveGroupIdForTeamMailbox(teamMb)
  if (!groupId) {
    return {
      ok: false,
      error: '[Team-Broadcast verschlüsselt] Keine Gruppe für dieses Team-Postfach verknüpft.',
    }
  }
  try {
    const aad = buildTeamBroadcastAad({
      teamMailboxObjectId: teamMb,
      groupId,
      keyEpoch: payload.keyEpoch,
    })
    const text = await decryptTeamBroadcastPayload(
      keyRaw,
      payload.ciphertext,
      payload.iv,
      payload.tag,
      aad
    )
    return { ok: true, text }
  } catch {
    return {
      ok: false,
      error: '[Team-Broadcast verschlüsselt] Entschlüsselung fehlgeschlagen (Key/Epoch/Gruppe).',
    }
  }
}
