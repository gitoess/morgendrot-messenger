'use client'

/**
 * Posteingang: Kopfzeile — On-Chain/NFT, Optionen (Wire/Pakete/Verlauf), Aktualisieren.
 */

import { useState, type ChangeEvent, type ReactNode, type RefObject } from 'react'
import {
  BookUser,
  Check,
  ChevronDown,
  ClipboardPaste,
  FileDown,
  Filter,
  Hash,
  Inbox,
  KeyRound,
  Lock,
  Package,
  RefreshCw,
  Settings2,
  StickyNote,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ApiStatus } from '@/frontend/lib/api'
import { exportDataDeniedReason } from '@/frontend/lib/messenger-capability-gates'
import type { MorgPkgExportPartnerOption } from '@/frontend/lib/morg-pkg-export-partners'
import {
  LazyChatViewProtokollAnchorButton,
  LazyChatViewTangleInventoryButton,
} from '@/frontend/components/lazy/messenger-scope-b'
/** Eager: On-Chain/NFT-Dialog ohne Lazy-Delay in der Toolbar. */
import { ChatViewEvidenceImageViewerButton } from '@/frontend/components/chat-view-evidence-image-viewer'
import { ChatViewWirePasteImportDialog } from '@/frontend/components/chat-view-wire-paste-import-dialog'
import { SettingsContentHashPanel } from '@/frontend/components/settings-content-hash-panel'
import {
  ChatViewPendingSendsButton,
  type OfflineMailboxQueueListItem,
} from '@/frontend/components/chat-view-pending-sends-button'
import type { InboxFeedReadPort } from '@/frontend/features/messenger-ports'
import type { MessagingPersistenceMode } from '@/frontend/lib/messaging-persistence-mode'
import { triggerHiddenFileInput } from '@/frontend/lib/trigger-hidden-file-input'
import {
  inboxToolbarToolsForSendPath,
  type InboxToolbarPathTools,
} from '@/frontend/lib/send-path-inbox-source-filter'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const DEFAULT_PATH_TOOLS = inboxToolbarToolsForSendPath({
  activeSendPath: 'internet',
  iotaPathFocus: false,
})

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
  /** Sichtbarkeit der Werkzeuge je Sendepfad. */
  pathTools?: InboxToolbarPathTools
  /** Tresor-Notizen / Passwort-Safe (rechts neben Optionen). */
  onOpenNotes?: () => void
  notesActive?: boolean
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
    showWireControls: _showWireControls,
    onToggleWireControls: _onToggleWireControls,
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
    pathTools: pathToolsProp,
  } = p

  const pathTools = pathToolsProp ?? DEFAULT_PATH_TOOLS
  const [wirePasteOpen, setWirePasteOpen] = useState(false)
  const [exportHistoryOpen, setExportHistoryOpen] = useState(false)
  const [pkgToolsOpen, setPkgToolsOpen] = useState(false)
  const [hashToolsOpen, setHashToolsOpen] = useState(false)
  const filterArmedCount =
    (showChannelControls && pathTools.showKanalFilterToggle ? 1 : 0) + (showPartnerControls ? 1 : 0)
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

  const runExportAndClose = (run: () => void) => {
    blockExportAction(() => {
      run()
      setExportHistoryOpen(false)
    })
  }

  const exportEmpty = messageCount === 0
  const exportDisabled = exportEmpty || exportBlocked

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
              title="Telefonbuch — Kontakte anlegen, bearbeiten, importieren"
            >
              <BookUser className="h-4 w-4 shrink-0" aria-hidden />
              Telefonbuch
            </button>
          ) : null}
          {inboxRowCount !== messageCount && messageCount > 0 ? (
            <span className="text-xs text-muted-foreground" title="Filter aktiv">
              {inboxRowCount} von {messageCount} sichtbar
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* Move-Vertrags-ID (IOTA) — nicht .morg-pkg / Datei-Paket */}
          {showInboxPackageExpertMenu && pathTools.showOnChainNft && inboxPackageExpertMenu
            ? inboxPackageExpertMenu
            : null}
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

          {pathTools.showOnChainNft ? (
            <div className="inline-flex items-center">
              <ChatViewEvidenceImageViewerButton
                messages={messages}
                triggerLabel="On-Chain / NFT"
                defaultMode="owner"
                triggerClassName="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted"
              />
            </div>
          ) : null}

          {p.onOpenNotes ? (
            <button
              type="button"
              onClick={() => p.onOpenNotes?.()}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                p.notesActive
                  ? 'border-primary/50 bg-primary/15 text-primary'
                  : 'border-border bg-muted/30 text-foreground hover:bg-muted'
              )}
              title="Tresor-Notizen und Passwörter (Vault)"
            >
              <StickyNote className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              Notizen
            </button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                title="Posteingang-Werkzeuge (nicht Chat-⋮: Burn/Schlüssel)"
              >
                <Settings2 className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                Optionen
                <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[16rem]">
              <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Posteingang
              </DropdownMenuLabel>
              {pathTools.showWirePaste ? (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    setWirePasteOpen(true)
                  }}
                >
                  <ClipboardPaste className="mr-2 h-4 w-4 opacity-80" aria-hidden />
                  Wire einfügen
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  setHashToolsOpen(true)
                }}
              >
                <Hash className="mr-2 h-4 w-4 opacity-80" aria-hidden />
                Hash &amp; Prüfen…
              </DropdownMenuItem>
              {pathTools.showPakete || pathTools.showNachrichtenverlauf ? <DropdownMenuSeparator /> : null}
              {pathTools.showNachrichtenverlauf ? (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    setExportHistoryOpen(true)
                  }}
                >
                  <FileDown className="mr-2 h-4 w-4 opacity-80" aria-hidden />
                  Export Nachrichtenverlauf…
                </DropdownMenuItem>
              ) : null}
              {pathTools.showPakete ? (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    setPkgToolsOpen(true)
                  }}
                >
                  <Package className="mr-2 h-4 w-4 opacity-80" aria-hidden />
                  Datei-Paket (Sneakernet)…
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog open={exportHistoryOpen} onOpenChange={setExportHistoryOpen}>
            <DialogContent className="max-h-[min(90vh,36rem)] max-w-md overflow-y-auto sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Nachrichtenverlauf exportieren</DialogTitle>
                <DialogDescription>
                  Download auf dieses Gerät. Telegram: Journal-Felder (Text, Chat-ID, Richtung) — keine TG-Medien.
                  Für Beweis: JSON speichern → Hash &amp; Prüfen (SHA-256 der Datei). Chain-Anker = T39.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p className="rounded-md border border-border/70 bg-muted/30 px-2.5 py-2 text-xs text-muted-foreground">
                  {exportBlocked
                    ? exportDenied
                    : exportEmpty
                      ? 'Keine Nachrichten geladen — zuerst „Aktualisieren“. Telegram braucht Bot + Chat-ID im Telefonbuch.'
                      : `${messageCount} Nachricht(en) bereit zum Export.`}
                </p>
                <div className="grid gap-2">
                  <Button
                    type="button"
                    variant="default"
                    className="h-auto justify-start whitespace-normal py-2.5 text-left"
                    disabled={exportDisabled}
                    onClick={() => runExportAndClose(() => onExportEinsatzberichtJson())}
                  >
                    JSON (vollständig, Klartext)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto justify-start whitespace-normal py-2.5 text-left"
                    disabled={exportDisabled}
                    onClick={() => runExportAndClose(() => void onExportEinsatzberichtTxtFull())}
                  >
                    Text (vollständig, Klartext)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto justify-start whitespace-normal py-2.5 text-left"
                    disabled={exportDisabled}
                    onClick={() => runExportAndClose(() => onExportEinsatzberichtTxt())}
                  >
                    Text kurz (~200 Zeichen)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto justify-start whitespace-normal py-2.5 text-left"
                    disabled={exportDisabled}
                    onClick={() => runExportAndClose(() => void onExportEinsatzberichtEncrypted())}
                  >
                    <Lock className="mr-2 h-4 w-4 shrink-0 opacity-80" aria-hidden />
                    Verschlüsselt (Passwort-JSON)
                  </Button>
                </div>
                <div className="grid gap-2 border-t border-border pt-3">
                  <p className="text-[11px] font-medium text-muted-foreground">ZIP</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto justify-start whitespace-normal py-2 text-left"
                    disabled={exportDisabled}
                    onClick={() => runExportAndClose(() => void onExportEinsatzprotokoll())}
                  >
                    ZIP + HTML (verschlüsselt)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto justify-start whitespace-normal py-2 text-left"
                    disabled={exportDisabled}
                    onClick={() => runExportAndClose(() => void onExportEinsatzprotokollPlainZip())}
                  >
                    ZIP Klartext
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto justify-start whitespace-normal py-2 text-left"
                    disabled={protokollMarkedCount === 0 || exportBlocked}
                    onClick={() => runExportAndClose(() => void onExportEinsatzprotokollMarked())}
                  >
                    ZIP nur markiert (★ {protokollMarkedCount})
                  </Button>
                </div>
                {pathTools.showDecryptExport ? (
                  <div className="border-t border-border pt-3">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto w-full justify-start whitespace-normal py-2 text-left text-muted-foreground"
                      onClick={() => {
                        window.open('/einsatzbericht-decrypt.html', '_blank', 'noopener,noreferrer')
                      }}
                    >
                      <KeyRound className="mr-2 h-4 w-4 shrink-0 opacity-80" aria-hidden />
                      Vorhandene Passwort-JSON wieder öffnen…
                    </Button>
                  </div>
                ) : null}
                {showIotaExpertInboxActions && pathTools.showIotaExpertInHistory ? (
                  <details className="rounded-md border border-border/70 bg-muted/15 p-2">
                    <summary className="cursor-pointer text-xs font-medium text-foreground">
                      Experten · Chain / Warteschlange
                    </summary>
                    <div className="mt-2 space-y-2">
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
                        triggerClassName="w-full justify-start rounded-md border border-border bg-background px-3 py-2 text-left text-sm hover:bg-muted"
                        triggerLabel="Auf Chain verankern"
                      />
                      <LazyChatViewTangleInventoryButton
                        inventoryScope="anchored"
                        messages={messages}
                        packageId={apiStatus?.packageId?.trim() || undefined}
                      />
                      <ChatViewPendingSendsButton
                        offlineMailboxQueuePending={offlineMailboxQueuePending}
                        offlineMailboxQueueItems={offlineMailboxQueueItems}
                        offlineMailboxQueueErrorHint={offlineMailboxQueueErrorHint}
                        onManualRefresh={onOfflineMailboxQueueRefresh}
                        onRemoveOfflineMailboxQueueItems={onRemoveOfflineMailboxQueueItems}
                        showRelayManage={showIotaExpertInboxActions}
                      />
                    </div>
                  </details>
                ) : null}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={hashToolsOpen} onOpenChange={setHashToolsOpen}>
            <DialogContent className="max-h-[min(90vh,40rem)] max-w-lg overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Hash &amp; Prüfen</DialogTitle>
                <DialogDescription>
                  Lokal SHA-256 — z. B. Export-JSON oder Datei. Gleicher Werkzeugkasten wie unter Einstellungen →
                  Sicherheit (kein zweiter Algorithmus).
                </DialogDescription>
              </DialogHeader>
              <SettingsContentHashPanel />
            </DialogContent>
          </Dialog>

          <Dialog open={pkgToolsOpen} onOpenChange={setPkgToolsOpen}>
            <DialogContent className="max-w-md sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Datei-Paket (.morg-pkg)</DialogTitle>
                <DialogDescription>
                  Offline-Datei-Archiv (.morg-pkg) für einen Partner. Das ist kein Posteingang-Filter und kein
                  Sendemodus im Composer.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                {morgPkgExportPartnerOptions.length > 0 && onMorgPkgExportRecipientChange ? (
                  <div className="space-y-1.5">
                    <label htmlFor="morg-pkg-export-recipient" className="text-xs font-medium text-foreground">
                      Empfänger für Export
                    </label>
                    <select
                      id="morg-pkg-export-recipient"
                      value={morgPkgExportRecipient}
                      onChange={(e) => onMorgPkgExportRecipientChange(e.target.value)}
                      className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
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
                  <p className="rounded-md border border-amber-600/35 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-950 dark:text-amber-100">
                    Export: zuerst Handshake/Connect — dann Empfänger wählbar.
                  </p>
                )}
                <div className="grid gap-2">
                  {onOpenMorgPkgArchive ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="justify-start"
                      onClick={() => {
                        onOpenMorgPkgArchive()
                        setPkgToolsOpen(false)
                      }}
                    >
                      Paket-Archiv{morgPkgImportCount > 0 ? ` (${morgPkgImportCount})` : ''}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto justify-start whitespace-normal py-2.5 text-left"
                    disabled={pkgImportDisabled}
                    title={morgPkgImportTitle(apiStatus)}
                    onClick={() => {
                      if (pkgImportDisabled) {
                        setStatus('error')
                        setStatusMsg(morgPkgImportTitle(apiStatus))
                        setTimeout(() => setStatus('idle'), 7000)
                        return
                      }
                      setPkgToolsOpen(false)
                      triggerHiddenFileInput(morgPkgFileRef)
                    }}
                  >
                    Import: .morg-pkg → Archiv
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    className="h-auto justify-start whitespace-normal py-2.5 text-left"
                    disabled={pkgDeviceDisabled}
                    title={morgPkgDeviceTitle(apiStatus, morgPkgDeviceBusy)}
                    onClick={() => {
                      if (pkgDeviceDisabled) {
                        setStatus('error')
                        setStatusMsg(morgPkgDeviceTitle(apiStatus, morgPkgDeviceBusy))
                        setTimeout(() => setStatus('idle'), 8000)
                        return
                      }
                      setPkgToolsOpen(false)
                      void onMorgPkgDeviceExportPick()
                    }}
                  >
                    {morgPkgDeviceBusy ? 'Export: Paket wird gebaut…' : 'Export: Dateien → .morg-pkg'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <ChatViewWirePasteImportDialog
            hideTrigger
            open={wirePasteOpen}
            onOpenChange={setWirePasteOpen}
          />

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium transition-colors',
                  filterArmedCount > 0
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-border hover:bg-muted'
                )}
                title="Inhalt / Partner (Kanal nur bei Online — sonst steuert der Sendepfad)"
              >
                <Filter className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Filter{filterArmedCount > 0 ? ` (${filterArmedCount})` : ''}
                <ChevronDown className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[14rem]">
              <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Anzeige filtern
              </DropdownMenuLabel>
              {pathTools.showKanalFilterToggle ? (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    onToggleChannelControls()
                  }}
                >
                  <Check
                    className={cn('mr-2 h-4 w-4', showChannelControls ? 'opacity-100' : 'opacity-0')}
                    aria-hidden
                  />
                  Kanal (Quelle)
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  onTogglePartnerControls()
                }}
              >
                <Check
                  className={cn('mr-2 h-4 w-4', showPartnerControls ? 'opacity-100' : 'opacity-0')}
                  aria-hidden
                />
                Partner
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                    `Ausgewählte Nachrichten wirklich auf Chain löschen (Burn)?\n\n` +
                      `- Anzahl: ${count}\n` +
                      `- Wirkung auf Chain: Burn der ausgewählten Mailbox-Einträge (sofern burnbar, mit Storage-Rebate)\n` +
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
              Ausgewählte burnen
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
