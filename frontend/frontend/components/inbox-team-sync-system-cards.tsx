'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, MessageCircle, Radio, UserMinus, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Message } from '@/frontend/lib/types'
import { applyInitialProfileProvisioning } from '@/frontend/lib/api/contacts'
import { hideContactFromPhonebook } from '@/frontend/lib/contact-phonebook-meta-store'
import {
  parseMorgTeamMemberUpdateV1,
  memberToInitialProfileContact,
  type MorgTeamMemberUpdateV1,
  type TeamMemberUpdateKind,
} from '@/frontend/lib/morg-team-member-update-v1'
import {
  parseMorgTelegramAlarmGroupV1,
  type MorgTelegramAlarmGroupV1,
} from '@/frontend/lib/morg-telegram-alarm-group-v1'
import {
  parseMorgTeamUpdatePingV1,
  type MorgTeamUpdatePingV1,
} from '@/frontend/lib/morg-team-update-ping-v1'
import {
  isTeamUpdateSeqRejected,
  markTeamUpdateSeqApplied,
  rejectTeamUpdateSeq,
  shouldShowTeamMemberUpdate,
} from '@/frontend/lib/team-update-inbox-state'
import {
  dismissTelegramGroupTgSeq,
  isTelegramGroupCardSnoozed,
  isTelegramGroupTgSeqDismissed,
  markTelegramGroupTgSeqApplied,
  readAppliedTelegramGroupTgSeq,
  saveTelegramAlarmGroupPending,
  snoozeTelegramGroupCard,
  isTelegramAlarmGroupJoinInitiatedForLink,
  confirmTelegramAlarmGroupJoined,
} from '@/frontend/lib/telegram-alarm-group-prefs'
import { openTelegramAlarmGroupInvite } from '@/frontend/lib/telegram-alarm-group-invite'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'
import {
  collectTeamSyncReceiveChannels,
  formatTeamSyncReceivedVia,
  type TeamSyncReceiveChannel,
} from '@/frontend/lib/team-sync-received-via'
import {
  formatTeamWireSigStatusLine,
  resolveTeamMemberUpdateSigStatus,
  resolveTelegramAlarmGroupSigStatus,
  type TeamWireSigStatus,
} from '@/frontend/lib/team-sync-wire-verify'

