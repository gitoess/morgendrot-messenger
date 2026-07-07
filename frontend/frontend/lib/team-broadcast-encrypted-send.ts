'use client'

import {
  buildTeamBroadcastAad,
  encryptTeamBroadcastPayload,
} from '@morgendrot/shared/morgendrot-team-broadcast-crypto'
import {
  ensureTeamBroadcastKey,
  readTeamBroadcastKeyEpoch,
} from '@/frontend/lib/team-broadcast-key-store'

export type TeamBroadcastEncryptedPayload = {
  ciphertext: Uint8Array
  iv: Uint8Array
  tag: Uint8Array
  keyEpoch: number
}

/** Verschlüsselt Gruppen-Plaintext für Team-Broadcast on-chain (§ H.23 B1). */
export async function encryptTeamBroadcastPlaintext(p: {
  teamMailboxObjectId: string
  groupId: string
  plaintextUtf8: string
}): Promise<TeamBroadcastEncryptedPayload> {
  const teamMb = p.teamMailboxObjectId.trim()
  const keyRaw = ensureTeamBroadcastKey(teamMb)
  const keyEpoch = readTeamBroadcastKeyEpoch(teamMb)
  const aad = buildTeamBroadcastAad({
    teamMailboxObjectId: teamMb,
    groupId: p.groupId,
    keyEpoch,
  })
  const enc = await encryptTeamBroadcastPayload(keyRaw, p.plaintextUtf8, aad)
  return {
    ciphertext: enc.ciphertext,
    iv: enc.iv,
    tag: enc.tag,
    keyEpoch,
  }
}
