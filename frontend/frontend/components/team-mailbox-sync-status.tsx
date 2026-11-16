'use client'

/**
 * Team-Mailbox existiert on-chain. Diese Karte betrifft nur die Abfrage-Liste
 * der lokalen Morgendrot-API (TEAM_MAILBOX_IDS in .env) — kein zweites Speichern des Postfachs.
 */

import { useMemo, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import type { ApiStatus } from '@/frontend/lib/api'
import { Button } from '@/components/ui/button'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'
import { readMyTeamMailboxes } from '@/frontend/lib/my-team-mailbox-store'
import {
  diffTeamMailboxSync,
  syncLocalTeamMailboxesToServer,
} from '@/frontend/lib/team-mailbox-server-sync'

function teamLabelForId(objectId: string): string {
  const hit = readMyTeamMailboxes().find(
    (e) => e.objectId.trim().toLowerCase() === objectId.trim().toLowerCase()
  )
  return hit?.label?.trim() || 'Team-Postfach'
}

export function TeamMailboxSyncStatus(p: {
  apiSnapshot?: ApiStatus | null
  backendOnline?: boolean
  onReload?: () => void
  className?: string
  variant?: 'full' | 'compact'
}) {
  const variant = p.variant ?? 'full'
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)

  const diff = useMemo(
    () =>
      diffTeamMailboxSync({
        inboxUnionMailboxIds: p.apiSnapshot?.inboxUnionMailboxIds,
        privateServerMailboxId: p.apiSnapshot?.mailboxId,
      }),
    [p.apiSnapshot?.inboxUnionMailboxIds, p.apiSnapshot?.mailboxId]
  )

  const needsPush = diff.missingOnServer.length > 0

  const runSync = async () => {
    setBusy(true)
    setMsg('')
    try {
      const r = await syncLocalTeamMailboxesToServer({
        privateServerMailboxId: p.apiSnapshot?.mailboxId,
      })
      setMsg(
        r.ok
          ? 'Team-ID zur Posteingang-Abfrage hinzugefügt (App-Config). On-Chain war schon da.'
          : r.error || 'Übernehmen fehlgeschlagen.'
      )
      if (r.ok) p.onReload?.()
    } finally {
      setBusy(false)
    }
  }

  const fmt = (id: string) => maskWalletAddress(id, 6, 4)
  const missingLabels = diff.missingOnServer.map(
    (id) => `${teamLabelForId(id)} (${fmt(id)})`
  )

  if (!needsPush) return null

  if (variant === 'compact') {
    return (
      <div className={p.className ?? 'space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3'}>
        <p className="text-xs text-amber-800 dark:text-amber-200">
          {missingLabels.join(', ')}: on-chain ok, fehlt in der Posteingang-Abfrage.
        </p>
        {p.backendOnline ? (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void runSync()}>
            {busy ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Zur Abfrage hinzufügen
          </Button>
        ) : null}
        {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
      </div>
    )
  }

  return (
    <div className={p.className ?? 'space-y-2 rounded-md border border-amber-500/35 bg-amber-500/5 p-3'}>
      <div className="space-y-1">
        <p className="text-xs font-medium text-foreground">Abfrage-Liste (nicht On-Chain)</p>
        <p className="text-[11px] text-muted-foreground">
          <strong className="text-foreground">{missingLabels.join(' · ')}</strong> liegt bereits{' '}
          <strong className="text-foreground">on-chain</strong> und in deiner Team-Liste. Die App fragt standardmäßig
          nur das Hauptpostfach ab — diese Team-ID fehlt noch in der{' '}
          <strong className="text-foreground">Abfrage-Liste</strong> (lokale Config{' '}
          <code className="text-[10px]">TEAM_MAILBOX_IDS</code>). Kein zweites Speichern des Postfachs.
          Browser-Team-Liste wird beim Posteingang ohnehin mitgeladen; der Knopf hält die App-Config synchron.
        </p>
      </div>

      {p.backendOnline ? (
        <Button type="button" size="sm" disabled={busy} onClick={() => void runSync()}>
          {busy ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          )}
          Zur Posteingang-Abfrage hinzufügen
        </Button>
      ) : (
        <p className="text-[11px] text-muted-foreground">App-Backend offline — später erneut.</p>
      )}

      <button
        type="button"
        className="text-[10px] text-muted-foreground underline hover:no-underline"
        onClick={() => setDetailsOpen((v) => !v)}
      >
        {detailsOpen ? 'Weniger' : 'Kurz: was liegt wo?'}
      </button>

      {detailsOpen ? (
        <ul className="list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
          <li>
            <span className="text-foreground">On-Chain:</span> Team-Objekt {diff.missingOnServer.map(fmt).join(', ')}{' '}
            — existiert schon (Messenger/Chain).
          </li>
          <li>
            <span className="text-foreground">Browser:</span> lokale Team-Liste unter Meine Mailboxen (Merker).
          </li>
          <li>
            <span className="text-foreground">Abfrage-Liste:</span> Object-IDs in der App-Config für den
            Server-Pfad — hier fehlt die Team-ID noch.
          </li>
          <li>
            <span className="text-foreground">Hauptpostfach</span> (Karte darunter) = Setup-
            <code className="text-[10px]">MAILBOX_ID</code>, andere ID, Einsatz-Shared.
          </li>
        </ul>
      ) : null}

      {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
    </div>
  )
}
