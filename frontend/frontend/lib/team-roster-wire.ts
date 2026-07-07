'use client'

import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import { contactDisplayLabel } from '@/frontend/lib/contact-display'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'
import type { TeamMemberWireMember } from '@/frontend/lib/morg-team-member-update-v1'
import { canAccessEinsatzleitung } from '@/frontend/lib/messenger-role-capabilities'
import { publishTeamMemberUpdateWire, type PublishWireResult } from '@/frontend/lib/team-sync-wire'
import { resolveEinsatzleitungBossAddress, resolveTeamSyncSigningAddress } from '@/frontend/lib/resolve-einsatzleitung-boss-address'

export type TeamSyncContext = {
  /** Organisatorische Einsatzleitung (Roster). */
  boss: string
  /** On-Chain-Signer für Team-Wire (= msg.from nach dem Senden). */
  signer: string
  teamMb: string
  teamId: string
}

export function formatTeamWireDeliveryChannels(
  channels?: { iota?: boolean; lan?: boolean; meshPing?: boolean }
): string {
  const parts: string[] = []
  if (channels?.lan) parts.push('Lokales Netz ✓')
  if (channels?.iota) parts.push('IOTA ✓')
  if (channels?.meshPing) parts.push('Funk-Hinweis ✓')
  return parts.length ? ` — Zugestellt: ${parts.join(' · ')}` : ''
}

export function resolveTeamSyncContext(apiStatus?: ApiStatus | null): TeamSyncContext | null {
  const signer = resolveTeamSyncSigningAddress(apiStatus)
  const boss = resolveEinsatzleitungBossAddress(apiStatus) || signer
  const teamMb = (apiStatus?.inboxUnionMailboxIds?.[0] || apiStatus?.mailboxId || '').trim()
  const teamId = (apiStatus?.handoffLabel || 'default').trim()
  if (!signer) return null
  if (!/^0x[a-fA-F0-9]{64}$/i.test(teamMb)) return null
  return { boss, signer, teamMb, teamId }
}

export function canManageTeamRoster(apiStatus?: ApiStatus | null): boolean {
  if (!canAccessEinsatzleitung(apiStatus?.role)) return false
  return resolveTeamSyncContext(apiStatus) != null
}

export function contactToTeamMember(
  directory: Record<string, ContactMeshEntryClient>,
  address: string,
  entry?: ContactMeshEntryClient
): TeamMemberWireMember | null {
  const addr = address.trim().toLowerCase()
  if (!/^0x[a-fA-F0-9]{64}$/i.test(addr)) return null
  const e = entry ?? directory[addr]
  const name =
    contactDisplayLabel(directory, addr) ||
    e?.label?.trim() ||
    maskWalletAddress(addr, 8, 6)
  return {
    address: addr,
    name,
    ...(e?.roleTags?.length ? { roleTags: e.roleTags } : {}),
    ...(e?.meshNodeId?.trim() ? { meshNodeId: e.meshNodeId.trim() } : {}),
    ...(e?.telegramChatId?.trim() ? { telegramChatId: e.telegramChatId.trim() } : {}),
  }
}

export function listTeamRosterWalletContacts(
  directory: Record<string, ContactMeshEntryClient>,
  bossAddress: string
): { address: string; entry: ContactMeshEntryClient; displayName: string }[] {
  const boss = bossAddress.trim().toLowerCase()
  const out: { address: string; entry: ContactMeshEntryClient; displayName: string }[] = []
  for (const [addr, entry] of Object.entries(directory)) {
    const address = addr.trim().toLowerCase()
    if (!/^0x[a-fA-F0-9]{64}$/i.test(address)) continue
    if (address === boss) continue
    const displayName = contactDisplayLabel(directory, address) || entry.label?.trim() || maskWalletAddress(address, 8, 6)
    out.push({ address, entry, displayName })
  }
  out.sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'))
  return out
}

export async function publishTeamMemberAddWire(
  ctx: TeamSyncContext,
  member: TeamMemberWireMember,
  teamIdOverride?: string
): Promise<PublishWireResult> {
  return publishTeamMemberUpdateWire({
    teamMailboxAddress: ctx.teamMb,
    teamId: teamIdOverride?.trim() || ctx.teamId,
    bossAddress: ctx.signer,
    kind: 'add',
    member,
    telegramGroupHint: true,
  })
}

export async function publishTeamMemberRemoveWire(
  ctx: TeamSyncContext,
  member: TeamMemberWireMember
): Promise<PublishWireResult> {
  return publishTeamMemberUpdateWire({
    teamMailboxAddress: ctx.teamMb,
    teamId: ctx.teamId,
    bossAddress: ctx.signer,
    kind: 'remove',
    member: { address: member.address.trim().toLowerCase(), name: member.name.trim() || member.address },
    telegramGroupHint: true,
  })
}

export type TeamRosterRemoveResult =
  | { ok: true; channels?: PublishWireResult['channels']; seq?: number }
  | { ok: false; error: string; cancelled?: boolean }

/** Boss entfernt Mitglied aus dem Team-Telefonbuch — Wire an alle Team-Geräte. */
export async function removeTeamMemberFromRoster(p: {
  apiStatus?: ApiStatus | null
  member: TeamMemberWireMember
  confirm?: (displayName: string) => boolean
}): Promise<TeamRosterRemoveResult> {
  const ctx = resolveTeamSyncContext(p.apiStatus)
  if (!ctx) {
    return { ok: false, error: 'Team-Mailbox oder Boss-Adresse fehlt — Einsatzleitung prüfen.' }
  }
  const addr = p.member.address.trim().toLowerCase()
  if (addr === ctx.boss.toLowerCase()) {
    return { ok: false, error: 'Einsatzleitung kann sich nicht selbst aus dem Team entfernen.' }
  }
  const label = p.member.name?.trim() || maskWalletAddress(addr, 8, 6)
  const confirm = p.confirm ?? ((name) =>
    window.confirm(
      `„${name}" aus dem Team-Telefonbuch entfernen?\n\n` +
        'Alle Team-Mitglieder erhalten eine Posteingang-Nachricht und können die Entfernung bestätigen. ' +
        'Der Kontakt bleibt in deinem Telefonbuch der Einsatzleitung.'
    ))
  if (!confirm(label)) return { ok: false, error: 'Abgebrochen.', cancelled: true }

  const r = await publishTeamMemberRemoveWire(ctx, p.member)
  if (!r.ok) return { ok: false, error: r.error || 'Team-Update fehlgeschlagen.' }
  return { ok: true, channels: r.channels, seq: r.seq }
}
