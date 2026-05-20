'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Loader2, QrCode, RotateCcw, Trash2, UserPlus } from 'lucide-react'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { saveContactEntry } from '@/frontend/lib/api'
import { buildContactQrPayload } from '@/frontend/lib/contact-qr'
import { findContactAddressByMailboxObjectId } from '@/frontend/lib/contact-mailbox-routing'
import { fetchDeploymentMailboxId } from '@/frontend/lib/fetch-deployment-mailbox-id'
import { ChatViewPrivateMailboxDeleteDialog } from '@/frontend/components/chat-view-private-mailbox-delete-dialog'
import {
  addMyPrivateMailbox,
  archiveMyPrivateMailbox,
  forgetMyPrivateMailbox,
  readActiveMailboxSelection,
  readArchivedMyPrivateMailboxes,
  readMyPrivateMailboxes,
  restoreMyPrivateMailbox,
  setActivePrivateMailboxObjectId,
  setActiveServerMailbox,
  updateMyPrivateMailboxLabel,
  type MyPrivateMailboxEntry,
} from '@/frontend/lib/my-private-mailbox-store'
import { ChatViewPrivateMailboxCreateButton } from '@/frontend/components/chat-view-private-mailbox-create-button'

function maskMid(id: string): string {
  const t = id.trim()
  if (t.length < 20) return t
  return `${t.slice(0, 10)}…${t.slice(-8)}`
}

function TypeBadge(p: { kind: 'shared' | 'private' }) {
  return (
    <span
      className={
        p.kind === 'shared'
          ? 'rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-sky-500/20 text-sky-900 dark:text-sky-100'
          : 'rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-violet-500/20 text-violet-950 dark:text-violet-100'
      }
    >
      {p.kind === 'shared' ? 'Shared' : 'Privat'}
    </span>
  )
}

type MailboxRow =
  | { kind: 'server'; objectId: string }
  | { kind: 'private'; entry: MyPrivateMailboxEntry }

export type ChatViewMyMailboxesPanelProps = {
  myAddressLine: string
  /** Optional: aus Status; Panel lädt sonst /api/current-ids */
  serverMailboxIdHint?: string
  contactDirectory?: Record<string, ContactMeshEntryClient>
  onContactsChanged?: () => void
  /** Telefonbuch: „Neuer Kontakt“ mit vorausgefüllter Mailbox-ID */
  onOpenCreateContact?: (mailboxObjectId: string) => void
  /** Wallet-0x des Kontakts ins Sende-Composer übernehmen (Empfänger — nicht die Mailbox-Object-ID). */
  onApplySendRecipient?: (walletAddress: string) => void
  onStatus?: (msg: string, kind: 'success' | 'error') => void
}

