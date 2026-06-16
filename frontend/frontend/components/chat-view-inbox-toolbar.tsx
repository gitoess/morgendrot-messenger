'use client'

/**
 * Posteingang: Kopfzeile (Zähler, Pakete, Nachrichtenverlauf, Aktualisieren).
 */

import type { ChangeEvent, ReactNode, RefObject } from 'react'
import { BookUser, ChevronDown, FileDown, Inbox, KeyRound, Lock, Package, RefreshCw, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApiStatus } from '@/frontend/lib/api'
import { exportDataDeniedReason } from '@/frontend/lib/messenger-capability-gates'
import type { MorgPkgExportPartnerOption } from '@/frontend/lib/morg-pkg-export-partners'
import {
  LazyChatViewProtokollAnchorButton,
  LazyChatViewTangleInventoryButton,
} from '@/frontend/components/lazy/messenger-scope-b'
import {
  ChatViewPendingSendsButton,
  type OfflineMailboxQueueListItem,
} from '@/frontend/components/chat-view-pending-sends-button'
import type { InboxFeedReadPort } from '@/frontend/features/messenger-ports'
import type { MessagingPersistenceMode } from '@/frontend/lib/messaging-persistence-mode'
import { triggerHiddenFileInput } from '@/frontend/lib/trigger-hidden-file-input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type { MorgPkgExportPartnerOption } from '@/frontend/lib/morg-pkg-export-partners'

export type ChatViewInboxToolbarProps = InboxFeedReadPort & {
  messageCount: number
  inboxRowCount: number
  morgPkgExportRecipient?: string
  onMorgPkgExportRecipientChange?: (address: string) => void
  morgPkgExportPartnerOptions?: MorgPkgExportPartnerOption[]
  morgPkgImportCount?: number
  onOpenMorgPkgArchive?: () => void
  morgPkgFileRef: RefObject<HTMLInputElement | null>
  morgPkgDeviceFilesRef: RefObject<HTMLInputElement | null>
  onMorgPkgImportFile: (e: ChangeEvent<HTMLInputElement>) => void
  onMorgPkgDeviceFiles: (e: ChangeEvent<HTMLInputElement>) => void
  onMorgPkgDeviceExportPick: () => void | Promise<void>
  morgPkgDeviceBusy: boolean
  apiStatus: ApiStatus | null
  onRefresh: () => void
  loading: boolean
  onExportEinsatzberichtJson: () => void
  onExportEinsatzberichtTxt: () => void
  onExportEinsatzberichtTxtFull: () => void
  onExportEinsatzberichtEncrypted: () => void | Promise<void>
  onExportEinsatzprotokoll: () => void | Promise<void>
  onExportEinsatzprotokollPlainZip: () => void | Promise<void>
  onExportEinsatzprotokollMarked: () => void | Promise<void>
  protokollMarkedCount: number
  recipient: string
  setStatus: (v: 'idle' | 'success' | 'error') => void
  setStatusMsg: (v: string) => void
  inboxSelectMode: boolean
  setInboxSelectMode: (v: boolean | ((p: boolean) => boolean)) => void
  selectedInboxCount: number
  showWireControls: boolean
  onToggleWireControls: () => void
  showChannelControls: boolean
  onToggleChannelControls: () => void
  showPartnerControls: boolean
  onTogglePartnerControls: () => void
  onSelectAllVisible: () => void
  onClearInboxSelection: () => void
  onBulkHideSelected: () => void
  onBulkPurgeSelected: () => void
  hasHiddenMessages: boolean
  onToggleHideAllVisibleLocal: () => void
  localPurgeBusy?: boolean
  onOpenPhonebook?: () => void
  showPhonebookButton?: boolean
  onOpenPartnerSetup?: () => void
  messagingPersistenceMode: MessagingPersistenceMode
  offlineMailboxQueuePending?: number
  offlineMailboxQueueItems?: OfflineMailboxQueueListItem[]
  offlineMailboxQueueErrorHint?: string
  onOfflineMailboxQueueRefresh?: () => void | Promise<void>
  onRemoveOfflineMailboxQueueItems?: (ids: string[]) => void
  /** Offene Handshake-Anfragen (nicht verbunden, nicht abgelehnt). */
  pendingHandshakeCount?: number
  /** Verankern / Tangle-Inventar / Relay — nur Expert + iota-Transport. */
  showIotaExpertInboxActions?: boolean
  /** Package-ID (Move) — nur Client-Expertenmodus + IOTA. */
  showInboxPackageExpertMenu?: boolean
  inboxPackageExpertMenu?: ReactNode
}

