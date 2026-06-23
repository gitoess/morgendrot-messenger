'use client'

import { useEffect, useState } from 'react'
import { Check, UserPlus, X } from 'lucide-react'
import type { ApiStatus } from '@/frontend/lib/api/status'
import { Button } from '@/components/ui/button'
import {
  listPendingJoinRequests,
  markJoinRequestStatus,
  TEAM_JOIN_REQUESTS_CHANGED_EVENT,
  type StoredJoinRequest,
} from '@/frontend/lib/team-join-request-store'
import { publishTeamMemberUpdateWire } from '@/frontend/lib/team-sync-wire'

export function EinsatzleitungJoinRequestsPanel(p: { apiStatus?: ApiStatus | null }) {
  const [, bump] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    const sync = () => bump((n) => n + 1)
    window.addEventListener(TEAM_JOIN_REQUESTS_CHANGED_EVENT, sync)
    return () => window.removeEventListener(TEAM_JOIN_REQUESTS_CHANGED_EVENT, sync)
  }, [])

  const pending = listPendingJoinRequests()
  if (!pending.length) return null

  const boss = (p.apiStatus?.myAddressFull || p.apiStatus?.myAddress || '').trim()
  const teamMb = (p.apiStatus?.inboxUnionMailboxIds?.[0] || p.apiStatus?.mailboxId || '').trim()
  const teamId = (p.apiStatus?.handoffLabel || 'default').trim()

  const approve = async (req: StoredJoinRequest) => {
    setBusyId(req.requestId)
    setFeedback(null)
    const r = await publishTeamMemberUpdateWire({
      teamMailboxAddress: teamMb,
      teamId: req.teamId || teamId,
      bossAddress: boss,
      kind: 'add',
      member: req.applicant,
      telegramGroupHint: true,
    })
    if (r.ok) {
      markJoinRequestStatus(req.requestId, 'join_approved')
      setFeedback(`Freigegeben — Team-Update gesendet${r.channels?.iota ? ' (IOTA)' : ''}.`)
      bump((n) => n + 1)
    } else {
      setFeedback(r.error || 'Freigabe fehlgeschlagen')
    }
    setBusyId(null)
  }

  const reject = (req: StoredJoinRequest) => {
    markJoinRequestStatus(req.requestId, 'join_rejected')
    bump((n) => n + 1)
  }

  return (
    <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-4">
      <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
        <UserPlus className="h-5 w-5 text-amber-400" aria-hidden />
        Beitrittsanfragen
        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium">{pending.length}</span>
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Spontane Helfer ohne Handoff-ZIP — Freigabe sendet Team-Update an alle.
      </p>
      <ul className="mt-4 space-y-3">
        {pending.map((req) => (
          <li
            key={req.requestId}
            className="rounded-lg border border-border/70 bg-card/80 px-3 py-3 text-sm"
          >
            <p className="font-medium text-foreground">{req.applicant.name}</p>
            <p className="font-mono text-xs text-muted-foreground">{req.applicant.address}</p>
            {req.note ? <p className="mt-1 text-muted-foreground">{req.note}</p> : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busyId === req.requestId}
                onClick={() => void approve(req)}
              >
                <Check className="mr-1 h-3.5 w-3.5" aria-hidden />
                Freigeben
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => reject(req)}>
                <X className="mr-1 h-3.5 w-3.5" aria-hidden />
                Ablehnen
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {feedback ? (
        <p className="mt-3 text-xs text-muted-foreground" role="status">
          {feedback}
        </p>
      ) : null}
    </div>
  )
}
