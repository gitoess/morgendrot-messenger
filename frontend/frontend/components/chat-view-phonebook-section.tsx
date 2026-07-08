'use client'

/**
 * Telefonbuch ÔÇö Kartenliste, Filter, Favoriten, Modal f├╝r Anlegen/Bearbeiten.
 */

import { useCallback, useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
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
import { EinsatzleitungTeamRosterPanel } from '@/frontend/components/einsatzleitung-team-roster-panel'
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
  readHiddenContacts,
  recordContactLastContacted,
  toggleContactFavorite,
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
  /** Boss/Kommandant: Team-Telefonbuch ÔÇ×Aus Team entfernenÔÇ£. */
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
        setStatusMsg('IOTA-Adresse (0x + 64 Hex) oder Telegram Chat-ID n├Âtig.')
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
          bumpMeta()
          refreshContactDirectory()
          setStatusMsg(r.message || 'Kontakt gespeichert.')
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
        setStatusMsg(r.error || 'Speichern fehlgeschlagen.')
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
      setStatusMsg(`ÔÇ×${displayName}" ÔÇö Entfernung an das Team gesendet${formatTeamWireDeliveryChannels(r.channels)}.`)
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

      <TelegramAlarmGroupPhonebookBanner />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, Adresse oder Meshtastic suchenÔÇª"
          className="min-h-12 w-full rounded-xl border border-border bg-input py-3 pl-11 pr-4 text-base text-foreground placeholder:text-muted-foreground"
        />
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
            ? ` ┬À ${rows.length} angezeigt (Filter ÔÇ×${PHONEBOOK_FILTER_LABELS[filter]}ÔÇ£)`
            : ''}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
          {visibleDirectoryCount > 0 && filter === 'recent'
            ? `${visibleDirectoryCount} Kontakt(e) sind gespeichert, aber keiner hat ÔÇ×Zuletzt kontaktiertÔÇ£. Filter ÔÇ×AlleÔÇ£ w├ñhlen oder einen Kontakt ├Âffnen/speichern.`
            : visibleDirectoryCount > 0 && filter !== 'all'
              ? `Keine Treffer f├╝r ÔÇ×${PHONEBOOK_FILTER_LABELS[filter]}ÔÇ£${search.trim() ? ' und diese Suche' : ''}. Filter ÔÇ×AlleÔÇ£ probieren.`
              : `Keine Kontakte${search.trim() ? ' f├╝r diese Suche' : ''}. ÔÇ×Neuer KontaktÔÇ£ oder QR-Scan nutzen.`}
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
        <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-3">
          <p className="text-sm font-semibold text-foreground mb-1">Meine Mailboxen</p>
          <button
            type="button"
            onClick={p.onOpenSettings}
            className="text-xs font-medium text-primary underline hover:no-underline"
          >
            Einstellungen {'\u2192'} Meine Mailboxen
          </button>
        </div>
      ) : null}

      {p.allowInitialProfileImport ? (
        <>
          <EinsatzleitungTeamRosterPanel
            apiStatus={p.apiStatus ?? null}
            contactDirectory={directory}
          />
          <PhonebookContactDistributePanel
            directory={directory}
            onContactsChanged={refreshContactDirectory}
          />
        </>
      ) : null}

      <PhonebookMeshBackupPanel directory={directory} onContactsChanged={refreshContactDirectory} />

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
