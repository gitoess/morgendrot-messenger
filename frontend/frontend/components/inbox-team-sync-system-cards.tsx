'use client'

import { useMemo, useState } from 'react'
import { Check, MessageCircle, Radio, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Message } from '@/frontend/lib/types'
import { applyInitialProfileProvisioning } from '@/frontend/lib/api/contacts'
import {
  parseMorgTeamMemberUpdateV1,
  memberToInitialProfileContact,
  type MorgTeamMemberUpdateV1,
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
  readLastAppliedTeamUpdateSeq,
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

function shortBoss(addr: string): string {
  const a = addr.trim()
  if (a.length < 12) return a
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

export function InboxTeamSyncSystemCards(p: {
  messages: readonly Message[]
  onApplied?: () => void
}) {
  const [, bump] = useState(0)
  const cards = useMemo(() => {
    const teamUpdates: MorgTeamMemberUpdateV1[] = []
    const tgGroups: MorgTelegramAlarmGroupV1[] = []
    const funkPings: MorgTeamUpdatePingV1[] = []
    const seenTeam = new Set<number>()
    const seenTg = new Set<number>()
    const seenPing = new Set<string>()

    for (const m of p.messages) {
      const content = m.content ?? ''
      const ping = parseMorgTeamUpdatePingV1(content)
      if (ping) {
        const key = `${ping.seq ?? 't'}-${ping.tgSeq ?? 's'}-${ping.teamId}`
        if (!seenPing.has(key)) {
          seenPing.add(key)
          funkPings.push(ping)
        }
      }
      const tu = parseMorgTeamMemberUpdateV1(content)
      if (tu && shouldShowTeamMemberUpdate(tu.seq) && !seenTeam.has(tu.seq)) {
        seenTeam.add(tu.seq)
        teamUpdates.push(tu)
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
        tgGroups.push(tg)
      }
    }
    teamUpdates.sort((a, b) => b.seq - a.seq)
    tgGroups.sort((a, b) => b.tgSeq - a.tgSeq)
    funkPings.sort((a, b) => (b.seq ?? b.tgSeq ?? 0) - (a.seq ?? a.tgSeq ?? 0))
    return { teamUpdates, tgGroups, funkPings }
  }, [p.messages, bump])

  if (!cards.teamUpdates.length && !cards.tgGroups.length && !cards.funkPings.length) return null

  const handleAcceptTeam = async (update: NonNullable<ReturnType<typeof parseMorgTeamMemberUpdateV1>>) => {
    const contact = memberToInitialProfileContact(update.member)
    const r = await applyInitialProfileProvisioning({ version: 1, contacts: [contact] })
    if (r.ok) {
      markTeamUpdateSeqApplied(update.seq)
      bump((n) => n + 1)
      p.onApplied?.()
    }
  }

  const handleRejectTeam = (seq: number) => {
    rejectTeamUpdateSeq(seq)
    bump((n) => n + 1)
    p.onApplied?.()
  }

  return (
    <div className="mb-4 space-y-3" role="region" aria-label="Team-Systemnachrichten">
      {cards.funkPings.map((ping) => (
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
                von Einsatzleitung ({shortBoss(ping.boss)}). Posteingang/Mailbox prüfen.
              </p>
            </div>
          </div>
        </div>
      ))}
      {cards.teamUpdates.map((u) => (
        <div
          key={`team-${u.seq}`}
          className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm"
        >
          <div className="flex items-start gap-2">
            <UserPlus className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-semibold text-foreground">Neues Team-Mitglied</p>
              <p className="text-muted-foreground">
                {u.member.name} — Funk {u.member.meshNodeId || '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                Von Einsatzleitung ({shortBoss(u.boss)}) · Update #{u.seq}
                {u.seq <= readLastAppliedTeamUpdateSeq() ? ' · bereits übernommen' : ''}
                {isTeamUpdateSeqRejected(u.seq) ? ' · abgelehnt' : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={() => void handleAcceptTeam(u)}>
                  Daten übernehmen
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => handleRejectTeam(u.seq)}>
                  Ablehnen
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}
      {cards.tgGroups.map((g) => (
        <div
          key={`tg-${g.tgSeq}`}
          className="rounded-xl border border-sky-500/35 bg-sky-500/10 px-4 py-3 text-sm"
        >
          <div className="flex items-start gap-2">
            <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" aria-hidden />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-semibold text-foreground">Neue Telegram-Alarmgruppe</p>
              <p className="text-muted-foreground">
                Einsatzleitung ({shortBoss(g.boss)}) hat Alarmgruppe „{g.label || 'Einsatz'}“ eingerichtet. Nur
                Hinweise — Inhalte in Morgendrot.
              </p>
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
                    bump((n) => n + 1)
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
                      bump((n) => n + 1)
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
                    bump((n) => n + 1)
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
                    bump((n) => n + 1)
                    p.onApplied?.()
                  }}
                >
                  Nicht interessiert
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
