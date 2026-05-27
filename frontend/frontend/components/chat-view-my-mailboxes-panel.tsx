'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, QrCode, RotateCcw, Trash2, UserPlus, UserRoundPlus } from 'lucide-react'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { buildContactQrPayload } from '@/frontend/lib/contact-qr'
import { fetchDeploymentMailboxId } from '@/frontend/lib/fetch-deployment-mailbox-id'
import { ChatViewPrivateMailboxDeleteDialog } from '@/frontend/components/chat-view-private-mailbox-delete-dialog'
import { ChatViewPrivateMailboxCreateButton } from '@/frontend/components/chat-view-private-mailbox-create-button'
import { ChatViewTeamMailboxCreateButton } from '@/frontend/components/chat-view-team-mailbox-create-button'
import { ContactMailboxPhonebookDialog } from '@/frontend/components/contact-mailbox-phonebook-dialog'
import { ChatViewSendPathOverview } from '@/frontend/components/chat-view-send-path-overview'
import {
  clearActiveSendMailbox,
  readActiveSendMailbox,
  setActivePrivateMailboxObjectId,
  setActiveTeamMailboxObjectId,
  type ActiveSendMailbox,
} from '@/frontend/lib/my-mailbox-active'
import {
  addMyPrivateMailbox,
  archiveMyPrivateMailbox,
  backfillPrivateMailboxLabels,
  forgetMyPrivateMailbox,
  readArchivedMyPrivateMailboxes,
  readMyPrivateMailboxes,
  restoreMyPrivateMailbox,
  updateMyPrivateMailboxLabel,
  type MyPrivateMailboxEntry,
} from '@/frontend/lib/my-private-mailbox-store'
import {
  archiveMyTeamMailbox,
  backfillTeamMailboxLabels,
  forgetMyTeamMailbox,
  joinMyTeamMailbox,
  readArchivedMyTeamMailboxes,
  readMyTeamMailboxes,
  restoreMyTeamMailbox,
  updateMyTeamMailboxLabel,
  type MyTeamMailboxEntry,
} from '@/frontend/lib/my-team-mailbox-store'

function maskMid(id: string): string {
  const t = id.trim()
  if (t.length < 20) return t
  return `${t.slice(0, 10)}…${t.slice(-8)}`
}

