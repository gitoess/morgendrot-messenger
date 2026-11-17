'use client'

import { useMemo } from 'react'
import { Layers, Users } from 'lucide-react'
import { readMyTeamMailboxes } from '@/frontend/lib/my-team-mailbox-store'
import { readMessengerGroups } from '@/frontend/lib/messenger-group-store'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'

export function EinsatzleitungTeamOverviewPanel(p: {
  serverMailboxId?: string | null
  onOpenMailboxes?: () => void
}) {
  const teams = useMemo(() => readMyTeamMailboxes(), [])
  const groups = useMemo(() => readMessengerGroups(), [])
  const serverId = (p.serverMailboxId || '').trim()

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Users className="h-4 w-4 text-foreground" aria-hidden />
        Team-Mailboxen
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Gemeinsame Postfächer on-chain (nicht einzelne Helfer-Wallets). Anlage/Verwaltung:{' '}
        <strong className="font-medium text-foreground">Einstellungen → IOTA → Meine Mailboxen</strong>.
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
          <span className="text-muted-foreground">Einsatz-Mailbox (Boss)</span>
          <span className="font-mono text-xs text-foreground">
            {serverId ? maskWalletAddress(serverId, 8, 6) : '— nicht gesetzt'}
          </span>
        </li>
        {teams.length === 0 ? (
          <li className="text-xs text-muted-foreground">Noch keine Team-Mailbox angelegt.</li>
        ) : (
          teams.map((t) => (
            <li
              key={t.objectId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
            >
              <span className="font-medium text-foreground">{t.label || 'Team'}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {maskWalletAddress(t.objectId, 6, 4)}
              </span>
            </li>
          ))
        )}
        {groups.length > 0 ? (
          <li className="text-xs text-muted-foreground">
            <Layers className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            {groups.length} Chat-Gruppe(n) lokal (Mitgliederlisten).
          </li>
        ) : null}
      </ul>
      {p.onOpenMailboxes ? (
        <button
          type="button"
          className="mt-3 text-xs font-medium text-foreground underline underline-offset-2 hover:no-underline"
          onClick={p.onOpenMailboxes}
        >
          Zu Einstellungen → IOTA → Meine Mailboxen
        </button>
      ) : null}
    </div>
  )
}
