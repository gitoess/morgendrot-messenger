'use client'

/**
 * Posteingang: Kopfzeile — Optionen (Wire/Klartext/Hash/Export/Pakete).
 * Move-Vertrag (Package-ID): Einstellungen → Expertenmodus.
 * NFT-Mint/Galerie: Hauptmenü-Wallet (nicht hier).
 * Aktualisieren liegt im App-Header neben Tresor (nicht hier).
 */

import { useEffect, useState, type ChangeEvent, type ReactNode, type RefObject } from 'react'
import {
  BookUser,
  ChevronDown,
  ClipboardPaste,
  FileDown,
  Filter,
  Hash,
  Inbox,
  KeyRound,
  Lock,
  MessageSquare,
  Package,
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
import {
  ChatConversationMenuItems,
  type ChatViewConversationMenuProps,
} from '@/frontend/components/chat-view-conversation-menu'
import { ChatViewMediaGallery } from '@/frontend/components/chat-view-media-gallery'
import {
  downloadPendingBrowserFileSave,
  reserveBrowserSaveHandle,
  revokePendingBrowserFileSave,
  type PendingBrowserFileSave,
} from '@/frontend/lib/browser-file-save'
import type {
  EinsatzExportRunResult,
  EinsatzExportUiOpts,
} from '@/frontend/features/messenger-ports/inbox-export-actions-port'

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
  onExportEinsatzberichtJson: (
    opts?: EinsatzExportUiOpts
  ) => void | Promise<void | EinsatzExportRunResult>
  onExportEinsatzberichtTxt: (
    opts?: EinsatzExportUiOpts
  ) => void | Promise<void | EinsatzExportRunResult>
  onExportEinsatzberichtTxtFull: (
    opts?: EinsatzExportUiOpts
  ) => void | Promise<void | EinsatzExportRunResult>
  onExportEinsatzberichtEncrypted: () => void | Promise<void>
  /** Vollständigen Verlauf für Medien-Galerie laden. */
  loadMessagesForMediaExport?: () => Promise<import('@/frontend/lib/types').Message[]>
  onExportEinsatzprotokoll: (kinds?: {
    audio?: boolean
    photo?: boolean
    image?: boolean
    file?: boolean
    text?: boolean
    slide?: boolean
  }) => void | Promise<void>
  onExportEinsatzprotokollPlainZip: (kinds?: {
    audio?: boolean
    photo?: boolean
    image?: boolean
    file?: boolean
    text?: boolean
    slide?: boolean
  }) => void | Promise<void>
  onExportEinsatzprotokollMarked: () => void | Promise<void>
  onExportMorgMediaZip: (kinds: {
    audio?: boolean
    photo?: boolean
    image?: boolean
    file?: boolean
    text?: boolean
    slide?: boolean
  }) => void | Promise<void>
  onExportMorgMediaDirect: (kinds: {
    audio?: boolean
    photo?: boolean
    image?: boolean
    file?: boolean
    text?: boolean
    slide?: boolean
  }) => void | Promise<void>
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
  /** Chat-Aktionen unter Optionen (früher separates ⋮). */
  conversationMenu?: ChatViewConversationMenuProps
  /** Richtung — immer sichtbar und aktiv. */
  directionFilter?: 'all' | 'in' | 'out'
  onDirectionFilterChange?: (d: 'all' | 'in' | 'out') => void
  /** Inhalt — immer sichtbar und aktiv (Listenfilter, nicht Sendemodus). */
  wireFilter?: 'all' | 'encrypted' | 'plaintext'
  onWireFilterChange?: (f: 'all' | 'encrypted' | 'plaintext') => void
  mediaFilter?: 'all' | 'images' | 'audio' | 'files'
  onMediaFilterChange?: (f: 'all' | 'images' | 'audio' | 'files') => void
  /** Partner-Schnellliste — aus wenn die Chat-Seitenleiste Partner schon wählt. */
  showPartnerFilterMenu?: boolean
  /** Schlanke Chat-Blasen statt Detail-Zeilen. */
  chatLayout?: boolean
  onChatLayoutChange?: (chat: boolean) => void
  onSelectAllVisible: () => void
  onClearInboxSelection: () => void
  onBulkHideSelected: () => void
  onBulkPurgeSelected: () => void
  onBulkMarkProtokollSelected?: () => void
  onBulkCopySelected?: () => void
  onBulkExportJsonSelected?: () => void
  onBulkHashSelected?: () => void
  onBulkForwardSelected?: (includeSender: boolean) => void
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
  /** z. B. „Posteingang Funk“ — sonst „Posteingang“. */
  inboxHeading?: string
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
  return 'Partner gewählt → Dateien wählen → verschlüsseltes .morg-pkg zum Weitergeben.'
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
    onRefresh: _onRefresh,
    loading: _loading,
    onExportEinsatzberichtJson,
    onExportEinsatzberichtTxt,
    onExportEinsatzberichtTxtFull,
    onExportEinsatzberichtEncrypted,
    onExportEinsatzprotokoll,
    onExportEinsatzprotokollPlainZip,
    onExportEinsatzprotokollMarked,
    onExportMorgMediaZip,
    onExportMorgMediaDirect,
    loadMessagesForMediaExport,
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
    showChannelControls: _showChannelControls,
    onToggleChannelControls: _onToggleChannelControls,
    showPartnerControls,
    onTogglePartnerControls,
    conversationMenu,
    directionFilter = 'all',
    onDirectionFilterChange,
    wireFilter = 'all',
    onWireFilterChange,
    mediaFilter = 'all',
    onMediaFilterChange,
    showPartnerFilterMenu = true,
    chatLayout = false,
    onChatLayoutChange,
    onSelectAllVisible,
    onClearInboxSelection,
    onBulkHideSelected,
    onBulkPurgeSelected,
    onBulkMarkProtokollSelected,
    onBulkCopySelected,
    onBulkExportJsonSelected,
    onBulkHashSelected,
    onBulkForwardSelected,
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
    showInboxPackageExpertMenu: _showInboxPackageExpertMenu = false,
    inboxPackageExpertMenu: _inboxPackageExpertMenu,
    pathTools: pathToolsProp,
    inboxHeading = 'Posteingang Alle',
  } = p

  const pathTools = pathToolsProp ?? DEFAULT_PATH_TOOLS
  const [wirePasteOpen, setWirePasteOpen] = useState(false)
  const [exportHistoryOpen, setExportHistoryOpen] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [pendingExportSave, setPendingExportSave] = useState<PendingBrowserFileSave | null>(null)
  const [mediaKinds, setMediaKinds] = useState({
    audio: true,
    image: true,
    file: true,
    text: false,
    slide: true,
  })
  const [exportScope, setExportScope] = useState<'all' | 'visibleChat'>('all')
  const [exportContentMode, setExportContentMode] = useState<
    'asStored' | 'plaintextOnly' | 'redactEncrypted'
  >('asStored')
  const [pkgToolsOpen, setPkgToolsOpen] = useState(false)
  const [chainQueueToolsOpen, setChainQueueToolsOpen] = useState(false)
  const [hashToolsOpen, setHashToolsOpen] = useState(false)
  const [evidenceOpenNonce, setEvidenceOpenNonce] = useState(0)
  const [evidenceDefaultMode, setEvidenceDefaultMode] = useState<'wire' | 'mailbox'>('wire')
  const [evidenceAllowedModes, setEvidenceAllowedModes] = useState<readonly ('wire' | 'mailbox')[]>([
    'wire',
  ])
  const openEvidenceBrowse = (mode: 'wire' | 'mailbox') => {
    setEvidenceDefaultMode(mode)
    setEvidenceAllowedModes([mode])
    setEvidenceOpenNonce((n) => n + 1)
  }

  const directionFilterLabel =
    directionFilter === 'in' ? 'Eingang' : directionFilter === 'out' ? 'Ausgang' : 'Beides'
  const wireFilterLabel =
    wireFilter === 'encrypted' ? 'Verschl.' : wireFilter === 'plaintext' ? 'Klartext' : 'Alles'
  const mediaFilterLabel =
    mediaFilter === 'images'
      ? 'Bilder'
      : mediaFilter === 'audio'
        ? 'Audio'
        : mediaFilter === 'files'
          ? 'Dateien'
          : 'Medien'
  const listFilterActive =
    directionFilter !== 'all' || wireFilter !== 'all' || mediaFilter !== 'all'
  const listFilterTriggerLabel = listFilterActive
    ? [directionFilterLabel, wireFilterLabel, mediaFilter !== 'all' ? mediaFilterLabel : null]
        .filter(Boolean)
        .join(' · ')
    : 'Filter'
  const pkgImportDisabled = morgPkgImportDisabled(apiStatus)
  const pkgDeviceDisabled =
    morgPkgDeviceBusy || apiStatus?.locked === true || !(apiStatus?.connectedAddresses?.length ?? 0)
  const vaultLocked = apiStatus?.locked === true
  const exportDenied = exportDataDeniedReason(apiStatus)
  const exportBlocked = Boolean(exportDenied)

  useEffect(() => {
    if (exportHistoryOpen) return
    revokePendingBrowserFileSave(pendingExportSave)
    setPendingExportSave(null)
    // Nur beim Schließen aufräumen (kein react-hooks-Plugin in eslint.config).
  }, [exportHistoryOpen])

  const blockExportAction = (run: () => void) => {
    if (!exportBlocked) {
      run()
      return
    }
    setStatus('error')
    setStatusMsg(exportDenied ?? 'Export nicht erlaubt.')
    setTimeout(() => setStatus('idle'), 6000)
  }

  /** ZIP/Enc: Dialog schließen nach Lauf. */
  const runExportAndClose = (run: () => void | Promise<void>) => {
    blockExportAction(() => {
      setExportBusy(true)
      void Promise.resolve()
        .then(() => run())
        .finally(() => {
          setExportBusy(false)
          setExportHistoryOpen(false)
        })
    })
  }

  /**
   * JSON/TXT: Save-Picker in der Klick-Geste reservieren (sonst blockiert der Browser
   * den Download nach dem langen Posteingang-Fetch). Dialog bleibt bei Pending offen.
   */
  const runTextualExport = (
    suggested: { filename: string; mime: string },
    run: (reserved: EinsatzExportUiOpts['reservedSaveHandle']) => Promise<void | EinsatzExportRunResult>
  ) => {
    blockExportAction(() => {
      void (async () => {
        revokePendingBrowserFileSave(pendingExportSave)
        setPendingExportSave(null)
        const reserved = await reserveBrowserSaveHandle(suggested)
        if (reserved === 'aborted') return
        setExportBusy(true)
        try {
          const result = await run(reserved)
          if (result && typeof result === 'object' && 'ok' in result) {
            if (result.ok && result.pending) {
              setPendingExportSave(result.pending)
              return
            }
            if (result.ok) {
              setExportHistoryOpen(false)
              return
            }
            if (result.aborted) return
          } else {
            setExportHistoryOpen(false)
          }
        } finally {
          setExportBusy(false)
        }
      })()
    })
  }

  const exportEmpty = messageCount === 0
  const exportDisabled = exportEmpty || exportBlocked || exportBusy
  const galleryBlocked = exportEmpty || exportBlocked

  return (
    <div className="border-b border-border">
      <div className="flex flex-wrap items-center justify-between gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Inbox className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">{inboxHeading}</h3>
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
            <ChatViewEvidenceImageViewerButton
              hideTrigger
              messages={messages}
              defaultMode={evidenceDefaultMode}
              allowedModes={evidenceAllowedModes}
              openNonce={evidenceOpenNonce}
            />
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
                title="Optionen: Chain-Text, PWMSG entschlüsseln, Hash, Export. Medien: Export → Galerie. Vertrag: Einstellungen → Expertenmodus."
              >
                <Settings2 className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                Optionen
                <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[16rem]">
              <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Posteingang · Tools
              </DropdownMenuLabel>
              {pathTools.showOnChainNft ? (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    openEvidenceBrowse('mailbox')
                  }}
                >
                  <Inbox className="mr-2 h-4 w-4 opacity-80" aria-hidden />
                  Chain-Text…
                </DropdownMenuItem>
              ) : null}
              {pathTools.showWirePaste ? (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    setWirePasteOpen(true)
                  }}
                >
                  <ClipboardPaste className="mr-2 h-4 w-4 opacity-80" aria-hidden />
                  PWMSG entschlüsseln…
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
              {pathTools.showPakete ||
              pathTools.showNachrichtenverlauf ||
              pathTools.showDecryptExport ||
              (showIotaExpertInboxActions && pathTools.showIotaExpertInHistory) ? (
                <DropdownMenuSeparator />
              ) : null}
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
                  Datei-Paket (.morg-pkg)…
                </DropdownMenuItem>
              ) : null}
              {pathTools.showDecryptExport ? (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    window.open('/einsatzbericht-decrypt.html', '_blank', 'noopener,noreferrer')
                  }}
                >
                  <KeyRound className="mr-2 h-4 w-4 opacity-80" aria-hidden />
                  Passwort-JSON öffnen…
                </DropdownMenuItem>
              ) : null}
              {showIotaExpertInboxActions && pathTools.showIotaExpertInHistory ? (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    setChainQueueToolsOpen(true)
                  }}
                >
                  <Inbox className="mr-2 h-4 w-4 opacity-80" aria-hidden />
                  Chain / Warteschlange…
                </DropdownMenuItem>
              ) : null}
              {conversationMenu ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Chat · Sicherheit
                  </DropdownMenuLabel>
                  <ChatConversationMenuItems
                    {...conversationMenu}
                    /* Gruppe verwalten bleibt in Sidebar / Info — nicht doppelt hier */
                    onManageGroup={undefined}
                    onCreateGroup={undefined}
                  />
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog open={exportHistoryOpen} onOpenChange={setExportHistoryOpen}>
            <DialogContent className="max-h-[min(90vh,36rem)] max-w-md overflow-y-auto sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Nachrichtenverlauf exportieren</DialogTitle>
                <DialogDescription className="sr-only">
                  Export JSON/Text/ZIP und Medien-Galerie.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                {exportBlocked || exportEmpty ? (
                  <p className="rounded-md border border-border/70 bg-muted/30 px-2.5 py-2 text-xs text-muted-foreground">
                    {exportBlocked
                      ? exportDenied
                      : 'Keine Nachrichten geladen — zuerst „Aktualisieren“ neben Tresor.'}
                  </p>
                ) : null}
                <div className="space-y-1.5 rounded-md border border-border/60 bg-muted/15 px-2.5 py-2">
                  <p className="text-[11px] font-medium text-foreground">Umfang</p>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="radio"
                      name="export-scope"
                      checked={exportScope === 'all'}
                      onChange={() => setExportScope('all')}
                    />
                    Gesamter Posteingang
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="radio"
                      name="export-scope"
                      checked={exportScope === 'visibleChat'}
                      onChange={() => setExportScope('visibleChat')}
                    />
                    Nur aktueller Chat (Filter)
                  </label>
                  <p className="pt-1 text-[11px] font-medium text-foreground">Verschlüsselung</p>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="radio"
                      name="export-enc"
                      checked={exportContentMode === 'asStored'}
                      onChange={() => setExportContentMode('asStored')}
                    />
                    Wie gespeichert (gemerkte Passphrase → Klartext, sonst PWMSG-Wire)
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="radio"
                      name="export-enc"
                      checked={exportContentMode === 'plaintextOnly'}
                      onChange={() => setExportContentMode('plaintextOnly')}
                    />
                    Nur lesbarer Klartext (nach Unlock; Rest ohne Merker weglassen)
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="radio"
                      name="export-enc"
                      checked={exportContentMode === 'redactEncrypted'}
                      onChange={() => setExportContentMode('redactEncrypted')}
                    />
                    Enc/PWMSG als „[Verschlüsselt]“ (kein Unlock, auch mit Merker)
                  </label>
                </div>
                <div className="grid gap-2">
                  {exportBusy ? (
                    <p className="text-xs text-muted-foreground">
                      Export läuft — Speichern ggf. schon gewählt; Verlauf wird noch geladen…
                    </p>
                  ) : null}
                  {pendingExportSave ? (
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 space-y-2">
                      <p className="text-xs text-foreground">
                        Datei bereit ({pendingExportSave.filename}). Browser hat den Auto-Download
                        oft blockiert — bitte speichern:
                      </p>
                      <Button
                        type="button"
                        className="w-full"
                        onClick={() => {
                          downloadPendingBrowserFileSave(pendingExportSave)
                          setStatus('success')
                          setStatusMsg(`Gespeichert: ${pendingExportSave.filename}`)
                          setTimeout(() => setStatus('idle'), 6000)
                          revokePendingBrowserFileSave(pendingExportSave)
                          setPendingExportSave(null)
                          setExportHistoryOpen(false)
                        }}
                      >
                        Datei speichern
                      </Button>
                    </div>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto justify-start whitespace-normal py-2.5 text-left"
                    disabled={exportDisabled}
                    onClick={() =>
                      runTextualExport(
                        { filename: 'morgendrot-einsatzbericht.json', mime: 'application/json' },
                        (reservedSaveHandle) =>
                          Promise.resolve(
                            onExportEinsatzberichtJson({
                              scope: exportScope,
                              contentMode: exportContentMode,
                              reservedSaveHandle,
                            })
                          )
                      )
                    }
                  >
                    JSON (vollständig)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto justify-start whitespace-normal py-2.5 text-left"
                    disabled={exportDisabled}
                    onClick={() => runExportAndClose(() => onExportEinsatzberichtEncrypted())}
                  >
                    <Lock className="mr-2 h-4 w-4 shrink-0 opacity-80" aria-hidden />
                    JSON verschlüsselt (Passwort)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto justify-start whitespace-normal py-2.5 text-left"
                    disabled={exportDisabled}
                    onClick={() =>
                      runTextualExport(
                        {
                          filename: 'morgendrot-nachrichtenverlauf-voll.txt',
                          mime: 'text/plain',
                        },
                        (reservedSaveHandle) =>
                          Promise.resolve(
                            onExportEinsatzberichtTxtFull({
                              scope: exportScope,
                              contentMode: exportContentMode,
                              reservedSaveHandle,
                            })
                          )
                      )
                    }
                  >
                    Text (vollständig)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto justify-start whitespace-normal py-2.5 text-left"
                    disabled={exportDisabled}
                    onClick={() =>
                      runTextualExport(
                        {
                          filename: 'morgendrot-nachrichtenverlauf-kurz.txt',
                          mime: 'text/plain',
                        },
                        (reservedSaveHandle) =>
                          Promise.resolve(
                            onExportEinsatzberichtTxt({
                              scope: exportScope,
                              contentMode: exportContentMode,
                              reservedSaveHandle,
                            })
                          )
                      )
                    }
                  >
                    Text kurz (~200 Zeichen)
                  </Button>
                </div>
                <div className="grid gap-2 border-t border-border pt-3">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    ZIP — Text + Medien (Auswahl der Arten unten gilt auch hier)
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto justify-start whitespace-normal py-2 text-left"
                    disabled={exportDisabled}
                    onClick={() => runExportAndClose(() => onExportEinsatzprotokoll(mediaKinds))}
                  >
                    Text mit Medien (ZIP+HTML, verschlüsselt)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto justify-start whitespace-normal py-2 text-left"
                    disabled={exportDisabled}
                    onClick={() => runExportAndClose(() => onExportEinsatzprotokollPlainZip(mediaKinds))}
                  >
                    Text mit Medien (ZIP Klartext, inkl. medien/)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto justify-start whitespace-normal py-2 text-left"
                    disabled={protokollMarkedCount === 0 || exportBlocked || exportBusy}
                    onClick={() => runExportAndClose(() => onExportEinsatzprotokollMarked())}
                  >
                    ZIP nur markiert (★ {protokollMarkedCount})
                  </Button>
                </div>
                <div className="grid gap-2 border-t border-border pt-3">
                  <p className="text-[11px] font-medium text-muted-foreground">Medien — Galerie</p>
                  <div className="grid gap-1.5 text-[11px] sm:grid-cols-2">
                    {(
                      [
                        ['image', 'Bilder (Online + Funk)'],
                        ['audio', 'Audio'],
                        ['file', 'Dateien'],
                        ['text', 'Text-Anhänge'],
                        ['slide', 'Slides'],
                      ] as const
                    ).map(([id, label]) => (
                      <label
                        key={id}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/20 px-2 py-1.5"
                      >
                        <input
                          type="checkbox"
                          checked={mediaKinds[id]}
                          onChange={(e) =>
                            setMediaKinds((prev) => ({ ...prev, [id]: e.target.checked }))
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  {galleryBlocked ? (
                    <p className="text-xs text-muted-foreground">
                      {exportBlocked ? exportDenied : 'Keine Nachrichten geladen.'}
                    </p>
                  ) : (
                    <ChatViewMediaGallery
                      messages={messages}
                      loadMessages={loadMessagesForMediaExport}
                      kinds={mediaKinds}
                      onStatus={(msg) => {
                        setStatus('success')
                        setStatusMsg(msg)
                        setTimeout(() => setStatus('idle'), 7000)
                      }}
                    />
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={chainQueueToolsOpen} onOpenChange={setChainQueueToolsOpen}>
            <DialogContent className="max-w-md sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Chain / Warteschlange</DialogTitle>
                <DialogDescription className="sr-only">
                  Verankern, Tangle-Inventar, Offline-Warteschlange.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-2">
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
            </DialogContent>
          </Dialog>

          <Dialog open={hashToolsOpen} onOpenChange={setHashToolsOpen}>
            <DialogContent className="max-h-[min(90vh,40rem)] max-w-lg overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Hash &amp; Prüfen (SHA-256)</DialogTitle>
                <DialogDescription>
                  Lokal SHA-256 von Text oder Datei (z. B. Export-JSON oder `.morg-pkg`). Nur hier unter Optionen —
                  kein zweites Hash-Panel unter Sicherheit.
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
                  ECDH-Offline-Paket: Empfänger-0x (verbunden / Self-Handshake) → Dateien wählen → Datei
                  weitergeben. Klartext ohne ECDH: Nachrichten-⋯ → Export.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                {onMorgPkgExportRecipientChange ? (
                  <div className="space-y-1.5">
                    <label htmlFor="morg-pkg-export-recipient" className="text-xs font-medium text-foreground">
                      Empfänger (0x — Handshake in peerMap)
                    </label>
                    <input
                      id="morg-pkg-export-recipient"
                      list="morg-pkg-export-partner-list"
                      value={morgPkgExportRecipient}
                      onChange={(e) => onMorgPkgExportRecipientChange(e.target.value.trim())}
                      placeholder="0x… volle 64 Hex — oder Vorschlag wählen"
                      spellCheck={false}
                      autoComplete="off"
                      className="h-10 w-full rounded-md border border-border bg-background px-2 font-mono text-xs text-foreground"
                    />
                    <datalist id="morg-pkg-export-partner-list">
                      {morgPkgExportPartnerOptions.map((o) => (
                        <option key={o.address} value={o.address}>
                          {o.label}
                        </option>
                      ))}
                    </datalist>
                    <div className="flex flex-wrap gap-1.5">
                      {myAddress.trim() ? (
                        <button
                          type="button"
                          className="rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
                          title="Eigene Wallet — nur wenn Self-Handshake/Connect aktiv (wie verschlüsselte Nachricht an dich)."
                          onClick={() => onMorgPkgExportRecipientChange(myAddress.trim())}
                        >
                          Ich
                        </button>
                      ) : null}
                      {morgPkgExportPartnerOptions
                        .filter((o) => !o.self)
                        .slice(0, 4)
                        .map((o) => (
                          <button
                            key={o.address}
                            type="button"
                            className="max-w-[11rem] truncate rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] text-foreground hover:bg-muted"
                            title={o.address}
                            onClick={() => onMorgPkgExportRecipientChange(o.address)}
                          >
                            {o.label.split(' · ')[0]}
                          </button>
                        ))}
                    </div>
                    {morgPkgExportPartnerOptions.length === 0 ? (
                      <p className="rounded-md border border-amber-600/35 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-950 dark:text-amber-100">
                        Noch keine peerMap-Einträge. Zuerst Handshake/Connect mit dem Empfänger (oder mit
                        dir selbst für „Ich“). Telefonbuch allein reicht nicht.
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="grid gap-2">
                  <Button
                    type="button"
                    variant="default"
                    className="h-10 justify-start"
                    disabled={
                      pkgDeviceDisabled ||
                      !/^0x[a-fA-F0-9]{64}$/i.test(morgPkgExportRecipient.trim())
                    }
                    title={
                      !/^0x[a-fA-F0-9]{64}$/i.test(morgPkgExportRecipient.trim())
                        ? 'Volle Empfänger-Adresse 0x + 64 Hex eintragen.'
                        : morgPkgDeviceTitle(apiStatus, morgPkgDeviceBusy)
                    }
                    onClick={() => {
                      if (!/^0x[a-fA-F0-9]{64}$/i.test(morgPkgExportRecipient.trim())) {
                        setStatus('error')
                        setStatusMsg('Empfänger: volle 0x-Adresse (64 Hex) eintragen.')
                        setTimeout(() => setStatus('idle'), 6000)
                        return
                      }
                      if (pkgDeviceDisabled) {
                        setStatus('error')
                        setStatusMsg(morgPkgDeviceTitle(apiStatus, morgPkgDeviceBusy))
                        setTimeout(() => setStatus('idle'), 8000)
                        return
                      }
                      // Dialog offen lassen bis File-Picker läuft — sonst verliert der Browser die User-Geste.
                      void (async () => {
                        try {
                          await onMorgPkgDeviceExportPick()
                        } finally {
                          setPkgToolsOpen(false)
                        }
                      })()
                    }}
                  >
                    {morgPkgDeviceBusy ? 'Paket wird erstellt…' : '.morg-pkg erstellen…'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 justify-start"
                    disabled={pkgImportDisabled}
                    title={morgPkgImportTitle(apiStatus)}
                    onClick={() => {
                      if (pkgImportDisabled) {
                        setStatus('error')
                        setStatusMsg(morgPkgImportTitle(apiStatus))
                        setTimeout(() => setStatus('idle'), 7000)
                        return
                      }
                      // Input synchron in dieser Geste — Dialog erst danach schließen.
                      morgPkgFileRef.current?.click()
                      setPkgToolsOpen(false)
                    }}
                  >
                    Import: .morg-pkg → Archiv
                  </Button>
                  {onOpenMorgPkgArchive ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 justify-start"
                      onClick={() => {
                        onOpenMorgPkgArchive()
                        setPkgToolsOpen(false)
                      }}
                    >
                      Paket-Archiv{morgPkgImportCount > 0 ? ` (${morgPkgImportCount})` : ''}
                    </Button>
                  ) : null}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <ChatViewWirePasteImportDialog
            hideTrigger
            open={wirePasteOpen}
            onOpenChange={setWirePasteOpen}
          />

          {/* Aktualisieren nur noch im Chat-Kopf neben Tresor. */}
        </div>
      </div>
      <div className="border-t border-border/70 px-4 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {onChatLayoutChange ? (
            <button
              type="button"
              onClick={() => onChatLayoutChange(!chatLayout)}
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium transition-colors',
                chatLayout
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border bg-muted/40 text-foreground hover:bg-muted'
              )}
              title={
                chatLayout
                  ? 'Zurück zur Detail-Liste (Badges, Explorer, Filter-Chips)'
                  : 'Chat-Ansicht: Blasen, Datum einmal pro Tag'
              }
              aria-pressed={chatLayout}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              Chat
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setInboxSelectMode((v) => !v)}
            className="rounded-md border border-border bg-muted/40 px-2 py-1 font-medium text-foreground hover:bg-muted"
          >
            {inboxSelectMode ? 'Auswahl beenden' : 'Auswahl'}
          </button>
          {onDirectionFilterChange || onWireFilterChange || onMediaFilterChange ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'inline-flex max-w-[min(100%,16rem)] items-center gap-1 rounded-md border px-2 py-1 font-medium transition-colors',
                    listFilterActive
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border bg-background text-foreground hover:bg-muted'
                  )}
                  title="Richtung, Inhalt und Medien filtern — Entschlüsseln bleibt in der Nachrichten-Zeile"
                  aria-label={`Listenfilter: ${directionFilterLabel}, ${wireFilterLabel}, ${mediaFilterLabel}`}
                >
                  <Filter className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                  <span className="truncate">{listFilterTriggerLabel}</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[min(100vw-2rem,16rem)]">
                {onDirectionFilterChange ? (
                  <>
                    <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Richtung
                    </DropdownMenuLabel>
                    {(
                      [
                        ['all', 'Beides'],
                        ['in', 'Eingang'],
                        ['out', 'Ausgang'],
                      ] as const
                    ).map(([id, label]) => (
                      <DropdownMenuItem
                        key={id}
                        onSelect={(e) => {
                          e.preventDefault()
                          onDirectionFilterChange(id)
                        }}
                      >
                        <span
                          aria-hidden
                          className={cn('mr-2 w-3 text-center', directionFilter === id ? 'opacity-100' : 'opacity-0')}
                        >
                          ✓
                        </span>
                        {label}
                      </DropdownMenuItem>
                    ))}
                  </>
                ) : null}
                {onDirectionFilterChange && onWireFilterChange ? <DropdownMenuSeparator /> : null}
                {onWireFilterChange ? (
                  <>
                    <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Inhalt
                    </DropdownMenuLabel>
                    {(
                      [
                        ['all', 'Alles'],
                        ['encrypted', 'Verschlüsselt'],
                        ['plaintext', 'Klartext'],
                      ] as const
                    ).map(([id, label]) => (
                      <DropdownMenuItem
                        key={id}
                        onSelect={(e) => {
                          e.preventDefault()
                          onWireFilterChange(id)
                        }}
                      >
                        <span
                          aria-hidden
                          className={cn('mr-2 w-3 text-center', wireFilter === id ? 'opacity-100' : 'opacity-0')}
                        >
                          ✓
                        </span>
                        {label}
                      </DropdownMenuItem>
                    ))}
                    <p className="px-2 pb-1.5 pt-1 text-[10px] leading-snug text-muted-foreground">
                      „Verschlüsselt“ filtert nur die Liste. Entschlüsseln: in der Zeile oder Optionen → Wire
                      entschlüsseln.
                    </p>
                  </>
                ) : null}
                {onMediaFilterChange ? (
                  <>
                    {onDirectionFilterChange || onWireFilterChange ? (
                      <DropdownMenuSeparator />
                    ) : null}
                    <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Medien
                    </DropdownMenuLabel>
                    {(
                      [
                        ['all', 'Alle Medien'],
                        ['images', 'Bilder'],
                        ['audio', 'Audio'],
                        ['files', 'Dateien'],
                      ] as const
                    ).map(([id, label]) => (
                      <DropdownMenuItem
                        key={id}
                        onSelect={(e) => {
                          e.preventDefault()
                          onMediaFilterChange(id)
                        }}
                      >
                        <span
                          aria-hidden
                          className={cn('mr-2 w-3 text-center', mediaFilter === id ? 'opacity-100' : 'opacity-0')}
                        >
                          ✓
                        </span>
                        {label}
                      </DropdownMenuItem>
                    ))}
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {showPartnerFilterMenu ? (
            <button
              type="button"
              onClick={() => onTogglePartnerControls()}
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium transition-colors',
                showPartnerControls
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border hover:bg-muted'
              )}
              title="Partner-Chips unter der Leiste"
            >
              Partner
            </button>
          ) : null}
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
            <div className="flex flex-wrap gap-2">
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
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Auswahl ({selectedInboxCount}) — Zeilen-Aktionen gebündelt
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              <button
                type="button"
                disabled={selectedInboxCount === 0}
                onClick={onBulkCopySelected}
                className="rounded-md border border-border px-2 py-1.5 text-left hover:bg-muted disabled:opacity-50"
                title="Rohinhalt / PWMSG-Wire der Auswahl in die Zwischenablage"
              >
                Inhalt/Wire kopieren
              </button>
              <button
                type="button"
                disabled={selectedInboxCount === 0}
                onClick={onBulkMarkProtokollSelected}
                className="rounded-md border border-border px-2 py-1.5 text-left hover:bg-muted disabled:opacity-50"
              >
                Für Protokoll markieren
              </button>
              <button
                type="button"
                disabled={selectedInboxCount === 0 || !onBulkForwardSelected}
                onClick={() => onBulkForwardSelected?.(true)}
                className="rounded-md border border-border px-2 py-1.5 text-left hover:bg-muted disabled:opacity-50"
              >
                Weiterleiten (mit Absender)
              </button>
              <button
                type="button"
                disabled={selectedInboxCount === 0 || !onBulkForwardSelected}
                onClick={() => onBulkForwardSelected?.(false)}
                className="rounded-md border border-border px-2 py-1.5 text-left hover:bg-muted disabled:opacity-50"
              >
                Weiterleiten (ohne Absender)
              </button>
              <button
                type="button"
                disabled={selectedInboxCount === 0}
                onClick={onBulkExportJsonSelected}
                className="rounded-md border border-border px-2 py-1.5 text-left hover:bg-muted disabled:opacity-50"
                title="Auswahl als JSON-Snapshot. Einzelzeile: ⋯ → Exportieren (JSON/TXT/Medien). ECDH → Optionen → .morg-pkg erstellen."
              >
                Als JSON (Snapshot)…
              </button>
              <button
                type="button"
                disabled={selectedInboxCount === 0 || !onBulkHashSelected}
                onClick={() => onBulkHashSelected?.()}
                className="rounded-md border border-border px-2 py-1.5 text-left hover:bg-muted disabled:opacity-50"
                title="Kanonische entry_hashes der Auswahl in die Zwischenablage"
              >
                Hashes kopieren
              </button>
              <button
                type="button"
                disabled={selectedInboxCount === 0}
                onClick={onBulkHideSelected}
                className="rounded-md border border-border px-2 py-1.5 text-left hover:bg-muted disabled:opacity-50"
                title="Nur Sichtbarkeit — Chain unverändert"
              >
                Lokal ausblenden
              </button>
              <button
                type="button"
                disabled={selectedInboxCount === 0 || localPurgeBusy}
                onClick={() => void onBulkPurgeSelected()}
                className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-left font-medium text-foreground hover:bg-destructive/15 disabled:opacity-50 sm:col-span-2"
                title="Nur Mailbox-Zeilen (burnbar). Bestätigung vor dem Lauf."
              >
                Von Chain löschen (Burn)
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Kopieren/Vorlesen unter der Nachricht; Hash/Medien/.morg-pkg → Optionen. Mesh-Paket nur im Zeilen-⋯ bei Funk.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
