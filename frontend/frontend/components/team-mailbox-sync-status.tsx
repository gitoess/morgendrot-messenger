'use client'

import { useMemo, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import type { ApiStatus } from '@/frontend/lib/api'
import { Button } from '@/components/ui/button'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'
import {
  diffTeamMailboxSync,
  syncLocalTeamMailboxesToServer,
} from '@/frontend/lib/team-mailbox-server-sync'

export function TeamMailboxSyncStatus(p: {
  apiSnapshot?: ApiStatus | null
  backendOnline?: boolean
  onReload?: () => void
  className?: string
  /** Wizard: nur wenn etwas nicht stimmt */
  variant?: 'full' | 'compact'
}) {
  const variant = p.variant ?? 'full'
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const diff = useMemo(
    () =>
      diffTeamMailboxSync({
        inboxUnionMailboxIds: p.apiSnapshot?.inboxUnionMailboxIds,
        privateServerMailboxId: p.apiSnapshot?.mailboxId,
      }),
    [p.apiSnapshot?.inboxUnionMailboxIds, p.apiSnapshot?.mailboxId]
  )

  const runSync = async () => {
    setBusy(true)
    setMsg('')
    try {
      const r = await syncLocalTeamMailboxesToServer({
        privateServerMailboxId: p.apiSnapshot?.mailboxId,
      })
      setMsg(r.ok ? r.message || 'Synchronisiert.' : r.error || 'Sync fehlgeschlagen.')
      if (r.ok) p.onReload?.()
    } finally {
      setBusy(false)
    }
  }

  const fmt = (id: string) => maskWalletAddress(id, 6, 4)

  if (variant === 'compact') {
    if (diff.missingOnServer.length === 0) return null
    return (
      <div className={p.className ?? 'rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-2'}>
        <p className="text-xs text-amber-800 dark:text-amber-200">
          {diff.missingOnServer.length} Team-Postfach/Postfächer nur auf diesem Gerät — auf den Server übernehmen.
        </p>
        {p.backendOnline ? (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void runSync()}>
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
            Auf Server übernehmen
          </Button>
        ) : null}
        {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
      </div>
    )
  }

  return (
    <div className={p.className ?? 'rounded-md border border-border/80 bg-muted/30 p-3 space-y-2'}>
      <p className="text-xs font-medium text-foreground">Postfach-Abgleich (Server vs. lokal)</p>
      <dl className="grid gap-1 text-xs text-muted-foreground">
        <div className="flex flex-wrap justify-between gap-x-2">
          <dt>Server-Posteingang-Union</dt>
          <dd>{diff.serverUnionIds.length} ID(s)</dd>
        </div>
        {diff.serverPrivateMailboxId ? (
          <div className="flex flex-wrap justify-between gap-x-2">
            <dt>Privat (MAILBOX_ID)</dt>
            <dd className="font-mono">{fmt(diff.serverPrivateMailboxId)}</dd>
          </div>
        ) : null}
        <div className="flex flex-wrap justify-between gap-x-2">
          <dt>Lokal Team-Store</dt>
          <dd>{diff.localTeamIds.length} Postfach/Postfächer</dd>
        </div>
      </dl>
      {diff.missingOnServer.length > 0 ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          {diff.missingOnServer.length} Team-Postfach/Postfächer nur lokal — nicht in der Server-Union. „Auf Server
          übernehmen“ oder Team-Mailbox erneut anlegen.
        </p>
      ) : diff.inSync && diff.localTeamIds.length > 0 ? (
        <p className="text-xs text-emerald-800 dark:text-emerald-200">Lokale Team-Postfächer sind in der Server-Union.</p>
      ) : null}
      {diff.onlyOnServerUnion.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {diff.onlyOnServerUnion.length} ID(s) nur auf dem Server (History/TEAM_MAILBOX_IDS) — optional lokal per
          „Team beitreten“.
        </p>
      ) : null}
      {p.backendOnline ? (
        <Button type="button" size="sm" variant="outline" disabled={busy || !diff.localTeamIds.length} onClick={() => void runSync()}>
          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
          Auf Server übernehmen
        </Button>
      ) : null}
      {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
    </div>
  )
}
