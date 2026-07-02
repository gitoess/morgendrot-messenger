'use client'

import { useCallback, useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ApiStatus } from '@/frontend/lib/api/status'
import { ChatViewPrivateMailboxCreateButton } from '@/frontend/components/chat-view-private-mailbox-create-button'
import { ChatViewTeamMailboxCreateButton } from '@/frontend/components/chat-view-team-mailbox-create-button'
import { TeamMailboxSyncStatus } from '@/frontend/components/team-mailbox-sync-status'
import { applyBossServerMailboxId } from '@/frontend/lib/onboarding-boss-bootstrap'
import {
  buildBossWizardMailboxesContext,
  sourceLabel,
  type BossWizardMailboxRow,
} from '@/frontend/lib/boss-wizard-mailboxes-context'
import { isBrowserSessionSignerReady } from '@/frontend/lib/messenger-session-keys-ready'
import { toast } from 'sonner'

type Props = {
  apiSnapshot?: ApiStatus | null
  backendOnline?: boolean
  sessionLocked?: boolean
  onActivateWallet?: () => void
  onReload?: () => void
}

function StatusRow(p: { ok: boolean; label: string; detail?: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-start gap-2 text-sm">
        <span className={p.ok ? 'text-emerald-500' : 'text-muted-foreground'} aria-hidden>
          {p.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <span className="mt-0.5 inline-block w-4 text-center">○</span>}
        </span>
        <span className={p.ok ? 'text-foreground' : 'text-muted-foreground'}>{p.label}</span>
      </div>
      {p.detail ? <p className="ml-6 text-xs text-muted-foreground">{p.detail}</p> : null}
    </div>
  )
}

