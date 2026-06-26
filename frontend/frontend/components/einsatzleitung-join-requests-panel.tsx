'use client'

import { useEffect, useState } from 'react'
import { Check, UserPlus, X } from 'lucide-react'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import { Button } from '@/components/ui/button'
import { RosterContactDiffPreview } from '@/frontend/components/roster-contact-diff-preview'
import { applyInitialProfileProvisioning } from '@/frontend/lib/api/contacts'
import { memberToInitialProfileContact, type TeamMemberWireMember } from '@/frontend/lib/morg-team-member-update-v1'
import {
  computeRosterContactDiff,
  findDirectoryEntry,
} from '@/frontend/lib/roster-contact-diff'
import {
  listPendingJoinRequests,
  markJoinRequestStatus,
  TEAM_JOIN_REQUESTS_CHANGED_EVENT,
  type StoredJoinRequest,
} from '@/frontend/lib/team-join-request-store'
import {
  listRosterPendingSuggestions,
  removeRosterPendingSuggestion,
  TEAM_ROSTER_PENDING_CHANGED_EVENT,
  type RosterPendingSuggestion,
} from '@/frontend/lib/team-roster-pending-store'
import {
  formatTeamWireDeliveryChannels,
  publishTeamMemberAddWire,
  resolveTeamSyncContext,
} from '@/frontend/lib/team-roster-wire'
import {
  markRosterPendingOnServer,
  refreshRosterPendingFromServer,
} from '@/frontend/lib/roster-pending-sync'

export const EINSATZLEITUNG_JOIN_REQUESTS_SECTION_ID = 'einsatzleitung-join-requests'