function TypeBadge(p: { kind: 'server' | 'team' | 'private' }) {
  const cls =
    p.kind === 'server'
      ? 'bg-sky-500/20 text-sky-900 dark:text-sky-100'
      : p.kind === 'team'
        ? 'bg-amber-500/25 text-amber-950 dark:text-amber-100'
        : 'bg-violet-500/20 text-violet-950 dark:text-violet-100'
  const label = p.kind === 'server' ? 'Server' : p.kind === 'team' ? 'Team' : 'Privat'
  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${cls}`}>{label}</span>
  )
}

function MailboxIdRow(p: { objectId: string; copiedId: string | null; onCopy: (id: string) => void }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <code className="font-mono text-[10px] break-all" title={p.objectId}>
        {p.objectId}
      </code>
      <button
        type="button"
        onClick={() => p.onCopy(p.objectId)}
        className="rounded border border-border px-1 py-0.5 text-[10px] hover:bg-accent"
      >
        {p.copiedId === p.objectId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  )
}

export type ChatViewMyMailboxesPanelProps = {
  myAddressLine: string
  serverMailboxIdHint?: string
  contactDirectory?: Record<string, ContactMeshEntryClient>
  onContactsChanged?: () => void
  onApplySendRecipient?: (walletAddress: string) => void
  onStatus?: (msg: string, kind: 'success' | 'error') => void
  onMailboxActivated?: () => void
  /** false = Team-Mailbox erstellen ausblenden (Citizen / Arbeiter). Default: ausgeblendet. */
  teamMailboxCreateAllowed?: boolean
}

export function ChatViewMyMailboxesPanel(p: ChatViewMyMailboxesPanelProps) {
  const full = (p.myAddressLine || '').trim()
  const walletValid = /^0x[a-fA-F0-9]{64}$/i.test(full)

  const [serverId, setServerId] = useState((p.serverMailboxIdHint ?? '').trim())
  const [privateList, setPrivateList] = useState<MyPrivateMailboxEntry[]>([])
  const [teamList, setTeamList] = useState<MyTeamMailboxEntry[]>([])
  const [privateArchived, setPrivateArchived] = useState<MyPrivateMailboxEntry[]>([])
  const [teamArchived, setTeamArchived] = useState<MyTeamMailboxEntry[]>([])
  const [active, setActive] = useState<ActiveSendMailbox>(readActiveSendMailbox())
  const [qrCopied, setQrCopied] = useState(false)
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [assignMbId, setAssignMbId] = useState('')
  const [highlightTeamId, setHighlightTeamId] = useState('')
  const [phonebookAssign, setPhonebookAssign] = useState<{
    objectId: string
    kind: 'private' | 'team'
    label?: string
  } | null>(null)

  const reload = useCallback(() => {
    backfillPrivateMailboxLabels()
    backfillTeamMailboxLabels()
    setPrivateList(readMyPrivateMailboxes())
    setTeamList(readMyTeamMailboxes())
    setPrivateArchived(readArchivedMyPrivateMailboxes())
    setTeamArchived(readArchivedMyTeamMailboxes())
    setActive(readActiveSendMailbox())
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const hint = (p.serverMailboxIdHint ?? '').trim()
      if (hint && /^0x[a-fA-F0-9]{64}$/i.test(hint)) {
        if (!cancelled) setServerId(hint)
        return
      }
      const id = await fetchDeploymentMailboxId()
      if (!cancelled) setServerId(id)
    })()
    return () => {
      cancelled = true
    }
  }, [p.serverMailboxIdHint])

  const serverAvailable = /^0x[a-fA-F0-9]{64}$/i.test(serverId)

  const isActive = (kind: 'team' | 'private', objectId: string): boolean =>
    active.kind === kind && active.objectId.toLowerCase() === objectId.trim().toLowerCase()

  const profileQr = useCallback(() => {
    if (!walletValid) return ''
    try {
      const mb =
        active.kind === 'private' || active.kind === 'team' ? active.objectId : undefined
      return buildContactQrPayload({ address: full, mailboxObjectId: mb })
    } catch {
      return ''
    }
  }, [full, active, walletValid])

  const copyId = (id: string) => {
    void navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const activate = (kind: 'team' | 'private', objectId: string) => {
    if (kind === 'team') setActiveTeamMailboxObjectId(objectId)
    else setActivePrivateMailboxObjectId(objectId)
    reload()
    p.onStatus?.(`Aktiv: ${kind === 'team' ? 'Team' : 'Private'}-Mailbox ${maskMid(objectId)}.`, 'success')
    p.onMailboxActivated?.()
  }

  const deactivateSendFocus = () => {
    clearActiveSendMailbox()
    reload()
    p.onStatus?.('Senden + Posteingang-Fokus: nur Server-Shared (.env).', 'success')
    p.onMailboxActivated?.()
  }

  const joinTeam = () => {
    const raw = window.prompt('Team-Mailbox Object-ID (0x + 64 Hex) oder aus QR einfügen:')?.trim()
    if (!raw || !/^0x[a-fA-F0-9]{64}$/i.test(raw)) {
      if (raw) p.onStatus?.('Ungültige Object-ID.', 'error')
      return
    }
    const label = window.prompt('Anzeigename (optional):', 'Team Einsatz')?.trim()
    joinMyTeamMailbox(raw, label || undefined)
    reload()
    p.onStatus?.(`Team-Mailbox ${maskMid(raw)} beigetreten.`, 'success')
    p.onMailboxActivated?.()
  }

  const openPhonebookAssign = (objectId: string, kind: 'private' | 'team', label?: string) => {
    setPhonebookAssign({ objectId, kind, label })
  }

  const assignToContact = () => {
    const mb = assignMbId.trim()
    if (!/^0x[a-fA-F0-9]{64}$/i.test(mb)) {
      p.onStatus?.('Zuerst eine Mailbox wählen.', 'error')
      return
    }
    const kind = teamList.some((e) => e.objectId.toLowerCase() === mb.toLowerCase()) ? 'team' : 'private'
    const entry =
      kind === 'team'
        ? teamList.find((e) => e.objectId.toLowerCase() === mb.toLowerCase())
        : privateList.find((e) => e.objectId.toLowerCase() === mb.toLowerCase())
    openPhonebookAssign(mb, kind, entry?.label)
  }

  const saveToOwnPhonebook = (mailboxObjectId: string, kind: 'private' | 'team', label?: string) => {
    if (!walletValid) return
    openPhonebookAssign(mailboxObjectId, kind, label)
  }

  const renderMailboxCard = (
    kind: 'team' | 'private',
    entry: { objectId: string; label?: string },
    actions: React.ReactNode,
    opts?: { highlight?: boolean }
  ) => {
    const activeRow = isActive(kind, entry.objectId)
    const highlighted = opts?.highlight === true
    return (
      <li
        key={entry.objectId}
        className={`rounded-md border px-2 py-2 text-[11px] ${
          highlighted
            ? 'border-amber-500/60 bg-amber-500/15 ring-1 ring-amber-500/40'
            : activeRow
              ? 'border-emerald-500/45 bg-emerald-500/10'
              : 'border-border bg-background/40'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => (activeRow ? deactivateSendFocus() : activate(kind, entry.objectId))}
            className={`rounded px-2 py-0.5 text-[10px] font-medium ${
              activeRow ? 'bg-emerald-600 text-white' : 'border border-border hover:bg-accent'
            }`}
          >
            {activeRow ? '● Aktiv' : 'Aktiv setzen'}
          </button>
          <TypeBadge kind={kind} />
          <span className="font-medium text-foreground">{entry.label || (kind === 'team' ? 'Team-Mailbox' : 'Private Mailbox')}</span>
          <input
            type="text"
            defaultValue={entry.label ?? ''}
            placeholder="Label"
            onBlur={(e) => {
              if (kind === 'team') updateMyTeamMailboxLabel(entry.objectId, e.target.value)
              else updateMyPrivateMailboxLabel(entry.objectId, e.target.value)
              reload()
            }}
            className="min-w-[4rem] flex-1 rounded border border-border bg-input px-1.5 py-0.5 text-[10px]"
          />
        </div>
        <MailboxIdRow objectId={entry.objectId} copiedId={copiedId} onCopy={copyId} />
        <div className="mt-2 flex flex-wrap gap-2">{actions}</div>
      </li>
    )
  }

  const activeLabel =
    active.kind === 'team'
      ? `Team · ${maskMid(active.objectId)}`
      : active.kind === 'private'
        ? `Privat · ${maskMid(active.objectId)}`
        : 'Server-Shared (Standard)'

  return (
    <div className="space-y-3">
      <ChatViewSendPathOverview defaultOpen={false} />
      <p className="text-[10px] text-muted-foreground leading-snug">
        <strong className="text-foreground">Kanäle</strong> (1:1 / Gruppe / Pinnwand) wählst du im Chat-Kopf — unabhängig von den
        Mailboxen unten. <strong className="text-foreground">Server-Shared</strong> (.env) wird immer mitgelesen.{' '}
        <strong className="text-foreground">Team</strong> oder <strong className="text-foreground">Privat</strong>: höchstens eine
        davon <strong className="text-foreground">aktiv</strong> für Senden + zusätzlicher Posteingang-Fokus.
      </p>

      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Aktiv für Senden + Posteingang</p>
        <p className="mt-1 text-sm font-medium text-foreground">{activeLabel}</p>
        {active.kind !== 'none' ? (
          <button type="button" onClick={deactivateSendFocus} className="mt-2 rounded border border-border px-2 py-0.5 text-[10px] hover:bg-accent">
            Nur Server-Shared
          </button>
        ) : null}
      </div>

      <section className="rounded-lg border border-sky-500/35 bg-sky-500/8 px-3 py-2.5 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge kind="server" />
          <span className="text-[11px] font-semibold text-foreground">Server · Einsatz (Shared)</span>
          <span className="rounded bg-sky-600/25 px-1.5 py-0.5 text-[9px] font-semibold text-sky-950 dark:text-sky-100">
            Immer an
          </span>
        </div>
        {serverAvailable ? (
          <MailboxIdRow objectId={serverId} copiedId={copiedId} onCopy={copyId} />
        ) : (
          <p className="text-[10px] text-amber-800 dark:text-amber-200">MAILBOX_ID in Server-.env fehlt — nach create_globals setzen.</p>
        )}
        <p className="text-[10px] text-muted-foreground">Nur Setup/.env — nicht umschaltbar.</p>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[11px] font-semibold text-foreground">Team-Mailboxes</h4>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={joinTeam}
              className="inline-flex items-center gap-1 rounded-md border border-amber-500/45 bg-amber-500/10 px-2 py-1 text-[10px] font-medium hover:bg-amber-500/15"
            >
              <UserRoundPlus className="h-3 w-3" />
              Beitreten (ID/QR)
            </button>
            {p.teamMailboxCreateAllowed ? (
              <ChatViewTeamMailboxCreateButton
                walletValid={walletValid}
                onObjectId={(id) => {
                  reload()
                  setAssignMbId(id)
                  setHighlightTeamId(id)
                  window.setTimeout(() => setHighlightTeamId(''), 12_000)
                }}
                onStatus={p.onStatus}
              />
            ) : null}
          </div>
        </div>
        <p className="text-[10px] leading-snug text-muted-foreground">
          Neue Team-Mailbox erscheint <strong className="text-foreground">hier in der Liste</strong>, nicht als Zeile im
          Nachrichten-Posteingang. Posteingang zeigt erst Inhalte, wenn jemand an diese Mailbox sendet.{' '}
          <strong className="text-foreground">On-chain löschen</strong> gibt es für Shared-Team-Mailboxen nicht — nur{' '}
          <strong className="text-foreground">Entfernen (lokal)</strong>.
        </p>
        {teamList.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">
            {p.teamMailboxCreateAllowed
              ? 'Noch keine Team-Mailbox — erstellen oder ID eintragen.'
              : 'Noch keine Team-Mailbox — per ID/QR beitreten, wenn die Leitung eine teilt.'}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {teamList.map((entry) =>
              renderMailboxCard(
                'team',
                entry,
                (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Team-Mailbox „${entry.label || maskMid(entry.objectId)}“ aus der lokalen Liste entfernen?\n\nOn-chain bleibt das Shared-Postfach bestehen.`
                        )
                      ) {
                        return
                      }
                      archiveMyTeamMailbox(entry.objectId)
                      reload()
                      p.onStatus?.('Team-Mailbox lokal entfernt (on-chain unverändert).', 'success')
                    }}
                    className="inline-flex items-center gap-1 rounded border border-destructive/45 bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive hover:bg-destructive/15"
                  >
                    <Trash2 className="h-3 w-3" />
                    Entfernen (lokal)
                  </button>
                  <button
                    type="button"
                    disabled={!walletValid}
                    onClick={() => saveToOwnPhonebook(entry.objectId, 'team', entry.label)}
                    className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[10px] hover:bg-accent"
                  >
                    <UserPlus className="h-3 w-3" />
                    Ins Telefonbuch
                  </button>
                </>
              ),
                { highlight: highlightTeamId.toLowerCase() === entry.objectId.toLowerCase() }
              )
            )}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[11px] font-semibold text-foreground">Private Mailboxes</h4>
          <ChatViewPrivateMailboxCreateButton
            walletValid={walletValid}
            onObjectId={(id) => {
              reload()
              setAssignMbId(id)
            }}
            onStatus={p.onStatus}
          />
        </div>
        {privateList.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">Noch keine private Mailbox.</p>
        ) : (
          <ul className="space-y-1.5">
            {privateList.map((entry) =>
              renderMailboxCard('private', entry, (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      archiveMyPrivateMailbox(entry.objectId)
                      reload()
                      p.onStatus?.('In „Entfernt“.', 'success')
                    }}
                    className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[10px] hover:bg-accent"
                  >
                    <Trash2 className="h-3 w-3" />
                    Aus Liste
                  </button>
                  <button
                    type="button"
                    disabled={!walletValid}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Private Mailbox „${entry.label || maskMid(entry.objectId)}“ on-chain löschen?\n\nNachrichten und Handshakes werden entfernt.`
                        ) ||
                        !window.confirm('Letzte Bestätigung?')
                      ) {
                        return
                      }
                      setDeleteDialogId(entry.objectId)
                    }}
                    className="inline-flex items-center gap-1 rounded border border-destructive/45 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive"
                  >
                    On-chain löschen
                  </button>
                  <button
                    type="button"
                    disabled={!walletValid}
                    onClick={() => saveToOwnPhonebook(entry.objectId, 'private', entry.label)}
                    className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[10px] hover:bg-accent"
                  >
                    <UserPlus className="h-3 w-3" />
                    Ins Telefonbuch
                  </button>
                </>
              ))
            )}
          </ul>
        )}
      </section>

      {(teamArchived.length > 0 || privateArchived.length > 0) && (
        <div className="rounded-md border border-dashed border-border/80 px-2 py-2 text-[10px]">
          <p className="font-medium text-muted-foreground mb-1">Entfernt</p>
          {teamArchived.map((e) => (
            <div key={e.objectId} className="flex flex-wrap gap-2 py-0.5">
              <code>{maskMid(e.objectId)}</code>
              <button type="button" onClick={() => { restoreMyTeamMailbox(e.objectId); reload() }} className="underline">
                Team wiederherstellen
              </button>
            </div>
          ))}
          {privateArchived.map((e) => (
            <div key={e.objectId} className="flex flex-wrap gap-2 py-0.5">
              <code>{maskMid(e.objectId)}</code>
              <button type="button" onClick={() => { restoreMyPrivateMailbox(e.objectId); reload() }} className="underline">
                Privat wiederherstellen
              </button>
            </div>
          ))}
        </div>
      )}

      {(privateList.length > 0 || teamList.length > 0) && (
        <div className="rounded-md border border-border/70 bg-muted/15 px-2 py-2 space-y-1.5 text-[10px]">
          <p className="font-medium">Mailbox einem Kontakt zuordnen</p>
          <p className="text-muted-foreground">Mailbox wählen → Speichern öffnet die Telefonbuch-Zuordnung (bestehender oder neuer Kontakt).</p>
          <div className="flex flex-wrap gap-2">
            <select
              value={assignMbId}
              onChange={(e) => setAssignMbId(e.target.value)}
              className="min-w-[8rem] flex-1 rounded border border-border bg-input px-2 py-1"
            >
              <option value="">Mailbox…</option>
              {teamList.map((e) => (
                <option key={`t-${e.objectId}`} value={e.objectId}>
                  Team: {(e.label || maskMid(e.objectId)).slice(0, 36)}
                </option>
              ))}
              {privateList.map((e) => (
                <option key={`p-${e.objectId}`} value={e.objectId}>
                  Privat: {(e.label || maskMid(e.objectId)).slice(0, 36)}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!assignMbId.trim()}
              onClick={() => assignToContact()}
              className="rounded-md bg-primary px-2 py-1 font-medium text-primary-foreground disabled:opacity-50"
            >
              Zuordnen…
            </button>
          </div>
        </div>
      )}

      {phonebookAssign ? (
        <ContactMailboxPhonebookDialog
          open={Boolean(phonebookAssign)}
          onOpenChange={(open) => {
            if (!open) setPhonebookAssign(null)
          }}
          mailboxObjectId={phonebookAssign.objectId}
          mailboxKind={phonebookAssign.kind}
          mailboxLabel={phonebookAssign.label}
          directory={p.contactDirectory ?? {}}
          onSaved={() => {
            p.onContactsChanged?.()
            p.onStatus?.('Mailbox im Telefonbuch gespeichert.', 'success')
            setPhonebookAssign(null)
          }}
        />
      ) : null}

      {deleteDialogId ? (
        <ChatViewPrivateMailboxDeleteDialog
          open={Boolean(deleteDialogId)}
          onOpenChange={(open) => {
            if (!open) setDeleteDialogId(null)
          }}
          objectId={deleteDialogId}
          myAddress={full}
          walletValid={walletValid}
          onDone={() => {
            if (deleteDialogId) {
              forgetMyPrivateMailbox(deleteDialogId)
              if (assignMbId.toLowerCase() === deleteDialogId.toLowerCase()) setAssignMbId('')
              reload()
            }
            setDeleteDialogId(null)
          }}
          onStatus={p.onStatus}
        />
      ) : null}

      {profileQr() ? (
        <button
          type="button"
          onClick={() => {
            const raw = profileQr()
            if (!raw) return
            void navigator.clipboard.writeText(raw).then(() => {
              setQrCopied(true)
              setTimeout(() => setQrCopied(false), 2000)
            })
          }}
          className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
        >
          <QrCode className="h-3.5 w-3.5" />
          {qrCopied ? 'Profil-QR kopiert' : 'Profil-QR (aktive Mailbox)'}
        </button>
      ) : null}
    </div>
  )
}