function MailboxIdRow(p: { row: BossWizardMailboxRow; copied: string | null; onCopy: (id: string, key: string) => void }) {
  const copyKey = p.row.id
  return (
    <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{sourceLabel(p.row.source)}</p>
          <p className="mt-0.5 font-mono text-muted-foreground" title={p.row.id}>
            {p.row.masked}
          </p>
          {p.row.label ? (
            <p className="mt-0.5 text-muted-foreground">Anzeigename in der App: {p.row.label}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1 text-primary hover:underline"
          onClick={() => p.onCopy(p.row.id, copyKey)}
        >
          {p.copied === copyKey ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {p.copied === copyKey ? 'Kopiert' : 'Kopieren'}
        </button>
      </div>
    </div>
  )
}

function CreateMailboxButtons(p: {
  walletValid: boolean
  backendOnline?: boolean
  privateServerMailboxId?: string
  onStatus: (text: string, kind?: 'success' | 'error') => void
  onRefresh: () => void
  onReload?: () => void
  showPrivate: boolean
  showTeam: boolean
}) {
  const canChain = Boolean(p.walletValid && p.backendOnline)
  return (
    <div className="flex flex-wrap gap-2">
      {p.showPrivate ? (
        <ChatViewPrivateMailboxCreateButton
          walletValid={canChain}
          onObjectId={(id) => {
            void applyBossServerMailboxId(id).then((r) => {
              const text = r.ok ? r.message || 'Als Server-Postfach gespeichert.' : r.error || 'Speichern fehlgeschlagen.'
              p.onStatus(text, r.ok ? 'success' : 'error')
              if (r.ok) {
                p.onRefresh()
                p.onReload?.()
              }
            })
          }}
          onStatus={(text, kind) => p.onStatus(text, kind)}
        />
      ) : null}
      {p.showTeam ? (
        <ChatViewTeamMailboxCreateButton
          walletValid={canChain}
          privateServerMailboxId={p.privateServerMailboxId}
          onObjectId={() => {
            p.onRefresh()
            p.onReload?.()
          }}
          onStatus={(text, kind) => p.onStatus(text, kind)}
        />
      ) : null}
    </div>
  )
}

export function OnboardingBossMailboxesStep(p: Props) {
  const walletValid = isBrowserSessionSignerReady(p.sessionLocked ?? false)
  const [refreshKey, bump] = useState(0)
  const ctx = useMemo(
    () => buildBossWizardMailboxesContext(p.apiSnapshot),
    [p.apiSnapshot, refreshKey]
  )
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const refreshLocal = useCallback(() => bump((n) => n + 1), [])

  const copyId = (value: string, key: string) => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const onStatus = (text: string, kind?: 'success' | 'error') => {
    setMsg(text)
    refreshLocal()
    if (kind === 'success') toast.success(text)
    else if (kind === 'error') toast.error(text)
  }

  const serverRows = ctx.allRows.filter((r) => r.source === 'server')
  const teamRows = ctx.allRows.filter((r) => r.source !== 'server')
  const needsPrivate = !ctx.hasServerPrivate
  const needsTeam = !ctx.hasTeamMailbox
  const readyToContinue = ctx.hasServerPrivate

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Postfächer sind <strong className="font-medium text-foreground">Chain-Objekte</strong> (0x…-IDs) — kein Name
        nötig. Beim Chain-Schritt mit „Server-Postfach mit anlegen“ ist dein privates Postfach oft{' '}
        <strong className="font-medium text-foreground">schon da</strong>. Ein <strong className="font-medium text-foreground">Anzeigename</strong> für
        Helfer-Exporte kommt später in der Einsatzleitung unter{' '}
        <strong className="font-medium text-foreground">Helfer einrichten</strong>, nicht in diesem Wizard.
      </p>

      <TeamMailboxSyncStatus
        apiSnapshot={p.apiSnapshot}
        backendOnline={p.backendOnline}
        onReload={() => {
          refreshLocal()
          p.onReload?.()
        }}
        variant="compact"
      />

      <div className="space-y-3 rounded-md border border-border/80 bg-muted/15 p-3">
        <StatusRow
          ok={ctx.hasServerPrivate}
          label={ctx.hasServerPrivate ? 'Privates Server-Postfach' : 'Privates Server-Postfach fehlt'}
          detail={
            ctx.hasServerPrivate
              ? 'Dein Posteingang auf dem Boss (MAILBOX_ID).'
              : 'Beim Chain-Deploy mit „Registries mit anlegen“ entsteht es — sonst unten anlegen.'
          }
        />
        {serverRows.map((r) => (
          <MailboxIdRow key={r.id} row={r} copied={copied} onCopy={copyId} />
        ))}
      </div>

      <div className="space-y-3 rounded-md border border-border/80 bg-muted/15 p-3">
        <StatusRow
          ok={ctx.hasTeamMailbox}
          label={ctx.hasTeamMailbox ? 'Team-Postfach' : 'Team-Postfach (optional)'}
          detail={
            ctx.hasTeamMailbox
              ? 'Gemeinsames Postfach — Helfer können per Handoff/QR beitreten.'
              : 'Nur nötig, wenn mehrere Helfer dasselbe Einsatz-Postfach nutzen sollen.'
          }
        />
        {teamRows.map((r) => (
          <MailboxIdRow key={r.id} row={r} copied={copied} onCopy={copyId} />
        ))}
      </div>

      {needsPrivate || needsTeam ? (
        <div className="space-y-3 rounded-md border border-sky-500/30 bg-sky-500/5 p-3">
          <p className="text-sm font-medium text-foreground">
            {needsPrivate && needsTeam
              ? 'Noch anlegen'
              : needsPrivate
                ? 'Server-Postfach fehlt'
                : 'Team-Postfach optional anlegen'}
          </p>

          {!walletValid ? (
            <>
              <p className="text-xs text-muted-foreground">
                On-chain anlegen braucht den <strong className="text-foreground/90">Session-Signer</strong> (Schritt
                Wallet). Ohne Signer siehst du trotzdem, was der Boss schon hat.
              </p>
              {p.onActivateWallet ? (
                <Button type="button" size="sm" variant="outline" onClick={() => p.onActivateWallet?.()}>
                  Session-Signer laden
                </Button>
              ) : null}
            </>
          ) : !p.backendOnline ? (
            <p className="text-xs text-amber-800 dark:text-amber-200">Boss-Server offline — `npm run dm` starten.</p>
          ) : (
            <CreateMailboxButtons
              walletValid={walletValid}
              backendOnline={p.backendOnline}
              privateServerMailboxId={p.apiSnapshot?.mailboxId}
              showPrivate={needsPrivate}
              showTeam={needsTeam}
              onStatus={onStatus}
              onRefresh={refreshLocal}
              onReload={p.onReload}
            />
          )}
        </div>
      ) : null}

      {readyToContinue ? (
        <p className="text-xs text-emerald-800 dark:text-emerald-200">
          Server-Postfach ist eingerichtet — mit <strong>Weiter</strong>. Team-Postfach ist optional und kann auch unter
          Einstellungen oder beim Helfer-Export nachgeholt werden.
        </p>
      ) : null}

      {readyToContinue && walletValid && p.backendOnline ? (
        <details className="rounded-md border border-border/60 p-3">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            Erweitert: zusätzliches Postfach on-chain
          </summary>
          <div className="mt-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              Nur für Sonderfälle (zweites privates Postfach, weiteres Team). Beim Team-Button fragt die App einmal nach
              einem Anzeigenamen — das ist <em>nicht</em> der Einsatz-Titel für Handoffs.
            </p>
            <CreateMailboxButtons
              walletValid={walletValid}
              backendOnline={p.backendOnline}
              privateServerMailboxId={p.apiSnapshot?.mailboxId}
              showPrivate
              showTeam
              onStatus={onStatus}
              onRefresh={refreshLocal}
              onReload={p.onReload}
            />
          </div>
        </details>
      ) : null}

      {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
    </div>
  )
}
