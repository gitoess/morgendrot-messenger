'use client'

import { useMemo } from 'react'
import { Layers, Radio, Users } from 'lucide-react'
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
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Users className="h-4 w-4 text-violet-400" aria-hidden />
        Team-Postfächer (IOTA)
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Gemeinsame Mailbox-Objekte on-chain — nicht einzelne Helfer-Wallets. Provisionierte Helfer stehen oben unter{' '}
        <strong className="font-medium text-foreground">Provisionierte Helfer</strong>.
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2">
          <span className="text-muted-foreground">Server-Postfach</span>
          <span className="font-mono text-xs text-foreground">
            {serverId ? maskWalletAddress(serverId, 8, 6) : '— nicht gesetzt'}
          </span>
        </li>
        {teams.length === 0 ? (
          <li className="text-xs text-muted-foreground">Noch keine Team-Mailbox — unter Einstellungen → IOTA anlegen.</li>
        ) : (
          teams.map((t) => (
            <li
              key={t.objectId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2"
            >
              <span className="font-medium text-foreground">{t.label || 'Team'}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{maskWalletAddress(t.objectId, 6, 4)}</span>
            </li>
          ))
        )}
        {groups.length > 0 ? (
          <li className="text-xs text-muted-foreground">
            <Layers className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            {groups.length} Messenger-Gruppe(n) lokal (Mitgliederlisten) — optional im Handoff als JSON.
          </li>
        ) : null}
      </ul>
      {p.onOpenMailboxes ? (
        <button
          type="button"
          className="mt-3 text-xs font-medium text-primary hover:underline"
          onClick={p.onOpenMailboxes}
        >
          Postfächer in Einstellungen → IOTA öffnen
        </button>
      ) : null}
    </div>
  )
}