export function ChatViewMyMailboxesPanel(p: ChatViewMyMailboxesPanelProps) {
  const full = (p.myAddressLine || '').trim()
  const walletValid = /^0x[a-fA-F0-9]{64}$/i.test(full)

  const [serverId, setServerId] = useState((p.serverMailboxIdHint ?? '').trim())
  const [list, setList] = useState<MyPrivateMailboxEntry[]>([])
  const [archived, setArchived] = useState<MyPrivateMailboxEntry[]>([])
  const [selection, setSelection] = useState(readActiveMailboxSelection())
  const [qrCopied, setQrCopied] = useState(false)
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [assignMbId, setAssignMbId] = useState('')
  const [assignContact, setAssignContact] = useState('')
  const [assignBusy, setAssignBusy] = useState(false)

  const reload = useCallback(() => {
    setList(readMyPrivateMailboxes())
    setArchived(readArchivedMyPrivateMailboxes())
    setSelection(readActiveMailboxSelection())
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

  const activeObjectId =
    selection.kind === 'server' && serverAvailable
      ? serverId
      : selection.kind === 'private'
        ? selection.objectId
        : ''

  const rows: MailboxRow[] = []
  rows.push({ kind: 'server', objectId: serverAvailable ? serverId : '' })
  for (const entry of list) rows.push({ kind: 'private', entry })

  const contactOptions = Object.entries(p.contactDirectory ?? {})
    .map(([addr, entry]) => ({
      addr: addr.trim(),
      label: (entry.label || '').trim() || maskMid(addr),
    }))
    .filter((c) => c.addr.length > 0)
    .sort((a, b) => a.label.localeCompare(b.label, 'de'))

  const isRowActive = (row: MailboxRow): boolean => {
    if (row.kind === 'server') return selection.kind === 'server' && serverAvailable
    return selection.kind === 'private' && selection.objectId.toLowerCase() === row.entry.objectId.toLowerCase()
  }

  const profileQr = useCallback(() => {
    if (!walletValid) return ''
    try {
      return buildContactQrPayload({
        address: full,
        mailboxObjectId: selection.kind === 'private' ? selection.objectId : undefined,
      })
    } catch {
      return ''
    }
  }, [full, selection, walletValid])

  const copyId = (id: string) => {
    if (!id) return
    void navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const copyQr = () => {
    const raw = profileQr()
    if (!raw) return
    void navigator.clipboard.writeText(raw).then(() => {
      setQrCopied(true)
      setTimeout(() => setQrCopied(false), 2000)
    })
  }

  const activateRow = (row: MailboxRow) => {
    if (row.kind === 'server') {
      if (!serverAvailable) {
        p.onStatus?.('MAILBOX_ID in Server-.env fehlt — nach create_globals eintragen und API neu starten.', 'error')
        return
      }
      setActiveServerMailbox()
    } else {
      setActivePrivateMailboxObjectId(row.entry.objectId)
    }
    reload()
    p.onStatus?.(
      row.kind === 'server'
        ? 'Aktiv: Morgendrot Shared-Mailbox (Einsatz).'
        : `Aktiv: private Mailbox ${maskMid(row.entry.objectId)}`,
      'success'
    )
  }

  const applySendRecipient = (walletAddress: string) => {
    const addr = walletAddress.trim().toLowerCase()
    if (!/^0x[a-fA-F0-9]{64}$/i.test(addr)) {
      p.onStatus?.('Gültige Kontakt-Wallet (0x + 64 Hex) nötig — nicht die Mailbox-Object-ID.', 'error')
      return
    }
    p.onApplySendRecipient?.(addr)
    p.onStatus?.(`Empfänger ${maskMid(addr)} im Composer übernommen.`, 'success')
  }

  const syncAssignContactFromMailbox = (mailboxObjectId: string) => {
    const dir = p.contactDirectory ?? {}
    const found = findContactAddressByMailboxObjectId(dir, mailboxObjectId)
    if (found) setAssignContact(found)
  }

  const assignToContact = async () => {
    const addr = assignContact.trim()
    const mb = assignMbId.trim()
    if (!addr || !/^0x[a-fA-F0-9]{64}$/i.test(mb)) {
      p.onStatus?.('Kontakt und Mailbox-ID wählen.', 'error')
      return
    }
    setAssignBusy(true)
    try {
      const r = await saveContactEntry({ address: addr, mailboxObjectId: mb })
      if (!r.ok) {
        p.onStatus?.(r.error || 'Speichern fehlgeschlagen.', 'error')
        return
      }
      p.onContactsChanged?.()
      p.onApplySendRecipient?.(addr.trim().toLowerCase())
      p.onStatus?.(`Mailbox ${maskMid(mb)} zugeordnet — Empfänger ${maskMid(addr)} im Composer.`, 'success')
    } finally {
      setAssignBusy(false)
    }
  }

  const saveToOwnPhonebook = async (mailboxObjectId: string) => {
    if (!walletValid) return
    setAssignBusy(true)
    try {
      const r = await saveContactEntry({
        address: full,
        label: 'Ich (Profil)',
        mailboxObjectId: mailboxObjectId.trim(),
      })
      if (!r.ok) {
        p.onStatus?.(r.error || 'Profil-Kontakt fehlgeschlagen.', 'error')
        return
      }
      p.onContactsChanged?.()
      p.onStatus?.('Private Mailbox in Telefonbuch unter deiner Adresse gespeichert.', 'success')
    } finally {
      setAssignBusy(false)
    }
  }

  const onMailboxDeleted = (objectId: string) => {
    forgetMyPrivateMailbox(objectId)
    if (assignMbId.toLowerCase() === objectId.toLowerCase()) setAssignMbId('')
    reload()
  }

  const qr = profileQr()

  return (
    <div className="space-y-2">
      {activeObjectId ? (
        <div className="rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Aktiv</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <TypeBadge kind={selection.kind === 'server' ? 'shared' : 'private'} />
            <span className="text-[11px] font-medium text-foreground">
              {selection.kind === 'server' ? 'Morgendrot · Einsatz (Shared)' : 'Eigene private Mailbox'}
            </span>
            <code className="font-mono text-[10px] break-all text-foreground" title={activeObjectId}>
              {activeObjectId}
            </code>
            <button
              type="button"
              onClick={() => copyId(activeObjectId)}
              className="inline-flex items-center gap-0.5 rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-accent"
            >
              {copiedId === activeObjectId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        </div>
      ) : null}

      <ul className="space-y-1.5">
        {rows.map((row) => {
          const active = isRowActive(row)
          const objectId = row.kind === 'server' ? row.objectId : row.entry.objectId
          const isServer = row.kind === 'server'
          const title = isServer ? 'Morgendrot · Einsatz (Shared)' : row.entry.label || 'Private Mailbox'

          return (
            <li
              key={isServer ? 'server' : row.entry.objectId}
              className={`rounded-md border px-2 py-2 text-[11px] ${
                active ? 'border-emerald-500/45 bg-emerald-500/10' : 'border-border bg-background/40'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isServer && !serverAvailable}
                  onClick={() => activateRow(row)}
                  className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                    active ? 'bg-emerald-600 text-white' : 'border border-border hover:bg-accent'
                  } disabled:opacity-50`}
                >
                  {active ? '● Aktiv' : 'Aktiv setzen'}
                </button>
                <TypeBadge kind={isServer ? 'shared' : 'private'} />
                <span className="font-medium text-foreground">{title}</span>
                {!isServer ? (
                  <input
                    type="text"
                    defaultValue={row.entry.label ?? ''}
                    placeholder="Label"
                    onBlur={(e) => {
                      updateMyPrivateMailboxLabel(row.entry.objectId, e.target.value)
                      reload()
                    }}
                    className="min-w-[4rem] flex-1 rounded border border-border bg-input px-1.5 py-0.5 text-[10px]"
                  />
                ) : null}
              </div>
              {isServer && !serverAvailable ? (
                <p className="mt-1 text-[10px] text-amber-800 dark:text-amber-200">
                  Keine gültige MAILBOX_ID vom Server — in .env nach create_globals setzen, API neu starten. (Nicht PACKAGE_ID.)
                </p>
              ) : objectId ? (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <code className="font-mono text-[10px] break-all" title={objectId}>
                    {objectId}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyId(objectId)}
                    className="rounded border border-border px-1 py-0.5 text-[10px] hover:bg-accent"
                  >
                    Kopieren
                  </button>
                </div>
              ) : null}
              {!isServer ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    title="Nur aus dieser Liste — on-chain bleibt"
                    onClick={() => {
                      archiveMyPrivateMailbox(row.entry.objectId)
                      reload()
                      p.onStatus?.('In „Entfernt“ — Wiederherstellen möglich.', 'success')
                    }}
                    className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[10px] hover:bg-accent"
                  >
                    <Trash2 className="h-3 w-3" />
                    Aus Liste
                  </button>
                  <button
                    type="button"
                    disabled={!walletValid}
                    onClick={() => setDeleteDialogId(row.entry.objectId)}
                    className="inline-flex items-center gap-1 rounded border border-destructive/45 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive hover:bg-destructive/15 disabled:opacity-50"
                  >
                    Private Mailbox löschen
                  </button>
                  <button
                    type="button"
                    disabled={assignBusy || !walletValid}
                    onClick={() => void saveToOwnPhonebook(row.entry.objectId)}
                    className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[10px] hover:bg-accent"
                  >
                    <UserPlus className="h-3 w-3" />
                    Ins Telefonbuch (Ich)
                  </button>
                  {p.onOpenCreateContact ? (
                    <button
                      type="button"
                      onClick={() => p.onOpenCreateContact?.(row.entry.objectId)}
                      className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium hover:bg-primary/15"
                    >
                      <UserPlus className="h-3 w-3" />
                      Neuer Kontakt
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      {archived.length > 0 ? (
        <div className="rounded-md border border-dashed border-border/80 px-2 py-2">
          <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Entfernt ({archived.length})</p>
          <ul className="space-y-1">
            {archived.map((e) => (
              <li key={e.objectId} className="flex flex-wrap items-center gap-2 text-[10px]">
                <code className="font-mono" title={e.objectId}>
                  {maskMid(e.objectId)}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    restoreMyPrivateMailbox(e.objectId)
                    reload()
                    p.onStatus?.('Wiederhergestellt.', 'success')
                  }}
                  className="inline-flex items-center gap-0.5 rounded border border-border px-1.5 py-0.5 hover:bg-accent"
                >
                  <RotateCcw className="h-3 w-3" />
                  Wiederherstellen
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {list.length > 0 ? (
        <div className="rounded-md border border-border/70 bg-muted/15 px-2 py-2 space-y-1.5">
          <p className="text-[10px] font-medium text-foreground">Mailbox einem Kontakt zuordnen</p>
          {contactOptions.length === 0 ? (
            <p className="text-[10px] text-muted-foreground">
              Noch kein Kontakt — oben „Neuer Kontakt“ im Telefonbuch oder „Neuer Kontakt“ an der Mailbox.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <select
              value={assignMbId}
              onChange={(e) => setAssignMbId(e.target.value)}
              className="min-w-[8rem] flex-1 rounded border border-border bg-input px-2 py-1 text-[10px]"
            >
              <option value="">Private Mailbox…</option>
              {list.map((e) => (
                <option key={e.objectId} value={e.objectId}>
                  {(e.label || maskMid(e.objectId)).slice(0, 40)}
                </option>
              ))}
            </select>
            <select
              value={assignContact}
              onChange={(e) => setAssignContact(e.target.value)}
              disabled={contactOptions.length === 0}
              className="min-w-[8rem] flex-1 rounded border border-border bg-input px-2 py-1 text-[10px] disabled:opacity-50"
            >
              <option value="">Kontakt…</option>
              {contactOptions.map((c) => (
                <option key={c.addr} value={c.addr}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={assignBusy || contactOptions.length === 0}
              onClick={() => void assignToContact()}
              className="rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground disabled:opacity-50"
            >
              Speichern + Empfänger
            </button>
            <button
              type="button"
              disabled={!/^0x[a-fA-F0-9]{64}$/i.test(assignContact.trim())}
              onClick={() => applySendRecipient(assignContact)}
              className="rounded-md border border-border px-2 py-1 text-[10px] font-medium hover:bg-accent disabled:opacity-50"
              title="Nur die Wallet des Kontakts ins Sendefeld — die Mailbox-Object-ID kommt aus dem Telefonbuch"
            >
              Als Empfänger
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Private Mailbox wählen → wenn im Telefonbuch genau ein Kontakt diese ID hat, wird er vorausgewählt.
            Senden geht an die <strong className="text-foreground">Wallet 0x</strong>; die Object-ID ist das Ziel-Postfach
            (pro Kontakt derzeit <strong className="text-foreground">eine</strong> ID — mehrere Mailboxen = Roadmap).
          </p>
        </div>
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
            if (deleteDialogId) onMailboxDeleted(deleteDialogId)
            setDeleteDialogId(null)
          }}
          onStatus={p.onStatus}
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        <ChatViewPrivateMailboxCreateButton
          walletValid={walletValid}
          onObjectId={(id, meta) => {
            addMyPrivateMailbox({
              objectId: id,
              ...(meta?.digest ? { digest: meta.digest } : {}),
              createdAtMs: Date.now(),
            })
            reload()
            setAssignMbId(id)
            p.onStatus?.(`Erstellt: ${maskMid(id)} — „Ins Telefonbuch (Ich)“ oder Kontakt zuordnen.`, 'success')
          }}
        />
        {qr ? (
          <button
            type="button"
            onClick={copyQr}
            className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
          >
            <QrCode className="h-3.5 w-3.5" />
            {qrCopied ? 'QR kopiert' : 'Profil-QR'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