function shortBoss(addr: string): string {
  const a = addr.trim()
  if (a.length < 12) return a
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

function mergeReceiveChannels(
  target: Set<TeamSyncReceiveChannel>,
  msg: Message
): void {
  for (const ch of collectTeamSyncReceiveChannels(msg)) target.add(ch)
}

function teamSyncSenderLine(chainFrom: string, wireBoss: string): string {
  const chain = chainFrom.trim()
  if (chain) return `Von ${shortBoss(chain)} (Chain)`
  const boss = wireBoss.trim()
  if (boss) return `Von Einsatzleitung (${shortBoss(boss)})`
  return ''
}

function teamUpdateCardTitle(kind: TeamMemberUpdateKind): string {
  if (kind === 'remove') return 'Mitglied aus Team entfernt'
  if (kind === 'update') return 'Team-Mitglied aktualisiert'
  return 'Neues Team-Mitglied'
}

function teamUpdateMemberLine(u: MorgTeamMemberUpdateV1): string {
  if (u.kind === 'remove') {
    const name = u.member.name?.trim()
    return name ? name : maskWalletAddress(u.member.address, 8, 6)
  }
  return `${u.member.name} — Funk ${u.member.meshNodeId || '—'}`
}

function TeamRemoveUpdateCard(p: {
  update: MorgTeamMemberUpdateV1
  senderLine: string
  receivedLine: string
  sigLine: string | null
  sigBlocksAccept: boolean
  onAccept: (alsoHideFromPhonebook: boolean) => void
  onReject: () => void
}) {
  const [alsoHide, setAlsoHide] = useState(false)
  const u = p.update
  return (
    <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm">
      <div className="flex items-start gap-2">
        <UserMinus className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-semibold text-foreground">{teamUpdateCardTitle('remove')}</p>
          <p className="text-muted-foreground">{teamUpdateMemberLine(u)}</p>
          <p className="text-xs text-muted-foreground">
            {p.senderLine ? `${p.senderLine} · ` : ''}Update #{u.seq}
            {isTeamUpdateSeqRejected(u.seq) ? ' · abgelehnt' : ''}
          </p>
          {p.receivedLine ? <p className="text-xs text-muted-foreground">{p.receivedLine}</p> : null}
          {p.sigLine ? (
            <p
              className={`text-xs ${p.sigBlocksAccept ? 'text-rose-400' : p.sigLine.includes('verifiziert') ? 'text-emerald-400' : 'text-amber-400'}`}
            >
              {p.sigLine}
            </p>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            Standard: Kontakt bleibt im Telefonbuch — nur nicht mehr im aktiven Team-Telefonbuch.
          </p>
          <label className="flex cursor-pointer items-start gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={alsoHide}
              onChange={(e) => setAlsoHide(e.target.checked)}
            />
            <span>Auch aus meinem Telefonbuch ausblenden (optional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => p.onAccept(alsoHide)} disabled={p.sigBlocksAccept}>
              Entfernung bestätigen
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={p.onReject}>
              Ablehnen
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function InboxTeamSyncSystemCards(p: {
  messages: readonly Message[]
  /** Eigene Wallet — Team-Update über sich selbst braucht kein Telefonbuch-Import. */
  myAddress?: string
  onApplied?: () => void
}) {
  const [teamSyncRevision, bumpTeamSyncRevision] = useState(0)
  const [sigByTeamSeq, setSigByTeamSeq] = useState<Map<number, TeamWireSigStatus>>(new Map())
  const [sigByTgSeq, setSigByTgSeq] = useState<Map<number, TeamWireSigStatus>>(new Map())
  const cards = useMemo(() => {
    const teamBySeq = new Map<
      number,
      {
        update: MorgTeamMemberUpdateV1
        chainFrom: string
        receivedVia: Set<TeamSyncReceiveChannel>
      }
    >()
    const tgGroups: {
      group: MorgTelegramAlarmGroupV1
      chainFrom: string
      receivedVia: Set<TeamSyncReceiveChannel>
    }[] = []
    const funkPings: {
      ping: MorgTeamUpdatePingV1
      chainFrom: string
      receivedVia: Set<TeamSyncReceiveChannel>
    }[] = []
    const seenTg = new Set<number>()
    const seenPing = new Set<string>()

    for (const m of p.messages) {
      const content = m.content ?? ''
      const ping = parseMorgTeamUpdatePingV1(content)
      if (ping) {
        const key = `${ping.seq ?? 't'}-${ping.tgSeq ?? 's'}-${ping.teamId}`
        if (!seenPing.has(key)) {
          seenPing.add(key)
          const receivedVia = collectTeamSyncReceiveChannels(m)
          funkPings.push({ ping, chainFrom: m.from ?? '', receivedVia })
        }
      }
      const tu = parseMorgTeamMemberUpdateV1(content)
      if (tu && shouldShowTeamMemberUpdate(tu.seq)) {
        const existing = teamBySeq.get(tu.seq)
        if (existing) {
          mergeReceiveChannels(existing.receivedVia, m)
          if (m.from?.trim() && m.source !== 'lan') existing.chainFrom = m.from.trim()
        } else {
          const receivedVia = collectTeamSyncReceiveChannels(m)
          teamBySeq.set(tu.seq, {
            update: tu,
            chainFrom: m.source === 'lan' ? '' : (m.from ?? '').trim(),
            receivedVia,
          })
        }
      }
      const tg = parseMorgTelegramAlarmGroupV1(content)
      if (
        tg &&
        tg.kind === 'invite_link' &&
        tg.tgSeq > readAppliedTelegramGroupTgSeq() &&
        !isTelegramGroupTgSeqDismissed(tg.tgSeq) &&
        !isTelegramGroupCardSnoozed(tg.tgSeq) &&
        !seenTg.has(tg.tgSeq)
      ) {
        seenTg.add(tg.tgSeq)
        tgGroups.push({
          group: tg,
          chainFrom: m.source === 'lan' ? '' : (m.from ?? '').trim(),
          receivedVia: collectTeamSyncReceiveChannels(m),
        })
      }
    }
    const teamUpdates = [...teamBySeq.values()].sort((a, b) => b.update.seq - a.update.seq)
    tgGroups.sort((a, b) => b.group.tgSeq - a.group.tgSeq)
    funkPings.sort((a, b) => (b.ping.seq ?? b.ping.tgSeq ?? 0) - (a.ping.seq ?? a.ping.tgSeq ?? 0))
    return { teamUpdates, tgGroups, funkPings }
  }, [p.messages, teamSyncRevision])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const team = new Map<number, TeamWireSigStatus>()
      const tg = new Map<number, TeamWireSigStatus>()
      for (const { update } of cards.teamUpdates) {
        team.set(update.seq, await resolveTeamMemberUpdateSigStatus(update))
      }
      for (const { group } of cards.tgGroups) {
        tg.set(group.tgSeq, await resolveTelegramAlarmGroupSigStatus(group))
      }
      if (!cancelled) {
        setSigByTeamSeq(team)
        setSigByTgSeq(tg)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [cards.teamUpdates, cards.tgGroups])

  if (!cards.teamUpdates.length && !cards.tgGroups.length && !cards.funkPings.length) return null

  const teamSigBlocksAccept = (seq: number): boolean => {
    const s = sigByTeamSeq.get(seq)
    return s === 'invalid' || s === 'boss-mismatch'
  }

  const teamSigLine = (seq: number): string | null => {
    const s = sigByTeamSeq.get(seq)
    if (!s) return null
    return formatTeamWireSigStatusLine(s)
  }

  const handleAcceptTeam = async (
    update: NonNullable<ReturnType<typeof parseMorgTeamMemberUpdateV1>>,
    alsoHideFromPhonebook = false
  ) => {
    const selfAddr = (p.myAddress || '').trim().toLowerCase()
    const memberAddr = update.member.address.trim().toLowerCase()
    const isSelf = Boolean(selfAddr) && Boolean(memberAddr) && selfAddr === memberAddr
    if (teamSigBlocksAccept(update.seq) && !isSelf) {
      toast.error(formatTeamWireSigStatusLine(sigByTeamSeq.get(update.seq) ?? 'invalid') ?? 'Signatur ungültig')
      return
    }
    if (update.kind === 'remove') {
      if (alsoHideFromPhonebook) hideContactFromPhonebook(update.member.address)
      markTeamUpdateSeqApplied(update.seq)
      bumpTeamSyncRevision((n) => n + 1)
      toast.message(
        alsoHideFromPhonebook
          ? 'Entfernung bestätigt — Kontakt aus dem Telefonbuch ausgeblendet.'
          : 'Team-Entfernung bestätigt — Kontakt bleibt im Telefonbuch.'
      )
      p.onApplied?.()
      return
    }
    if (isSelf) {
      markTeamUpdateSeqApplied(update.seq)
      bumpTeamSyncRevision((n) => n + 1)
      toast.message('Das bist du — Profil kommt aus dem Handoff, kein Import nötig.')
      p.onApplied?.()
      return
    }
    const contact = memberToInitialProfileContact(update.member)
    const r = await applyInitialProfileProvisioning({ version: 1, contacts: [contact] })
    if (r.ok) {
      markTeamUpdateSeqApplied(update.seq)
      bumpTeamSyncRevision((n) => n + 1)
      toast.success(r.message ?? 'Kontakt ins Telefonbuch übernommen.')
      p.onApplied?.()
      return
    }
    toast.error(r.error || 'Telefonbuch-Update fehlgeschlagen — Backend erreichbar?')
  }

  const handleRejectTeam = (seq: number) => {
    rejectTeamUpdateSeq(seq)
    bumpTeamSyncRevision((n) => n + 1)
    p.onApplied?.()
  }

  return (
    <div className="mb-4 space-y-3" role="region" aria-label="Team-Systemnachrichten">
      {cards.funkPings.map(({ ping, chainFrom, receivedVia }) => (
        <div
          key={`ping-${ping.seq ?? 'x'}-${ping.tgSeq ?? 'y'}-${ping.teamId}`}
          className="rounded-xl border border-violet-500/35 bg-violet-500/10 px-4 py-3 text-sm"
        >
          <div className="flex items-start gap-2">
            <Radio className="mt-0.5 h-5 w-5 shrink-0 text-violet-400" aria-hidden />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-semibold text-foreground">Funk-Hinweis — Update wird geladen</p>
              <p className="text-muted-foreground">
                {ping.hint === 'telegram_group'
                  ? `Neue Telegram-Alarmgruppe #${ping.tgSeq ?? '?'}`
                  : `Team-Update #${ping.seq ?? '?'}`}{' '}
                {teamSyncSenderLine(chainFrom, ping.boss ?? '') || 'Absender unbekannt'}. Posteingang/Mailbox prüfen.
              </p>
              {formatTeamSyncReceivedVia(receivedVia) ? (
                <p className="text-xs text-muted-foreground">{formatTeamSyncReceivedVia(receivedVia)}</p>
              ) : null}
            </div>
          </div>
        </div>
      ))}
      {cards.teamUpdates.map(({ update: u, chainFrom, receivedVia }) => {
        const chainSender = chainFrom.trim()
        const receivedLine = formatTeamSyncReceivedVia(receivedVia)
        const senderLine = teamSyncSenderLine(chainSender, u.boss)
        const sigLine = teamSigLine(u.seq)
        const sigBlocksAccept = teamSigBlocksAccept(u.seq)
        if (u.kind === 'remove') {
          return (
            <TeamRemoveUpdateCard
              key={`team-${u.seq}-remove`}
              update={u}
              senderLine={senderLine}
              receivedLine={receivedLine}
              sigLine={sigLine}
              sigBlocksAccept={sigBlocksAccept}
              onAccept={(alsoHide) => void handleAcceptTeam(u, alsoHide)}
              onReject={() => handleRejectTeam(u.seq)}
            />
          )
        }
        const selfAddr = (p.myAddress || '').trim().toLowerCase()
        const isSelf =
          Boolean(selfAddr) && u.member.address.trim().toLowerCase() === selfAddr
        return (
        <div
          key={`team-${u.seq}-${u.kind}`}
          className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm"
        >
          <div className="flex items-start gap-2">
            <UserPlus className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-semibold text-foreground">{teamUpdateCardTitle(u.kind)}</p>
              <p className="text-muted-foreground">{teamUpdateMemberLine(u)}</p>
              <p className="text-xs text-muted-foreground">
                {senderLine ? `${senderLine} · ` : ''}Update #{u.seq}
                {isTeamUpdateSeqRejected(u.seq) ? ' · abgelehnt' : ''}
              </p>
              {receivedLine ? <p className="text-xs text-muted-foreground">{receivedLine}</p> : null}
              {sigLine ? (
                <p
                  className={`text-xs ${sigBlocksAccept ? 'text-rose-400' : sigLine.includes('verifiziert') ? 'text-emerald-400' : 'text-amber-400'}`}
                >
                  {sigLine}
                </p>
              ) : null}
              {isSelf ? (
                <p className="text-xs text-foreground">
                  Das bist du — dein Profil hast du schon über den Handoff. Die Karte ist nur die
                  Team-Bestätigung für alle.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={() => void handleAcceptTeam(u)} disabled={sigBlocksAccept && !isSelf}>
                  {isSelf ? 'Verstanden' : 'Daten übernehmen'}
                </Button>
                {!isSelf ? (
                  <Button type="button" size="sm" variant="secondary" onClick={() => handleRejectTeam(u.seq)}>
                    Ablehnen
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        )
      })}
      {cards.tgGroups.map(({ group: g, chainFrom, receivedVia }) => {
        const sender = teamSyncSenderLine(chainFrom, g.boss ?? '')
        const receivedLine = formatTeamSyncReceivedVia(receivedVia)
        return (
        <div
          key={`tg-${g.tgSeq}`}
          className="rounded-xl border border-sky-500/35 bg-sky-500/10 px-4 py-3 text-sm"
        >
          <div className="flex items-start gap-2">
            <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" aria-hidden />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-semibold text-foreground">Neue Telegram-Alarmgruppe</p>
              <p className="text-muted-foreground">
                {sender || 'Einsatzleitung'} hat Alarmgruppe „{g.label || 'Einsatz'}“ eingerichtet. Nur
                Hinweise — Inhalte in Morgendrot.
              </p>
              {receivedLine ? <p className="text-xs text-muted-foreground">{receivedLine}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (!g.inviteLink) return
                    saveTelegramAlarmGroupPending({
                      inviteLink: g.inviteLink,
                      label: g.label,
                      tgSeq: g.tgSeq,
                      boss: g.boss,
                    })
                    openTelegramAlarmGroupInvite(g.inviteLink)
                    toast.message(
                      'Telegram geöffnet — nach Beitritt hier auf „Beigetreten“ tippen.'
                    )
                    bumpTeamSyncRevision((n) => n + 1)
                  }}
                >
                  Gruppe beitreten
                </Button>
                {g.inviteLink && isTelegramAlarmGroupJoinInitiatedForLink(g.inviteLink) ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    onClick={() => {
                      markTelegramGroupTgSeqApplied(g.tgSeq)
                      confirmTelegramAlarmGroupJoined({
                        label: g.label,
                        inviteLink: g.inviteLink,
                      })
                      toast.success('Telegram-Alarmgruppe als erledigt markiert — unter Gruppen sichtbar.')
                      bumpTeamSyncRevision((n) => n + 1)
                      p.onApplied?.()
                    }}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" aria-hidden />
                    Beigetreten
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    snoozeTelegramGroupCard(g.tgSeq)
                    bumpTeamSyncRevision((n) => n + 1)
                    p.onApplied?.()
                  }}
                >
                  Später erinnern
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    dismissTelegramGroupTgSeq(g.tgSeq)
                    bumpTeamSyncRevision((n) => n + 1)
                    p.onApplied?.()
                  }}
                >
                  Nicht interessiert
                </Button>
              </div>
            </div>
          </div>
        </div>
        )
      })}
    </div>
  )
}
