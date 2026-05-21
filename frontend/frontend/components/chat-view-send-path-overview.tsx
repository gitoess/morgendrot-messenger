'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  INBOX_UNION_HINT,
  SEND_PATH_OVERVIEW_ROWS,
  SEND_TARGET_PRIORITY_HINT,
  type SendPathOverviewRow,
} from '@/frontend/lib/send-path-overview-rows'

function Badge(p: { kind: SendPathOverviewRow['badge'] }) {
  if (!p.kind) return null
  const cls =
    p.kind === 'server'
      ? 'bg-sky-500/20 text-sky-900 dark:text-sky-100'
      : p.kind === 'team'
        ? 'bg-amber-500/25 text-amber-950 dark:text-amber-100'
        : p.kind === 'private'
          ? 'bg-violet-500/20 text-violet-950 dark:text-violet-100'
          : p.kind === 'event'
            ? 'bg-amber-500/15 text-amber-900 dark:text-amber-100'
            : 'bg-emerald-500/15 text-emerald-900 dark:text-emerald-100'
  const label =
    p.kind === 'server'
      ? 'Server'
      : p.kind === 'team'
        ? 'Team'
        : p.kind === 'private'
          ? 'Privat'
          : p.kind === 'event'
            ? 'Event'
            : 'Kanal'
  return (
    <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide', cls)}>{label}</span>
  )
}

export function ChatViewSendPathOverview(p: { defaultOpen?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(p.defaultOpen ?? false)
  const channelRows = SEND_PATH_OVERVIEW_ROWS.filter((r) => r.badge === 'channel')
  const storageRows = SEND_PATH_OVERVIEW_ROWS.filter((r) => r.badge !== 'channel')

  return (
    <div
      className={cn(
        'rounded-lg border border-border/80 bg-muted/20',
        p.compact ? 'text-[10px]' : 'text-[11px]'
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left font-medium text-foreground hover:bg-muted/40"
      >
        <span className="inline-flex items-center gap-2">
          <Info className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          Übersicht: Kanäle, Speicher &amp; Mailboxen
        </span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>

      {open ? (
        <div className="space-y-3 border-t border-border/60 px-3 py-3">
          <p className="leading-snug text-muted-foreground">
            <strong className="text-foreground">Drei Ebenen</strong> nicht vermischen: (1){' '}
            <strong className="text-foreground">Kanal</strong> 1:1 / Gruppe / Pinnwand, (2){' '}
            <strong className="text-foreground">Speicher</strong> Event vs. Mailbox, (3){' '}
            <strong className="text-foreground">Ziel-Mailbox</strong> Server / Team / Privat. Verschlüsselung ist
            unabhängig (Handshake zwischen zwei 0x-Adressen).
          </p>
          <p className="text-muted-foreground">{SEND_TARGET_PRIORITY_HINT}</p>
          <p className="text-muted-foreground">{INBOX_UNION_HINT}</p>

          <div>
            <p className="mb-1.5 font-semibold text-foreground">Kommunikationskanäle</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-1 pr-2">Kanal</th>
                    <th className="py-1 pr-2">Persistenz</th>
                    <th className="py-1 pr-2">Verschlüsselung</th>
                    <th className="py-1 pr-2">Wer sieht was?</th>
                    <th className="py-1">Wann?</th>
                  </tr>
                </thead>
                <tbody>
                  {channelRows.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 align-top">
                      <td className="py-1.5 pr-2">
                        <Badge kind={r.badge} />
                        <span className="ml-1 font-medium text-foreground">{r.uiName}</span>
                      </td>
                      <td className="py-1.5 pr-2 text-muted-foreground">{r.persistence}</td>
                      <td className="py-1.5 pr-2 text-muted-foreground">{r.encryption}</td>
                      <td className="py-1.5 pr-2 text-muted-foreground">{r.whoSees}</td>
                      <td className="py-1.5 text-muted-foreground">{r.whenUse}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="mb-1.5 font-semibold text-foreground">Speicher &amp; Mailbox-Ziele (online)</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-1 pr-2">Typ</th>
                    <th className="py-1 pr-2">1:1 / Gruppe?</th>
                    <th className="py-1 pr-2">Persistenz</th>
                    <th className="py-1 pr-2">Aktiv setzen?</th>
                    <th className="py-1">Hinweis</th>
                  </tr>
                </thead>
                <tbody>
                  {storageRows.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 align-top">
                      <td className="py-1.5 pr-2">
                        <Badge kind={r.badge} />
                        <span className="ml-1 font-medium text-foreground">{r.uiName}</span>
                      </td>
                      <td className="py-1.5 pr-2 text-muted-foreground">{r.channel}</td>
                      <td className="py-1.5 pr-2 text-muted-foreground">{r.persistence}</td>
                      <td className="py-1.5 pr-2 text-muted-foreground">{r.activeRequired}</td>
                      <td className="py-1.5 text-muted-foreground">{r.whenUse}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground">
            Doku: <span className="font-mono">docs/SENDEWEGE-KANAL-MAILBOX-UEBERSICHT.md</span>,{' '}
            <span className="font-mono">docs/TEAM-MAILBOXES.md</span>,{' '}
            <span className="font-mono">docs/MAILBOX-BEGRIFFE-UND-NUTZUNG.md</span>
          </p>
        </div>
      ) : null}
    </div>
  )
}
