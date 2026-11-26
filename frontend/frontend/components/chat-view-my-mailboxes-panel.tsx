'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Check, Copy, QrCode, Trash2, UserRoundPlus } from 'lucide-react'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { fetchDeploymentMailboxId } from '@/frontend/lib/fetch-deployment-mailbox-id'
import { ChatViewPrivateMailboxDeleteDialog } from '@/frontend/components/chat-view-private-mailbox-delete-dialog'
import { ChatViewPrivateMailboxCreateButton } from '@/frontend/components/chat-view-private-mailbox-create-button'
import { ChatViewTeamMailboxCreateButton } from '@/frontend/components/chat-view-team-mailbox-create-button'
import {
  TeamMailboxJoinDialog,
  TeamMailboxShareQrDialog,
} from '@/frontend/components/team-mailbox-qr-dialog'
import { ProfileContactQrDialog } from '@/frontend/components/profile-contact-qr-dialog'
import {
  MessengerHandbookChatLink,
  MESSENGER_HB_ANCHOR_KANALE_MAILBOXEN,
} from '@/components/messenger-handbook-link'
import { clearActiveSendMailbox, readActiveSendMailbox } from '@/frontend/lib/my-mailbox-active'
import {
  archiveMyPrivateMailbox,
  backfillPrivateMailboxLabels,
  forgetMyPrivateMailbox,
  readArchivedMyPrivateMailboxes,
  readMyPrivateMailboxes,
  restoreMyPrivateMailbox,
  updateMyPrivateMailboxLabel,
  type MyPrivateMailboxEntry,
} from '@/frontend/lib/my-private-mailbox-store'
import { syncOwnMailboxesFromPhonebook } from '@/frontend/lib/sync-own-mailboxes-from-phonebook'
import {
  archiveMyTeamMailbox,
  backfillTeamMailboxLabels,
  joinMyTeamMailbox,
  readArchivedMyTeamMailboxes,
  readMyTeamMailboxes,
  restoreMyTeamMailbox,
  updateMyTeamMailboxLabel,
  type MyTeamMailboxEntry,
} from '@/frontend/lib/my-team-mailbox-store'
import {
  mainMailboxExplain,
  mainMailboxSubtitle,
  mainMailboxTitle,
  privateMailboxesExplain,
  teamMailboxesExplain,
} from '@/frontend/lib/mailbox-clarity-copy'

function maskMid(id: string): string {
  const t = id.trim()
  if (t.length < 20) return t
  return `${t.slice(0, 10)}…${t.slice(-8)}`
}