function morgPkgImportDisabled(apiStatus: ApiStatus | null): boolean {
  return apiStatus?.locked === true
}

function morgPkgImportTitle(apiStatus: ApiStatus | null): string {
  if (apiStatus?.locked) return 'Tresor entsperren, um .morg-pkg zu öffnen.'
  if (apiStatus?.connected !== true) {
    return 'Import starten: Tresor offen. Zum Entschlüsseln brauchst du Handshake/Connect mit dem Absender der Datei.'
  }
  return 'Verschlüsseltes .morg-pkg vom Partner in den lokalen Posteingang importieren.'
}

function morgPkgDeviceTitle(apiStatus: ApiStatus | null, busy: boolean): string {
  if (busy) return 'Paket wird erstellt…'
  if (apiStatus?.locked) return 'Tresor entsperren.'
  if (!apiStatus?.connectedAddresses?.length) {
    return 'Zuerst Partner verbinden (Handshake) — Export verschlüsselt für verbundenen 0x-Partner.'
  }
  return 'Dateien vom Gerät zu einem verschlüsselten .morg-pkg bündeln (Sneakernet).'
}

export function ChatViewInboxToolbar(p: ChatViewInboxToolbarProps) {
  const {
    messageCount,
    inboxRowCount,
    morgPkgExportRecipient = '',
    onMorgPkgExportRecipientChange,
    morgPkgExportPartnerOptions = [],
    morgPkgImportCount = 0,
    onOpenMorgPkgArchive,
    morgPkgFileRef,
    morgPkgDeviceFilesRef,
    onMorgPkgImportFile,
    onMorgPkgDeviceFiles,
    onMorgPkgDeviceExportPick,
    morgPkgDeviceBusy,
    apiStatus,
    onRefresh,
    loading,
    onExportEinsatzberichtJson,
    onExportEinsatzberichtTxt,
    onExportEinsatzberichtTxtFull,
    onExportEinsatzberichtEncrypted,
    onExportEinsatzprotokoll,
    onExportEinsatzprotokollPlainZip,
    onExportEinsatzprotokollMarked,
    protokollMarkedCount,
    messages,
    myAddress,
    recipient,
    setStatus,
    setStatusMsg,
    inboxSelectMode,
    setInboxSelectMode,
    selectedInboxCount,
    showWireControls,
    onToggleWireControls,
    showChannelControls,
    onToggleChannelControls,
    showPartnerControls,
    onTogglePartnerControls,
    onSelectAllVisible,
    onClearInboxSelection,
    onBulkHideSelected,
    onBulkPurgeSelected,
    hasHiddenMessages,
    onToggleHideAllVisibleLocal,
    localPurgeBusy = false,
    onOpenPhonebook,
    showPhonebookButton = false,
    onOpenPartnerSetup,
    messagingPersistenceMode,
    offlineMailboxQueuePending = 0,
    offlineMailboxQueueItems = [],
    offlineMailboxQueueErrorHint = '',
    onOfflineMailboxQueueRefresh,
    onRemoveOfflineMailboxQueueItems,
    pendingHandshakeCount = 0,
    showIotaExpertInboxActions = true,
    showInboxPackageExpertMenu = false,
    inboxPackageExpertMenu,
  } = p

  const pkgImportDisabled = morgPkgImportDisabled(apiStatus)
  const pkgDeviceDisabled =
    morgPkgDeviceBusy || apiStatus?.locked === true || !(apiStatus?.connectedAddresses?.length ?? 0)
  const vaultLocked = apiStatus?.locked === true
  const exportDenied = exportDataDeniedReason(apiStatus)
  const exportBlocked = Boolean(exportDenied)

  const blockExportAction = (run: () => void) => {
    if (!exportBlocked) {
      run()
      return
    }
    setStatus('error')
    setStatusMsg(exportDenied ?? 'Export nicht erlaubt.')
    setTimeout(() => setStatus('idle'), 6000)
  }

  return (
    <div className="border-b border-border">
      <div className="flex flex-wrap items-center justify-between gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Inbox className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Posteingang</h3>
          {pendingHandshakeCount > 0 ? (
            <span
              className="inline-flex min-h-6 items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200"
              title={`${pendingHandshakeCount} ausstehende Handshake-Anfrage(n) — unten im Posteingang`}
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden />
              {pendingHandshakeCount}
            </span>
          ) : null}
          {!showIotaExpertInboxActions && offlineMailboxQueuePending > 0 ? (
            <ChatViewPendingSendsButton
              offlineMailboxQueuePending={offlineMailboxQueuePending}
              offlineMailboxQueueItems={offlineMailboxQueueItems}
              offlineMailboxQueueErrorHint={offlineMailboxQueueErrorHint}
              onManualRefresh={onOfflineMailboxQueueRefresh}
              onRemoveOfflineMailboxQueueItems={onRemoveOfflineMailboxQueueItems}
              showRelayManage={false}
              triggerClassName="inline-flex min-h-8 items-center gap-1 rounded-md border border-amber-600/45 bg-amber-500/15 px-2 py-1 text-[11px] font-semibold text-amber-950 hover:bg-amber-500/25 dark:text-amber-100"
            />
          ) : null}
          {showPhonebookButton && onOpenPhonebook ? (
            <button
              type="button"
              onClick={onOpenPhonebook}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/15"
            >
              <BookUser className="h-4 w-4 shrink-0" aria-hidden />
              Telefonbuch
            </button>
          ) : null}
          <a
            href="/einsatzbericht-decrypt.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
            title="Passwortgeschützte Nachrichtenverlauf-Exporte (.json) hier entpacken."
          >
            <KeyRound className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            Entschlüsseln
          </a>
          {inboxRowCount !== messageCount && messageCount > 0 ? (
            <span className="text-xs text-muted-foreground" title="Filter aktiv">
              {inboxRowCount} von {messageCount} sichtbar
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {showInboxPackageExpertMenu && inboxPackageExpertMenu ? inboxPackageExpertMenu : null}
          <input
            ref={morgPkgFileRef}
            type="file"
            accept=".json,.morg-pkg,application/json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={onMorgPkgImportFile}
          />
          <input
            ref={morgPkgDeviceFilesRef}
            type="file"
            multiple
            accept="image/*,.txt,text/plain,.opus,.ogg,audio/ogg,audio/opus,application/ogg"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={onMorgPkgDeviceFiles}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Package className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                Pakete
                <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[18rem]">
              <p className="px-2 py-1.5 text-[10px] leading-snug text-muted-foreground">
                ECDH-verschlüsselt für einen Handshake-Partner. Import → <strong className="text-foreground">Paket-Archiv</strong>{' '}
                (nicht Posteingang).
              </p>
              {morgPkgExportPartnerOptions.length > 0 && onMorgPkgExportRecipientChange ? (
                <div className="space-y-1 border-b border-border px-2 py-2">
                  <label htmlFor="morg-pkg-export-recipient" className="text-[10px] font-medium text-foreground">
                    Empfänger für Export
                  </label>
                  <select
                    id="morg-pkg-export-recipient"
                    value={morgPkgExportRecipient}
                    onChange={(e) => onMorgPkgExportRecipientChange(e.target.value)}
                    className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
                  >
                    {morgPkgExportPartnerOptions.length > 1 ? (
                      <option value="">— Partner wählen —</option>
                    ) : null}
                    {morgPkgExportPartnerOptions.map((o) => (
                      <option key={o.address} value={o.address}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="px-2 py-1.5 text-[10px] text-amber-700 dark:text-amber-200">
                  Export: zuerst Handshake/Connect — dann Empfänger wählbar.
                </p>
              )}
              {onOpenMorgPkgArchive ? (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    onOpenMorgPkgArchive()
                  }}
                >
                  Paket-Archiv{morgPkgImportCount > 0 ? ` (${morgPkgImportCount})` : ''}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                disabled={pkgImportDisabled}
                title={morgPkgImportTitle(apiStatus)}
                onSelect={(e) => {
                  e.preventDefault()
                  if (pkgImportDisabled) {
                    setStatus('error')
                    setStatusMsg(morgPkgImportTitle(apiStatus))
                    setTimeout(() => setStatus('idle'), 7000)
                    return
                  }
                  triggerHiddenFileInput(morgPkgFileRef)
                }}
              >
                Import: .morg-pkg → Archiv
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={pkgDeviceDisabled}
                title={morgPkgDeviceTitle(apiStatus, morgPkgDeviceBusy)}
                onSelect={(e) => {
                  e.preventDefault()
                  if (pkgDeviceDisabled) {
                    setStatus('error')
                    setStatusMsg(morgPkgDeviceTitle(apiStatus, morgPkgDeviceBusy))
                    setTimeout(() => setStatus('idle'), 8000)
                    return
                  }
                  void onMorgPkgDeviceExportPick()
                }}
              >
                {morgPkgDeviceBusy ? 'Export: Paket wird gebaut…' : 'Export: Dateien → .morg-pkg Download'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={exportBlocked}
                title={exportDenied ?? undefined}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileDown className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                Nachrichtenverlauf
                <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="max-h-[min(70vh,28rem)] w-[min(100vw-2rem,20rem)] overflow-y-auto"
            >
              <p className="px-2 py-1.5 text-[10px] leading-snug text-muted-foreground">
                Vollständig: JSON, TXT vollständig, verschlüsseltes Passwort-JSON oder ZIP. TXT kurz = ~200 Zeichen pro
                Nachricht.
              </p>
              <DropdownMenuItem
                disabled={messageCount === 0 || exportBlocked}
                onSelect={() => blockExportAction(() => onExportEinsatzberichtJson())}
              >
                Als JSON (vollständig, Klartext)
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={messageCount === 0 || exportBlocked}
                onSelect={() => blockExportAction(() => void onExportEinsatzberichtTxtFull())}
              >
                Als Text (vollständig, Klartext)
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={messageCount === 0 || exportBlocked}
                onSelect={() => blockExportAction(() => onExportEinsatzberichtTxt())}
              >
                Als Text (kurz, ~200 Zeichen)
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={messageCount === 0 || exportBlocked}
                onSelect={() => blockExportAction(() => void onExportEinsatzberichtEncrypted())}
              >
                <Lock className="mr-2 h-4 w-4 opacity-80" aria-hidden />
                Verschlüsselt (vollständig, Passwort-JSON)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={messageCount === 0 || exportBlocked}
                onSelect={() => blockExportAction(() => void onExportEinsatzprotokoll())}
              >
                ZIP + HTML (verschlüsselt)
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={messageCount === 0 || exportBlocked}
                onSelect={() => blockExportAction(() => void onExportEinsatzprotokollPlainZip())}
              >
                ZIP Klartext
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={protokollMarkedCount === 0 || exportBlocked}
                onSelect={() => blockExportAction(() => void onExportEinsatzprotokollMarked())}
              >
                ZIP nur markiert (★ {protokollMarkedCount})
              </DropdownMenuItem>
              {showIotaExpertInboxActions ? (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1">
                    <LazyChatViewProtokollAnchorButton
                      messageCount={messageCount}
                      messages={messages}
                      myAddress={myAddress}
                      recipient={recipient}
                      vaultLocked={vaultLocked}
                      messagingPersistenceMode={messagingPersistenceMode}
                      setStatus={setStatus}
                      setStatusMsg={setStatusMsg}
                      onOpenPartnerSetup={onOpenPartnerSetup}
                      triggerClassName="w-full justify-start rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-sm hover:bg-accent"
                      triggerLabel="Auf Chain verankern"
                    />
                  </div>
                  <div className="px-2 py-1">
                    <LazyChatViewTangleInventoryButton
                      inventoryScope="anchored"
                      messages={messages}
                      packageId={apiStatus?.packageId?.trim() || undefined}
                    />
                  </div>
                  <div className="px-2 py-1">
                    <ChatViewPendingSendsButton
                      offlineMailboxQueuePending={offlineMailboxQueuePending}
                      offlineMailboxQueueItems={offlineMailboxQueueItems}
                      offlineMailboxQueueErrorHint={offlineMailboxQueueErrorHint}
                      onManualRefresh={onOfflineMailboxQueueRefresh}
                      onRemoveOfflineMailboxQueueItems={onRemoveOfflineMailboxQueueItems}
                      showRelayManage={showIotaExpertInboxActions}
                    />
                  </div>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            title="Posteingang und Kontakte neu laden"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Aktualisieren
          </button>
        </div>
      </div>
      <div className="border-t border-border/70 px-4 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setInboxSelectMode((v) => !v)}
            className="rounded-md border border-border bg-muted/40 px-2 py-1 font-medium text-foreground hover:bg-muted"
          >
            {inboxSelectMode ? 'Auswahl beenden' : 'Auswahl'}
          </button>
          <button
            type="button"
            onClick={onToggleWireControls}
            className={cn(
              'rounded-md border px-2 py-1 font-medium transition-colors',
              showWireControls ? 'border-primary bg-primary/15 text-primary' : 'border-border hover:bg-muted'
            )}
          >
            Posteingang (Inhalt)
          </button>
          <button
            type="button"
            onClick={onToggleChannelControls}
            className={cn(
              'rounded-md border px-2 py-1 font-medium transition-colors',
              showChannelControls ? 'border-primary bg-primary/15 text-primary' : 'border-border hover:bg-muted'
            )}
          >
            Kanal
          </button>
          <button
            type="button"
            onClick={onTogglePartnerControls}
            className={cn(
              'rounded-md border px-2 py-1 font-medium transition-colors',
              showPartnerControls ? 'border-primary bg-primary/15 text-primary' : 'border-border hover:bg-muted'
            )}
          >
            Partner
          </button>
          {hasHiddenMessages ? (
            <button
              type="button"
              onClick={onToggleHideAllVisibleLocal}
              title="Lokal ausgeblendete Zeilen wieder anzeigen"
              className="rounded-md border border-border px-2 py-1 hover:bg-muted"
            >
              Wieder einblenden
            </button>
          ) : null}
        </div>
        {inboxSelectMode ? (
          <div className="mt-2 flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/15 p-2.5">
            <button
              type="button"
              onClick={onSelectAllVisible}
              className="rounded-md border border-border px-2 py-1 text-left hover:bg-muted"
            >
              Alle anwählen
            </button>
            <button
              type="button"
              onClick={onClearInboxSelection}
              className="rounded-md border border-border px-2 py-1 text-left hover:bg-muted"
            >
              Keine
            </button>
            <button
              type="button"
              disabled={selectedInboxCount === 0}
              onClick={onBulkHideSelected}
              className="rounded-md border border-border px-2 py-1 text-left hover:bg-muted disabled:opacity-50"
            >
              Ausgewählte lokal ausblenden ({selectedInboxCount})
            </button>
            <button
              type="button"
              disabled={selectedInboxCount === 0 || apiStatus?.connected !== true}
              onClick={() => {
                const count = selectedInboxCount
                if (
                  !window.confirm(
                    `Ausgewählte Nachrichten wirklich auf Chain löschen?\n\n` +
                      `- Anzahl: ${count}\n` +
                      `- Wirkung auf Chain: Purge der ausgewählten Mailbox-Einträge (sofern purge-fähig, mit Storage-Rebate)\n` +
                      `- Lokal: Die ausgewählten Zeilen verschwinden zusätzlich aus deiner Inbox-Ansicht\n` +
                      `- Nicht betroffen: andere lokale Daten wie Telefonbuch/Kontakte\n\n` +
                      `Das ist kein reines UI-Ausblenden. Fortfahren?`
                  )
                ) {
                  return
                }
                onBulkPurgeSelected()
              }}
              className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-left text-destructive hover:bg-destructive/20 disabled:opacity-50"
            >
              Ausgewählte auf Chain löschen
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