export function EinsatzleitungJoinRequestsPanel(p: {
  apiStatus?: ApiStatus | null
  contactDirectory?: Record<string, ContactMeshEntryClient>
  onContactsChanged?: () => void
}) {
  const [, bump] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    void refreshRosterPendingFromServer().then((r) => {
      if (r.ok) bump((n) => n + 1)
    })
  }, [])

  useEffect(() => {
    const sync = () => bump((n) => n + 1)
    window.addEventListener(TEAM_JOIN_REQUESTS_CHANGED_EVENT, sync)
    window.addEventListener(TEAM_ROSTER_PENDING_CHANGED_EVENT, sync)
    return () => {
      window.removeEventListener(TEAM_JOIN_REQUESTS_CHANGED_EVENT, sync)
      window.removeEventListener(TEAM_ROSTER_PENDING_CHANGED_EVENT, sync)
    }
  }, [])

  const pending = listPendingJoinRequests()
  const rosterPending = listRosterPendingSuggestions()
  const directory = p.contactDirectory ?? {}

  const teamCtx = resolveTeamSyncContext(p.apiStatus)

  const addToPhonebook = async (member: StoredJoinRequest['applicant']) => {
    const contact = memberToInitialProfileContact(member)
    const r = await applyInitialProfileProvisioning({ version: 1, contacts: [contact] })
    if (!r.ok) throw new Error(r.error || 'Telefonbuch-Update fehlgeschlagen')
    p.onContactsChanged?.()
  }

  const publishTeamAdd = async (member: TeamMemberWireMember, teamIdOverride?: string) => {
    if (!teamCtx) {
      return { ok: false as const, error: 'Team-Mailbox fehlt.' }
    }
    return publishTeamMemberAddWire(teamCtx, member, teamIdOverride)
  }

  const approveJoin = async (req: StoredJoinRequest) => {
    setBusyId(req.requestId)
    setFeedback(null)
    try {
      await addToPhonebook(req.applicant)
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'Telefonbuch-Update fehlgeschlagen')
      setBusyId(null)
      return
    }
    const r = await publishTeamAdd(req.applicant, req.teamId || teamCtx?.teamId)
    if (r.ok) {
      void markRosterPendingOnServer(req.requestId, 'approved')
      markJoinRequestStatus(req.requestId, 'join_approved')
      setFeedback(`Freigegeben — Roster aktualisiert, Team-Update gesendet${formatTeamWireDeliveryChannels(r.channels)}.`)
      bump((n) => n + 1)
    } else {
      setFeedback(`Roster gespeichert, aber Team-Update fehlgeschlagen: ${r.error || 'unbekannt'}`)
    }
    setBusyId(null)
  }

  const acceptHandoffSuggestion = async (s: RosterPendingSuggestion) => {
    setBusyId(s.id)
    setFeedback(null)
    try {
      await addToPhonebook(s.member)
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'Roster-Übernahme fehlgeschlagen')
      setBusyId(null)
      return
    }
    const r = await publishTeamAdd(s.member)
    if (r.ok) {
      void markRosterPendingOnServer(s.id, 'approved')
      removeRosterPendingSuggestion(s.id)
      setFeedback(
        `„${s.member.name}" ins Team-Telefonbuch übernommen, Team-Update gesendet${formatTeamWireDeliveryChannels(r.channels)}.`
      )
      bump((n) => n + 1)
    } else {
      setFeedback(`Roster gespeichert, aber Team-Update fehlgeschlagen: ${r.error || 'unbekannt'}`)
    }
    setBusyId(null)
  }

  const dismissHandoffSuggestion = (s: RosterPendingSuggestion) => {
    void markRosterPendingOnServer(s.id, 'dismissed')
    removeRosterPendingSuggestion(s.id)
    bump((n) => n + 1)
  }

  const reject = (req: StoredJoinRequest) => {
    void markRosterPendingOnServer(req.requestId, 'rejected')
    markJoinRequestStatus(req.requestId, 'join_rejected')
    bump((n) => n + 1)
  }

  const showSection = pending.length > 0 || rosterPending.length > 0

  return (
    <div id={EINSATZLEITUNG_JOIN_REQUESTS_SECTION_ID} className="scroll-mt-4 rounded-xl border border-amber-500/35 bg-amber-500/10 p-4">
      <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
        <UserPlus className="h-5 w-5 text-amber-400" aria-hidden />
        Beitrittsanfragen & Roster-Vorschläge
        {pending.length + rosterPending.length > 0 ? (
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium">
            {pending.length + rosterPending.length}
          </span>
        ) : null}
      </h3>
      {!showSection ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Keine offenen Anfragen — Helfer ohne ZIP senden eine Anfrage (Einstellungen → Import). Nach Handoff erscheint
          hier ein Roster-Vorschlag.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rosterPending.map((s) => {
            const existing = findDirectoryEntry(directory, s.member.address)
            const diff = computeRosterContactDiff(existing, s.member)
            return (
              <li
                key={s.id}
                className="rounded-lg border border-border/70 bg-card/80 px-3 py-3 text-sm"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Handoff-Vorschlag</p>
                <p className="font-medium text-foreground">{s.member.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{s.member.address}</p>
                {s.handoffLabel ? (
                  <p className="mt-1 text-xs text-muted-foreground">Preset: {s.handoffLabel}</p>
                ) : null}
                <RosterContactDiffPreview diff={diff} />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busyId === s.id}
                    onClick={() => void acceptHandoffSuggestion(s)}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" aria-hidden />
                    Ins Roster übernehmen
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => dismissHandoffSuggestion(s)}>
                    <X className="mr-1 h-3.5 w-3.5" aria-hidden />
                    Verwerfen
                  </Button>
                </div>
              </li>
            )
          })}
          {pending.map((req) => {
            const existing = findDirectoryEntry(directory, req.applicant.address)
            const diff = computeRosterContactDiff(existing, req.applicant)
            return (
              <li
                key={req.requestId}
                className="rounded-lg border border-border/70 bg-card/80 px-3 py-3 text-sm"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Beitrittsanfrage</p>
                <p className="font-medium text-foreground">{req.applicant.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{req.applicant.address}</p>
                {req.note ? <p className="mt-1 text-muted-foreground">{req.note}</p> : null}
                <RosterContactDiffPreview diff={diff} />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busyId === req.requestId}
                    onClick={() => void approveJoin(req)}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" aria-hidden />
                    Freigeben & Roster übernehmen
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => reject(req)}>
                    <X className="mr-1 h-3.5 w-3.5" aria-hidden />
                    Ablehnen
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {feedback ? (
        <p className="mt-3 text-xs text-muted-foreground" role="status">
          {feedback}
        </p>
      ) : null}
    </div>
  )
}
