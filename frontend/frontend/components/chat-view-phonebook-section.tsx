'use client'

/**
 * Telefonbuch — Kartenliste, Filter, Favoriten, Modal für Anlegen/Bearbeiten.
 */

import { useCallback, useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { PhonebookMeshBackupPanel } from '@/frontend/components/phonebook-mesh-backup-panel'
import { PhonebookContactDistributePanel } from '@/frontend/components/phonebook-contact-distribute-panel'
import type { ContactMeshEntryClient, ApiStatus } from '@/frontend/lib/api'
import { saveContactEntry } from '@/frontend/lib/api'
import { contactDisplayLabel, lookupContactEntry } from '@/frontend/lib/contact-display'
import { ContactPhonebookCard } from '@/frontend/components/contact-phonebook-card'
import {
  ContactPhonebookContactDialog,
  type ContactPhonebookFormValues,
} from '@/frontend/components/contact-phonebook-contact-dialog'
import { ContactPhonebookQrDialog } from '@/frontend/components/contact-phonebook-qr-dialog'
import { TelegramAlarmGroupPhonebookBanner } from '@/frontend/components/telegram-alarm-group-phonebook-banner'
import {
  formatContactRoleTagsCsv,
  maskWalletAddress,
  parseContactRoleTagsCsv,
  PHONEBOOK_FILTER_LABELS,
  type PhonebookFilterId,
} from '@/frontend/lib/contact-phonebook-format'
import { formatContactDirectoryKey, resolveContactStorageKey } from '@/frontend/lib/contact-storage-key'
import { contactHasAnyMailboxSlot, slotsToSavePayload } from '@/frontend/lib/contact-mailbox-slots'
import {
  hideContactFromPhonebook,
  readContactFavorites,
  readContactLastContacted,
  readContactNotes,
  readHiddenContacts,
  recordContactLastContacted,
  toggleContactFavorite,
  writeContactNote,
} from '@/frontend/lib/contact-phonebook-meta-store'
import {
  canManageTeamRoster,
  contactToTeamMember,
  formatTeamWireDeliveryChannels,
  removeTeamMemberFromRoster,
} from '@/frontend/lib/team-roster-wire'
import { isTeamMemberRemoveSent, markTeamMemberRemoveSent } from '@/frontend/lib/team-removed-members-store'
import { cn } from '@/lib/utils'

export type ChatViewPhonebookSectionProps = {
  directory: Record<string, ContactMeshEntryClient>
  refreshContactDirectory: () => void
  setStatusMsg: (msg: string) => void
  myAddressLine?: string
  serverMailboxId?: string
  connectedAddresses?: string[]
  /** Kontakt ins Composer ├╝bernehmen und Telefonbuch schlie├ƒen (Caller). */
  onSelectContact?: (storageKey: string, entry: ContactMeshEntryClient) => void
  /** Im Sheet: kein eigener Seitentitel (steht in SheetHeader). */
  embedded?: boolean
  teamMailboxCreateAllowed?: boolean
  /** Boss/Kommandant: initialProfile-JSON ins Telefonbuch. */
  allowInitialProfileImport?: boolean
  /** Boss/Kommandant: Team-Telefonbuch „Aus Team entfernen“. */
  apiStatus?: ApiStatus | null
  /** Mailbox-Verwaltung liegt unter Einstellungen. */
  onOpenSettings?: () => void
}

type ContactRow = {
  address: string
  entry: ContactMeshEntryClient
  displayName: string
}

export function ChatViewPhonebookSection(p: ChatViewPhonebookSectionProps) {
  const {
    directory,
    refreshContactDirectory,
    setStatusMsg,
    connectedAddresses = [],
    onSelectContact,
    embedded = false,
  } = p

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<PhonebookFilterId>('all')
  const [metaTick, setMetaTick] = useState(0)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<{
    mode: 'create' | 'edit'
    initial?: Partial<ContactPhonebookFormValues>
    editStorageKey?: string
  } | null>(null)
  const [qrAddress, setQrAddress] = useState<string | null>(null)
  const [teamRemoveTick, setTeamRemoveTick] = useState(0)

  const connectedSet = useMemo(
    () => new Set(connectedAddresses.map((a) => a.trim().toLowerCase()).filter(Boolean)),
    [connectedAddresses]
  )

  const favorites = useMemo(() => readContactFavorites(), [metaTick])
  const lastContact = useMemo(() => readContactLastContacted(), [metaTick])
  const hidden = useMemo(() => readHiddenContacts(), [metaTick])

  const bumpMeta = () => setMetaTick((n) => n + 1)

  const visibleDirectoryCount = useMemo(() => {
    let n = 0
    for (const addr of Object.keys(directory)) {
      const a = addr.trim().toLowerCase()
      if (a && !hidden.has(a)) n++
    }
    return n
  }, [directory, hidden])

  const rows: ContactRow[] = useMemo(() => {
    const q = search.trim().toLowerCase()
    const out: ContactRow[] = []
    for (const [addr, entry] of Object.entries(directory)) {
      const a = addr.trim().toLowerCase()
      if (hidden.has(a)) continue
      const displayName =
        contactDisplayLabel(directory, addr) ||
        (addr.startsWith('tg:') ? formatContactDirectoryKey(addr) : maskWalletAddress(addr, 8, 6))
      if (q) {
        const hay = `${displayName} ${addr} ${entry.meshNodeId ?? ''} ${entry.mailboxObjectId ?? ''} ${entry.mailboxSharedId ?? ''} ${entry.mailboxPrivateId ?? ''} ${entry.mailboxTeamId ?? ''} ${entry.mailboxBufferId ?? ''}`.toLowerCase()
        if (!hay.includes(q)) continue
      }
      const hasLora = Boolean(entry.meshNodeId?.trim())
      const isOnline = connectedSet.has(a)
      const hasMb = contactHasAnyMailboxSlot(entry)
      if (filter === 'lora' && !hasLora) continue
      if (filter === 'online' && !isOnline) continue
      if (filter === 'mailbox' && !hasMb) continue
      if (filter === 'recent' && !lastContact[a]) continue
      out.push({ address: a, entry, displayName })
    }
    out.sort((x, y) => {
      const xf = favorites.has(x.address) ? 1 : 0
      const yf = favorites.has(y.address) ? 1 : 0
      if (xf !== yf) return yf - xf
      const xl = x.entry.meshNodeId?.trim() ? 1 : 0
      const yl = y.entry.meshNodeId?.trim() ? 1 : 0
      if (xl !== yl) return yl - xl
      const xt = lastContact[x.address] ?? 0
      const yt = lastContact[y.address] ?? 0
      if (xt !== yt) return yt - xt
      return x.displayName.localeCompare(y.displayName, 'de')
    })
    return out
  }, [directory, search, filter, favorites, lastContact, hidden, connectedSet])

  const favoriteRows = useMemo(() => rows.filter((r) => favorites.has(r.address)), [rows, favorites])
  const listRows = useMemo(
    () => (favoriteRows.length > 0 ? rows.filter((r) => !favorites.has(r.address)) : rows),
    [rows, favoriteRows]
  )

  const persistContact = useCallback(
    async (values: ContactPhonebookFormValues) => {
      const storageKey = resolveContactStorageKey(values.address, values.telegramChatId)
      if (!storageKey) {
        const msg = 'IOTA-Adresse (0x + 64 Hex) oder Telegram Chat-ID nötig.'
        setStatusMsg(msg)
        toast.error(msg)
        return
      }
      const previousKey = (dialog?.editStorageKey ?? '').trim().toLowerCase()
      setBusy(true)
      try {
        const roleTags = parseContactRoleTagsCsv(values.roleTagsCsv)
        const r = await saveContactEntry({
          address: storageKey,
          label: values.label.trim() || undefined,
          meshNodeId: values.meshNodeId.trim() || undefined,
          mailboxSharedId: values.mailboxSharedId.trim(),
          mailboxPrivateId: values.mailboxPrivateId.trim(),
          mailboxTeamId: values.mailboxTeamId.trim(),
          mailboxBufferId: values.mailboxBufferId.trim(),
          mailboxObjectId: values.mailboxPrivateId.trim(),
          telegramChatId: values.telegramChatId.trim(),
          ...(roleTags.length ? { roleTags } : {}),
        })
        if (r.ok) {
          if (previousKey && previousKey !== storageKey) {
            hideContactFromPhonebook(previousKey)
            await saveContactEntry({ address: previousKey, clearMesh: true, label: 'Partner' })
          }
          recordContactLastContacted(storageKey)
          writeContactNote(storageKey, values.note)
          bumpMeta()
          refreshContactDirectory()
          const okMsg = r.message || 'Kontakt gespeichert.'
          setStatusMsg(okMsg)
          toast.success(okMsg)
          setDialog(null)
          if (onSelectContact && storageKey.startsWith('0x')) {
            onSelectContact(storageKey, {
              label: values.label.trim() || storageKey.slice(0, 12),
              meshNodeId: values.meshNodeId.trim() || undefined,
              ...slotsToSavePayload({
                mailboxSharedId: values.mailboxSharedId,
                mailboxPrivateId: values.mailboxPrivateId,
                mailboxTeamId: values.mailboxTeamId,
                mailboxBufferId: values.mailboxBufferId,
              }),
              telegramChatId: values.telegramChatId.trim() || undefined,
            })
          }
          return
        }
        const errMsg = r.error || 'Speichern fehlgeschlagen.'
        setStatusMsg(errMsg)
        toast.error(errMsg)
      } finally {
        setBusy(false)
      }
    },
    [dialog?.editStorageKey, refreshContactDirectory, setStatusMsg, onSelectContact]
  )

  const removeContact = useCallback(
    async (address: string) => {
      if (!window.confirm('Kontakt aus der Telefonbuch-Ansicht entfernen? (Server-Eintrag bleibt minimal erhalten.)')) {
        return
      }
      hideContactFromPhonebook(address)
      await saveContactEntry({ address, clearMesh: true, label: 'Partner' })
      bumpMeta()
      refreshContactDirectory()
      setStatusMsg('Kontakt ausgeblendet.')
    },
    [refreshContactDirectory, setStatusMsg]
  )

  const teamRosterManage = canManageTeamRoster(p.apiStatus)

  const removeFromTeam = useCallback(
    async (address: string, entry: ContactMeshEntryClient, displayName: string) => {
      if (isTeamMemberRemoveSent(address)) return
      const member = contactToTeamMember(directory, address, entry)
      if (!member) return
      const r = await removeTeamMemberFromRoster({
        apiStatus: p.apiStatus,
        member: { ...member, name: displayName },
      })
      if (!r.ok && r.cancelled) return
      if (!r.ok) {
        setStatusMsg(r.error)
        return
      }
      markTeamMemberRemoveSent(address)
      setTeamRemoveTick((n) => n + 1)
      setStatusMsg(`„${displayName}" — Entfernung an das Team gesendet${formatTeamWireDeliveryChannels(r.channels)}.`)
    },
    [directory, p.apiStatus, setStatusMsg]
  )

  const renderCard = (row: ContactRow) => {
    const { address, entry, displayName } = row
    const hasLora = Boolean(entry.meshNodeId?.trim())
    const isOnline = connectedSet.has(address)
    const hasMb = contactHasAnyMailboxSlot(entry)
    return (
      <ContactPhonebookCard
        key={address}
        address={address}
        entry={entry}
        displayName={displayName}
        isFavorite={favorites.has(address)}
        isOnline={isOnline}
        hasLora={hasLora}
        hasPrivateMailbox={hasMb}
        loraOnly={hasLora && !isOnline}
        lastSeen={lastContact[address]}
        note={readContactNotes()[address]}
        expanded={Boolean(expanded[address])}
        onToggleExpand={() => setExpanded((e) => ({ ...e, [address]: !e[address] }))}
        onToggleFavorite={() => {
          toggleContactFavorite(address)
          bumpMeta()
        }}
        onEdit={() =>
          setDialog({
            mode: 'edit',
            editStorageKey: address,
            initial: {
              ...entry,
              label: entry.label ?? '',
              note: readContactNotes()[address] ?? '',
              meshNodeId: entry.meshNodeId ?? '',
              telegramChatId: entry.telegramChatId ?? (address.startsWith('tg:') ? address.slice(3) : ''),
              roleTagsCsv: formatContactRoleTagsCsv(entry.roleTags),
            },
          })
        }
        onShowQr={() => setQrAddress(address)}
        onRemove={() => void removeContact(address)}
        onRemoveFromTeam={
          teamRosterManage && /^0x[a-fA-F0-9]{64}$/i.test(address) && !isTeamMemberRemoveSent(address)
            ? () => void removeFromTeam(address, entry, displayName)
            : undefined
        }
        teamRemoveSent={
          teamRosterManage && /^0x[a-fA-F0-9]{64}$/i.test(address) && isTeamMemberRemoveSent(address)
        }
        teamRemoveTick={teamRemoveTick}
        onRecordContact={() => {
          recordContactLastContacted(address)
          bumpMeta()
        }}
        onSelectForMessenger={
          onSelectContact
            ? () => {
                onSelectContact(address, entry)
              }
            : undefined
        }
      />
    )
  }

  const filterIds: PhonebookFilterId[] = ['all', 'lora', 'online', 'mailbox', 'recent']
  const myAddr = (p.myAddressLine || '').trim()
  const showMailboxes = /^0x[a-fA-F0-9]{64}$/i.test(myAddr)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {!embedded ? (
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Telefonbuch</h2>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-2 sm:ml-auto">
          <button
            type="button"
            onClick={() => setDialog({ mode: 'create' })}
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90"
          >
            <Plus className="h-5 w-5" aria-hidden />
            Neuer Kontakt
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="phonebook-search" className="text-sm font-semibold text-foreground">
          Kontakte suchen
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground/70" />
          <input
            id="phonebook-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, 0x-Adresse, Telegram-ID oder Funk-Node…"
            className="min-h-14 w-full rounded-xl border-2 border-foreground/25 bg-background py-3.5 pl-12 pr-4 text-base font-medium text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
          />
        </div>
      </div>

      <div
        className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Kontaktfilter"
      >
        {filterIds.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
            className={cn(
              'shrink-0 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors min-h-11',
              filter === id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:bg-muted'
            )}
          >
            {PHONEBOOK_FILTER_LABELS[id]}
          </button>
        ))}
      </div>

      {visibleDirectoryCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          {visibleDirectoryCount} {visibleDirectoryCount === 1 ? 'Kontakt' : 'Kontakte'} gespeichert
          {rows.length !== visibleDirectoryCount
            ? ` · ${rows.length} angezeigt (Filter „${PHONEBOOK_FILTER_LABELS[filter]}“)`
            : ''}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
          {visibleDirectoryCount > 0 && filter === 'recent'
            ? `${visibleDirectoryCount} Kontakt(e) sind gespeichert, aber keiner hat „Zuletzt kontaktiert“. Filter „Alle“ wählen oder einen Kontakt öffnen/speichern.`
            : visibleDirectoryCount > 0 && filter !== 'all'
              ? `Keine Treffer für „${PHONEBOOK_FILTER_LABELS[filter]}“${search.trim() ? ' und diese Suche' : ''}. Filter „Alle“ probieren.`
              : `Keine Kontakte${search.trim() ? ' für diese Suche' : ''}. „Neuer Kontakt“ oder QR-Scan nutzen.`}
        </p>
      ) : (
        <div className="space-y-6">
          {favoriteRows.length > 0 ? (
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
                Favoriten
              </h3>
              <ul className="space-y-3">{favoriteRows.map(renderCard)}</ul>
            </section>
          ) : null}
          {listRows.length > 0 ? (
            <section className="space-y-3">
              {favoriteRows.length > 0 ? (
                <h3 className="text-sm font-semibold text-muted-foreground">Alle Kontakte</h3>
              ) : null}
              <ul className="space-y-3">{listRows.map(renderCard)}</ul>
            </section>
          ) : null}
        </div>
      )}

      {showMailboxes && p.onOpenSettings ? (
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="mb-1 text-sm font-semibold text-foreground">Meine Mailboxen</p>
          <button
            type="button"
            onClick={p.onOpenSettings}
            className="text-xs font-medium text-foreground underline underline-offset-2 hover:no-underline"
          >
            Einstellungen → IOTA → Meine Mailboxen
          </button>
        </div>
      ) : null}

      {/* Team-Mitglieder-Liste gehört in Einsatzleitung — hier nicht nochmal. */}
      {p.allowInitialProfileImport ? (
        <PhonebookContactDistributePanel
          directory={directory}
          onContactsChanged={refreshContactDirectory}
        />
      ) : null}

      <PhonebookMeshBackupPanel directory={directory} onContactsChanged={refreshContactDirectory} />

      <details className="rounded-xl border border-border/80 bg-muted/10 px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-foreground">
          Telegram-Chat-IDs sichern (nicht Funk)
        </summary>
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          Nur Name und Telegram-Chat-ID. Meshtastic-Node-IDs stehen im Funk-Backup darüber, nicht hier.
        </p>
        <button
          type="button"
          className="mt-2 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium hover:bg-muted/50"
          onClick={() => {
            const rows = Object.entries(directory)
              .map(([address, entry]) => ({
                address,
                label: entry.label ?? '',
                telegramChatId: entry.telegramChatId?.trim() ?? '',
              }))
              .filter((r) => r.telegramChatId)
            const json = JSON.stringify(rows, null, 2)
            void navigator.clipboard.writeText(json).then(
              () => toast.success(`${rows.length} Telegram-ID(s) kopiert.`),
              () => toast.message('Kopieren nicht möglich.')
            )
          }}
        >
          Telegram-IDs kopieren
        </button>
      </details>

      <details className="rounded-xl border border-border/80 bg-muted/10 px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-foreground">Einsatz-Alarmgruppe</summary>
        <div className="mt-2">
          <TelegramAlarmGroupPhonebookBanner />
        </div>
      </details>

      <ContactPhonebookContactDialog
        open={dialog != null}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
        mode={dialog?.mode ?? 'create'}
        initial={dialog?.initial}
        editStorageKey={dialog?.editStorageKey}
        busy={busy}
        onSave={persistContact}
      />

      <ContactPhonebookQrDialog
        open={qrAddress != null}
        onOpenChange={(open) => {
          if (!open) setQrAddress(null)
        }}
        address={qrAddress ?? ''}
        entry={qrAddress ? lookupContactEntry(directory, qrAddress) : undefined}
      />

    </div>
  )
}
