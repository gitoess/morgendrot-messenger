'use client'

import { useMemo, useState } from 'react'
import { Check, UserMinus, Users } from 'lucide-react'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import { Button } from '@/components/ui/button'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'
import { isTeamMemberRemoveSent, markTeamMemberRemoveSent } from '@/frontend/lib/team-removed-members-store'
import {
  readHiddenContacts,
  showContactInPhonebook,
} from '@/frontend/lib/contact-phonebook-meta-store'
import {
  canManageTeamRoster,
  contactToTeamMember,
  formatTeamWireDeliveryChannels,
  listTeamRosterWalletContacts,
  removeTeamMemberFromRoster,
} from '@/frontend/lib/team-roster-wire'

export function EinsatzleitungTeamRosterPanel(p: {
  apiStatus?: ApiStatus | null
  contactDirectory: Record<string, ContactMeshEntryClient>
}) {
  const [busyAddress, setBusyAddress] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [removedTick, setRemovedTick] = useState(0)

  const boss = (p.apiStatus?.myAddressFull || p.apiStatus?.myAddress || '').trim()
  const canManage = canManageTeamRoster(p.apiStatus)
  const members = useMemo(
    () => listTeamRosterWalletContacts(p.contactDirectory, boss),
    [p.contactDirectory, boss]
  )

  if (!canManage) {
    return (
      <p className="text-xs text-muted-foreground">
        Team-Telefonbuch: Boss/Kommandant mit Team-Mailbox erforderlich.
      </p>
    )
  }

  const onRemove = async (address: string, entry: ContactMeshEntryClient, displayName: string) => {
    if (isTeamMemberRemoveSent(address)) return
    const member = contactToTeamMember(p.contactDirectory, address, entry)
    if (!member) return
    setBusyAddress(address)
    setFeedback(null)
    const r = await removeTeamMemberFromRoster({
      apiStatus: p.apiStatus,
      member: { ...member, name: displayName },
      confirm: (name) =>
        window.confirm(
          `„${name}" aus dem Team-Telefonbuch entfernen?\n\n` +
            'Alle Team-Mitglieder erhalten eine Posteingang-Nachricht. Der Kontakt bleibt hier in deinem Telefonbuch.'
        ),
    })
    setBusyAddress(null)
    if (!r.ok && r.cancelled) return
    if (!r.ok) {
      setFeedback(r.error)
      return
    }
    markTeamMemberRemoveSent(address)
    setRemovedTick((n) => n + 1)
    setFeedback(`„${displayName}" — Entfernung an das Team gesendet${formatTeamWireDeliveryChannels(r.channels)}.`)
  }

  return (
    <div className="space-y-2 rounded-lg border border-rose-500/25 bg-rose-500/5 p-3">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Users className="h-4 w-4 text-rose-400" aria-hidden />
        Team-Telefonbuch
      </h4>
      <p className="text-[11px] text-muted-foreground">
        Einsatz-Team im Telefonbuch — „Aus Team entfernen“ benachrichtigt alle Helfer (nicht nur lokal ausblenden).
      </p>
      {members.length === 0 ? (
        <p className="text-xs text-muted-foreground">Noch keine Helfer im Telefonbuch.</p>
      ) : (
        <ul className="max-h-48 space-y-1.5 overflow-y-auto">
          {members.map((m) => {
            const removed = isTeamMemberRemoveSent(m.address)
            const hidden = readHiddenContacts().has(m.address)
            void removedTick
            return (
              <li
                key={m.address}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/80 px-2 py-1.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{m.displayName}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{maskWalletAddress(m.address, 6, 4)}</p>
                </div>
                {removed ? (
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      <Check className="h-3.5 w-3.5" aria-hidden />
                      Entfernt
                    </span>
                    {hidden ? (
                      <button
                        type="button"
                        className="text-[10px] text-primary underline"
                        onClick={() => {
                          showContactInPhonebook(m.address)
                          setRemovedTick((n) => n + 1)
                          setFeedback(`„${m.displayName}" wieder im Telefonbuch sichtbar.`)
                        }}
                      >
                        Wieder im Telefonbuch anzeigen
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0 border-rose-500/40 text-xs text-rose-700 hover:bg-rose-500/10 dark:text-rose-300"
                    disabled={busyAddress === m.address}
                    onClick={() => void onRemove(m.address, m.entry, m.displayName)}
                  >
                    <UserMinus className="mr-1 h-3.5 w-3.5" aria-hidden />
                    {busyAddress === m.address ? 'Sende…' : 'Aus Team entfernen'}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {feedback ? (
        <p className="text-xs text-muted-foreground" role="status">
          {feedback}
        </p>
      ) : null}
    </div>
  )
}
