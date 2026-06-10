/**
 * Gruppenchat M2c: Team-Broadcast (1× TX) — einziger Chain-Pfad für Gruppe + Mailbox + Internet.
 * Pairwise-Multicast ist absichtlich entfernt. Verschlüsselt: Roadmap § H.22 (Team-E2EE).
 */
import type { MessengerGroupDefinition } from '@/frontend/lib/messenger-group-store'

const ADDR_64 = /^0x[a-fA-F0-9]{64}$/i

/** Bis Team-E2EE on-chain: kein verschlüsselter Gruppen-Chain-Versand. */
export const GROUP_ENCRYPTED_TEAM_BROADCAST_PENDING_MSG =
  'Gruppe verschlüsselt auf der Chain: Team-Broadcast mit Gruppen-E2EE folgt (Roadmap § H.22, ggf. Handshakes pro Mitglied). Bis dahin: Klartext + Team-Postfach oder 1:1-Privatchat.'

export const GROUP_TEAM_MAILBOX_REQUIRED_MSG =
  'Gruppe: Team-Postfach verknüpfen oder neu erstellen (Gruppenpanel) — Internet + Mailbox = nur 1× Team-Broadcast.'

export function isGroupMailboxInternetChainSend(p: {
  isGroupChannel: boolean
  messagingPersistenceMode: 'event' | 'mailbox'
  forcedTransport: 'internet' | 'mesh' | 'adhoc'
}): boolean {
  return p.isGroupChannel && p.messagingPersistenceMode === 'mailbox' && p.forcedTransport === 'internet'
}

export function resolveGroupTeamMailboxObjectId(group: MessengerGroupDefinition | null): string | null {
  if (!group?.teamMailboxObjectId) return null
  const id = group.teamMailboxObjectId.trim()
  return ADDR_64.test(id) ? id.toLowerCase() : null
}

/** Default: an, sobald eine Team-Mailbox verknüpft ist. */
export function groupUsesTeamBroadcast(group: MessengerGroupDefinition | null): boolean {
  if (!resolveGroupTeamMailboxObjectId(group)) return false
  return group?.useTeamBroadcast !== false
}

export function shouldSendGroupTeamBroadcast(p: {
  activeGroup: MessengerGroupDefinition | null
  encrypted: boolean
  messagingPersistenceMode: 'event' | 'mailbox'
  forcedTransport: 'internet' | 'mesh' | 'adhoc'
  sendAllMembers: boolean
  isGroupChannel: boolean
}): boolean {
  if (!p.isGroupChannel || !p.activeGroup) return false
  if (p.encrypted) return false
  if (p.messagingPersistenceMode !== 'mailbox') return false
  if (p.forcedTransport !== 'internet') return false
  if (!p.sendAllMembers) return false
  if (!resolveGroupTeamMailboxObjectId(p.activeGroup)) return false
  return groupUsesTeamBroadcast(p.activeGroup)
}

export function resolveGroupTeamBroadcastMailboxIds(groups: MessengerGroupDefinition[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const g of groups) {
    const id = resolveGroupTeamMailboxObjectId(g)
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}