function TypeBadge(p: { kind: 'server' | 'team' | 'private' }) {
  const cls =
    p.kind === 'server'
      ? 'bg-[color-mix(in_oklab,var(--path-online)_22%,transparent)] text-foreground'
      : p.kind === 'team'
        ? 'bg-[color-mix(in_oklab,var(--path-telegram)_22%,transparent)] text-foreground'
        : 'bg-[color-mix(in_oklab,var(--path-mesh)_22%,transparent)] text-foreground'
  const label = p.kind === 'server' ? 'Haupt' : p.kind === 'team' ? 'Team' : 'Privat'
  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${cls}`}>{label}</span>
  )
}

function MailboxIdRow(p: { objectId: string; copiedId: string | null; onCopy: (id: string) => void }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <code className="font-mono text-[10px]" title={p.objectId}>
        {maskMid(p.objectId)}
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
  /** Live-Telefonbuch — gleicht Composer-Slots („Ich“) mit Besitz-Liste ab. */
  contactDirectory?: Record<string, ContactMeshEntryClient>
  onStatus?: (msg: string, kind: 'success' | 'error') => void
  onMailboxActivated?: () => void
  /** false = Team-Mailbox erstellen ausblenden (Citizen / Arbeiter). Default: ausgeblendet. */
  teamMailboxCreateAllowed?: boolean
  /** Nach Team-Beitritt: Config/Status neu (Abfrage-Liste). */
  onReload?: () => void
}

export function ChatViewMyMailboxesPanel(p: ChatViewMyMailboxesPanelProps) {
  const full = (p.myAddressLine || '').trim()
  const walletValid = /^0x[a-fA-F0-9]{64}$/i.test(full)

  const [serverId, setServerId] = useState((p.serverMailboxIdHint ?? '').trim())
  const [privateList, setPrivateList] = useState<MyPrivateMailboxEntry[]>([])
  const [teamList, setTeamList] = useState<MyTeamMailboxEntry[]>([])
  const [privateArchived, setPrivateArchived] = useState<MyPrivateMailboxEntry[]>([])
  const [teamArchived, setTeamArchived] = useState<MyTeamMailboxEntry[]>([])
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [highlightTeamId, setHighlightTeamId] = useState('')
  const [joinTeamOpen, setJoinTeamOpen] = useState(false)
  const [shareTeamQr, setShareTeamQr] = useState<{ objectId: string; label?: string } | null>(null)
  const [profileQrOpen, setProfileQrOpen] = useState(false)

  const reload = useCallback(() => {
    if (walletValid) syncOwnMailboxesFromPhonebook(full, p.contactDirectory)
    backfillPrivateMailboxLabels()
    backfillTeamMailboxLabels()
    setPrivateList(readMyPrivateMailboxes())
    setTeamList(readMyTeamMailboxes())
    setPrivateArchived(readArchivedMyPrivateMailboxes())
    setTeamArchived(readArchivedMyTeamMailboxes())
  }, [full, walletValid, p.contactDirectory])

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

  /** Altes Settings-„Sendeziel/Fokus“ abschalten — Ziel wählt der Composer; Lesen = Union. */
  useEffect(() => {
    if (readActiveSendMailbox().kind === 'none') return
    clearActiveSendMailbox()
  }, [])

  const serverAvailable = /^0x[a-fA-F0-9]{64}$/i.test(serverId)

  const copyId = (id: string) => {
    void navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const handleTeamJoined = (raw: string, label?: string) => {
    joinMyTeamMailbox(raw, label)
    reload()
    p.onStatus?.(`Team-Mailbox ${maskMid(raw)} beigetreten.`, 'success')
    p.onMailboxActivated?.()
    void import('@/frontend/lib/team-mailbox-server-sync').then(({ mergeTeamMailboxIdOnServer }) =>
      mergeTeamMailboxIdOnServer(raw, {
        privateServerMailboxId: p.serverMailboxIdHint,
      }).then((r) => {
        if (r.ok) p.onReload?.()
      })
    )
  }

  const renderMailboxCard = (
    kind: 'team' | 'private',
    entry: { objectId: string; label?: string },
    actions: ReactNode,
    opts?: { highlight?: boolean }
  ) => {
    const highlighted = opts?.highlight === true
    return (
      <li
        key={entry.objectId}
        className={`rounded-md border px-2 py-2 text-[11px] ${
          highlighted
            ? 'border-amber-500/60 bg-amber-500/15 ring-1 ring-amber-500/40'
            : 'border-border bg-background/40'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge kind={kind} />
          <input
            type="text"
            defaultValue={entry.label ?? ''}
            placeholder={kind === 'team' ? 'Name der Team-Mailbox' : 'Name deiner privaten Mailbox'}
            aria-label="Anzeigename"
            onBlur={(e) => {
              if (kind === 'team') updateMyTeamMailboxLabel(entry.objectId, e.target.value)
              else updateMyPrivateMailboxLabel(entry.objectId, e.target.value)
              reload()
            }}
            className="min-w-[6rem] flex-1 rounded border border-border bg-input px-1.5 py-0.5 text-[11px] font-medium"
          />
        </div>
        <MailboxIdRow objectId={entry.objectId} copiedId={copiedId} onCopy={copyId} />
        <div className="mt-2 flex flex-wrap gap-2">{actions}</div>
      </li>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-muted-foreground">
        <MessengerHandbookChatLink anchor={MESSENGER_HB_ANCHOR_KANALE_MAILBOXEN} className="text-[10px]" />
      </p>

      <section className="space-y-1 rounded-lg border border-sky-500/35 bg-sky-500/8 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge kind="server" />
          <span className="text-[11px] font-semibold text-foreground">{mainMailboxTitle()}</span>
          <span className="rounded bg-sky-600/25 px-1.5 py-0.5 text-[9px] font-semibold text-sky-950 dark:text-sky-100">
            {mainMailboxSubtitle()}
          </span>
        </div>
        {serverAvailable ? (
          <MailboxIdRow objectId={serverId} copiedId={copiedId} onCopy={copyId} />
        ) : (
          <p className="text-[10px] text-amber-800 dark:text-amber-200">
            Hauptpostfach-ID noch nicht konfiguriert (Setup / MAILBOX_ID).
          </p>
        )}
        {mainMailboxExplain() ? (
          <p className="text-[10px] text-muted-foreground">{mainMailboxExplain()}</p>
        ) : null}
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[11px] font-semibold text-foreground">Team-Mailboxen</h4>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setJoinTeamOpen(true)}
              className="inline-flex items-center gap-1 rounded-md border border-amber-500/45 bg-amber-500/10 px-2 py-1 text-[10px] font-medium hover:bg-amber-500/15"
            >
              <UserRoundPlus className="h-3 w-3" />
              Beitreten (ID/QR)
            </button>
            {p.teamMailboxCreateAllowed ? (
              <ChatViewTeamMailboxCreateButton
                walletValid={walletValid}
                privateServerMailboxId={p.serverMailboxIdHint}
                onObjectId={(id) => {
                  reload()
                  setHighlightTeamId(id)
                  window.setTimeout(() => setHighlightTeamId(''), 12_000)
                }}
                onStatus={p.onStatus}
              />
            ) : null}
          </div>
        </div>
        {teamMailboxesExplain(Boolean(p.teamMailboxCreateAllowed)) ? (
          <p className="text-[10px] leading-snug text-muted-foreground">
            {teamMailboxesExplain(Boolean(p.teamMailboxCreateAllowed))}
          </p>
        ) : null}
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
                      Aus Liste
                    </button>
                    <button
                      type="button"
                      onClick={() => setShareTeamQr({ objectId: entry.objectId, label: entry.label })}
                      className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[10px] hover:bg-accent"
                    >
                      <QrCode className="h-3 w-3" />
                      QR teilen
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
          <h4 className="text-[11px] font-semibold text-foreground">Private Mailboxen</h4>
          <ChatViewPrivateMailboxCreateButton
            walletValid={walletValid}
            onObjectId={() => {
              reload()
            }}
            onStatus={p.onStatus}
          />
        </div>
        {privateMailboxesExplain() ? (
          <p className="text-[10px] leading-snug text-muted-foreground">{privateMailboxesExplain()}</p>
        ) : null}
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
                </>
              ))
            )}
          </ul>
        )}
        <p className="text-[10px] text-muted-foreground">
          Postfach-ID einem Kontakt zuordnen: im <strong className="text-foreground">Telefonbuch</strong> → Kontakt
          bearbeiten → Erweitert · Postfach-ID (optional).
        </p>
      </section>

      {(teamArchived.length > 0 || privateArchived.length > 0) && (
        <div className="rounded-md border border-dashed border-border/80 px-2 py-2 text-[10px]">
          <p className="mb-1 font-medium text-muted-foreground">Entfernt</p>
          {teamArchived.map((e) => (
            <div key={e.objectId} className="flex flex-wrap gap-2 py-0.5">
              <code>{maskMid(e.objectId)}</code>
              <button
                type="button"
                onClick={() => {
                  restoreMyTeamMailbox(e.objectId)
                  reload()
                }}
                className="underline"
              >
                Team wiederherstellen
              </button>
            </div>
          ))}
          {privateArchived.map((e) => (
            <div key={e.objectId} className="flex flex-wrap gap-2 py-0.5">
              <code>{maskMid(e.objectId)}</code>
              <button
                type="button"
                onClick={() => {
                  restoreMyPrivateMailbox(e.objectId)
                  reload()
                }}
                className="underline"
              >
                Privat wiederherstellen
              </button>
            </div>
          ))}
        </div>
      )}

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
              reload()
            }
            setDeleteDialogId(null)
          }}
          onStatus={p.onStatus}
        />
      ) : null}

      <TeamMailboxJoinDialog
        open={joinTeamOpen}
        onOpenChange={setJoinTeamOpen}
        onJoined={handleTeamJoined}
        onStatus={(msg, tone) => p.onStatus?.(msg, tone === 'error' ? 'error' : 'success')}
      />

      {shareTeamQr ? (
        <TeamMailboxShareQrDialog
          open={Boolean(shareTeamQr)}
          onOpenChange={(open) => {
            if (!open) setShareTeamQr(null)
          }}
          objectId={shareTeamQr.objectId}
          label={shareTeamQr.label}
        />
      ) : null}

      {walletValid ? (
        <div className="border-t border-border/50 pt-3">
          <button
            type="button"
            onClick={() => setProfileQrOpen(true)}
            className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
          >
            <QrCode className="h-3.5 w-3.5" />
            Mein Kontakt-QR
          </button>
          <ProfileContactQrDialog
            open={profileQrOpen}
            onOpenChange={setProfileQrOpen}
            address={full}
            privateMailboxes={privateList}
            teamMailboxes={teamList}
          />
        </div>
      ) : null}
    </div>
  )
}
