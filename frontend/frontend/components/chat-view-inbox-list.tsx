'use client'

/**
 * Inbox list: renders mailbox + mesh-merged messages as rows (plain messages + slideshow groups).
 *
 * **Meshtastic (möglichst 1:1):** Funkpfad = Standard Meshtastic (Routing, Store-and-Forward, BLE zum Host).
 * Diese Komponente zeigt nur bereits zusammengeführte `Message`-Objekte – kein eigenes Mesh-Routing.
 *
 * **Morgendrot / Eigenlogik:** IOTA-Mailbox-Fetch und Merge mit lokalen Mesh-Nachrichten (`loadMessages` in der View),
 * MORG_*-Wire-Darstellung in `ChatMessageBody`, Slideshow aus `MORG_SLIDE_V1`, LoRa Luma/Chroma- und S-ARQ-Segment-Korrelation in
 * `buildChatInboxRows`, Export (.morg-pkg, JSON-Snapshot) in den Aktionen.
 *
 * Details zum Baukasten: `docs/MESHTASTIC-BUILDING-BLOCKS.md`
 *
 * Wird von `ChatViewInboxPanel` zusammen mit `ChatViewInboxToolbar` eingebunden.
 */

import {
  Download,
  Forward,
  Inbox,
  Link2,
  Lock,
  MessageCircle,
  MoreHorizontal,
  Package,
  Reply,
  ShieldCheck,
  Pin,
  Star,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChatMessageBody } from '@/frontend/components/chat-message-body'
import { parseHandoffZipWire } from '@/frontend/lib/handoff-iota-wire'
import { queueHandoffZipFromInbox } from '@/frontend/lib/handoff-pending-inbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SlideShowCrossfade } from '@/frontend/components/slide-show-crossfade'
import type { ChatInboxRow } from '@/frontend/features/inbox/chat-view-inbox-rows'
import { downloadSneakernetPackage } from '@/frontend/lib/sneakernet-export'
import type { Message } from '@/frontend/lib/types'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { contactDisplayLabel } from '@/frontend/lib/contact-display'
import { formatInboxLoadError, INBOX_BASIS_OFFLINE_HEADLINE } from '@/frontend/features/inbox/inbox-load-error'
import { addressMatchesIdentity, isMessageOutgoing } from '@/frontend/features/inbox/inbox-partner-filter'
import {
  formatTelegramOutboundRecipientLine,
  telegramOutboundCounterpartyKeys,
} from '@/frontend/lib/telegram-outbound-inbox'
import type { InboxFeedReadPort } from '@/frontend/features/messenger-ports'
import { openProtokollAnchorDialogFromPrefill, openR1CourierDialogFromPrefill } from '@/frontend/lib/messenger-imperative-dialogs'
import { isTeamBroadcastInboxMessage, teamBroadcastPurgeHint } from '@/frontend/lib/mailbox-purge-routing'
import { EinsatzInboxExplorerLink } from '@/frontend/components/einsatz-inbox-explorer-link'
import { EinsatzInboxMessageBadges } from '@/frontend/components/einsatz-inbox-message-badges'
import { useEinsatzInboxBadges } from '@/frontend/hooks/use-einsatz-inbox-badges'

function isRowMeshLike(msg: Message): boolean {
  if (msg.source === 'mesh') return true
  if (Array.isArray(msg.transports) && msg.transports.includes('mesh')) return true
  return false
}

function as0xAddress(v: string | undefined): string | undefined {
  const t = (v || '').trim()
  return /^0x[a-fA-F0-9]{64}$/i.test(t) ? t : undefined
}

function buildR1CourierPrefillFromMessage(msg: Message, myAddress: string) {
  const from = as0xAddress(msg.from)
  const me = as0xAddress(myAddress)
  const sender = from ?? me ?? ''
  const recipient = as0xAddress(msg.recipient) ?? ''
  return {
    builderSender: sender,
    builderRecipient: recipient,
    builderPayload: (msg.content ?? '').trim(),
  }
}

export type ChatViewInboxListProps = InboxFeedReadPort & {
  loadError: string | null
  /** true: Inbox wird aktuell aus lokalem Cache angezeigt (Live-Fetch fehlgeschlagen). */
  inboxFromCache?: boolean
  /** Alter des Cache-Snapshots in Minuten. */
  inboxCacheAgeMinutes?: number | null
  /** Letzter erfolgreicher Live-Ladepfad. */
  inboxLiveSource?: 'rpc' | 'api' | null
  /** GET /api/status derzeit nicht erreichbar (zusätzlicher Hinweis bei leerem Posteingang). */
  basisUnreachable?: boolean
  inboxRows: ChatInboxRow[]
  /** Kontaktverzeichnis für Anzeigenamen neben 0x… */
  contactDirectory: Record<string, ContactMeshEntryClient>
  isMeshVerifiedForAddress: (address: string) => boolean
  exportEcdhMorgPkgForMessage: (msg: Message) => void | Promise<void>
  onHideInboxMessageLocal: (id: string) => void
  onPurgeInboxMessageChain: (msg: Message) => void | Promise<void>
  /** Text ins Composer-Feld; optional mit Absenderzeile. */
  onForwardMessage?: (msg: Message, includeSender: boolean) => void
  /** H.32a: Kanal + Sendepfad für Antwort vorbereiten (sendet nicht). */
  onReplyToMessage?: (msg: Message) => void
  toggleProtokollMark: (id: string) => void
  protokollMarkedIds: Set<string>
  /** M3 Pinnwand: lokal anheften */
  pinnedPinnwandIds?: Set<string>
  onTogglePinnedPinnwand?: (id: string) => void
  showPinnwandPinActions?: boolean
  inboxSelectMode: boolean
  selectedInboxIds: Set<string>
  toggleInboxSelection: (id: string) => void
  /** Funk-Empfang: Banner schließen (Fortschritt/Fehler). */
  onDismissMeshInboundBanner?: (id: string) => void
  loadingMore?: boolean
  loadMoreInbox?: () => void
  inboxHasMore?: boolean
  /** Absender (0x…) ins Telefonbuch — POST /api/contact-label */
  onAddSenderToContactBook?: (address: string) => void | Promise<void>
  /** S-ARQ: `MORG_NAK_V1`-Wire über Meshtastic Klartext (Broadcast oder konfigurierte Node-ID). */
  onSarqNakWire?: (wire: string) => void | Promise<void>
  /** Filter versteckt geladene Mailbox/verschlüsselte Zeilen. */
  inboxVisibilityHint?: string | null
  isInboxMessageUnread?: (msg: Message) => boolean
  isPinnwandInboxMessage?: (msg: Message) => boolean
  /** § H.33 — RPC/Netz-Hinweis für Explorer-Links (optional). */
  einsatzRpcHint?: string
  /** Composer/Connect läuft — Antworten-Button sperren. */
  sending?: boolean
}

export function ChatViewInboxList(p: ChatViewInboxListProps) {
  const {
    loadError,
    inboxFromCache = false,
    inboxCacheAgeMinutes = null,
    inboxLiveSource = null,
    basisUnreachable = false,
    messages,
    inboxRows,
    myAddress,
    contactDirectory,
    isMeshVerifiedForAddress,
    exportEcdhMorgPkgForMessage,
    onHideInboxMessageLocal,
    onPurgeInboxMessageChain,
    onForwardMessage,
    onReplyToMessage,
    toggleProtokollMark,
    protokollMarkedIds,
    pinnedPinnwandIds = new Set(),
    onTogglePinnedPinnwand,
    showPinnwandPinActions = false,
    inboxSelectMode,
    selectedInboxIds,
    toggleInboxSelection,
    onDismissMeshInboundBanner,
    loadingMore = false,
    loadMoreInbox,
    inboxHasMore = false,
    onAddSenderToContactBook,
    onSarqNakWire,
    inboxVisibilityHint = null,
    isInboxMessageUnread,
    isPinnwandInboxMessage,
    einsatzRpcHint = '',
    sending = false,
  } = p

  const { getBadgesForMessage, getTxDigestForMessage, chainMode: einsatzChainMode } =
    useEinsatzInboxBadges(messages)

  const visibilityHintBanner = inboxVisibilityHint ? (
    <div className="p-3 pb-0">
      <div className="rounded-lg border border-sky-500/35 bg-sky-500/[0.08] px-3 py-2 text-sm text-sky-950 dark:text-sky-100">
        {inboxVisibilityHint}
      </div>
    </div>
  ) : null

  const loadErrorBanner = loadError ? (
    (() => {
      const formatted = formatInboxLoadError(loadError)
      const showOfflineDetail = formatted.headline === INBOX_BASIS_OFFLINE_HEADLINE
      return (
        <div className="p-6 pb-3">
          <div className="mx-auto max-w-lg rounded-xl border border-amber-500/40 bg-amber-500/[0.08] px-4 py-5 text-center dark:bg-amber-950/25">
            <p className="text-base font-semibold text-amber-950 dark:text-amber-100">{formatted.headline}</p>
            {showOfflineDetail ? (
              <p className="mt-2 text-sm leading-snug text-amber-900/90 dark:text-amber-100/90">
                Posteingang von der Basis nicht lesbar. Bereits empfangene Funk-Nachrichten erscheinen weiter unten, sobald
                vorhanden. Technische Meldung:
              </p>
            ) : null}
            {showOfflineDetail ? (
              <p className="mt-2 break-all text-sm text-muted-foreground">{formatted.detail}</p>
            ) : null}
            <p className="mt-4 text-xs text-muted-foreground">
              Wenn nicht alle Nachrichten sichtbar sind, bitte „Aktualisieren“.
            </p>
          </div>
        </div>
      )
    })()
  ) : null

  const cacheModeBanner =
    inboxFromCache === true ? (
      <div className="p-3 pb-0">
        <div className="mx-auto max-w-3xl rounded-xl border border-amber-500/45 bg-amber-500/[0.08] px-4 py-3 text-amber-950 dark:text-amber-100">
          <p className="text-sm font-semibold">
            Morgendrot-Basis nicht erreichbar — Posteingang aus Zwischenspeicher (vor{' '}
            {Math.max(0, Number(inboxCacheAgeMinutes ?? 0))} Min., TTL 30 Min.
            {inboxLiveSource === 'rpc' ? ', zuletzt per Direkt-RPC' : ''})
          </p>
          <p className="mt-1 text-xs text-amber-900/90 dark:text-amber-100/90">
            Live-Aktualisierung über den Server ist gerade nicht möglich.{' '}
            <strong className="font-semibold">IOTA senden/empfangen</strong> kann trotzdem per Direkt-RPC
            funktionieren — neue Nachrichten erscheinen oft sofort nach dem Senden.{' '}
            <strong className="font-semibold">Telegram</strong> und Team-Sync brauchen die erreichbare Basis.
            Funk (LoRa) läuft parallel weiter.
          </p>
        </div>
      </div>
    ) : null

  const rpcLiveBanner =
    inboxFromCache !== true && inboxLiveSource === 'rpc' ? (
      <div className="p-3 pb-0">
        <div className="mx-auto max-w-3xl rounded-xl border border-emerald-500/35 bg-emerald-500/[0.08] px-4 py-2.5 text-emerald-950 dark:text-emerald-100">
          <p className="text-xs font-medium">
            Posteingang live per <strong className="font-semibold">Direkt-RPC</strong> (Fullnode) — Morgendrot-Basis ist
            für diesen Abruf optional.
          </p>
        </div>
      </div>
    ) : null

  if (inboxRows.length === 0) {
    if (rpcLiveBanner) return rpcLiveBanner
    if (cacheModeBanner) return cacheModeBanner
    if (loadErrorBanner) return loadErrorBanner
    if (visibilityHintBanner) return visibilityHintBanner
    if (basisUnreachable) {
      return (
        <div className="p-6">
          <div className="mx-auto max-w-lg rounded-xl border border-amber-500/40 bg-amber-500/[0.08] px-4 py-5 text-center dark:bg-amber-950/25">
            <p className="text-base font-semibold text-amber-950 dark:text-amber-100">{INBOX_BASIS_OFFLINE_HEADLINE}</p>
            <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-100/90">
              Die Basis liefert derzeit keinen Status – vermutlich kein Netz zum Backend. Funk-Empfang kann trotzdem
              Nachrichten einblenden.
            </p>
          </div>
        </div>
      )
    }
    return (
      <div className="p-8 text-center">
        <MessageCircle className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
        <p className="text-muted-foreground">Noch keine Nachrichten</p>
        <p className="mt-1 text-xs text-muted-foreground">Mailbox/On-Chain – bei Tests: „Aktualisieren“ klicken.</p>
      </div>
    )
  }

  return (
    <>
    {rpcLiveBanner}
    {cacheModeBanner}
    {loadErrorBanner}
    {visibilityHintBanner}
    <ul className="space-y-3 p-3">
      {inboxRows.map((row) =>
        row.kind === 'meshInbound' ? (
          <li
            key={`mesh-in-${row.id}`}
            className="rounded-xl border border-dashed border-sky-500/35 bg-sky-500/[0.06] p-3 shadow-sm dark:bg-sky-950/20"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200">
                  Funk · Empfang
                </p>
                {row.fromAddr ? (
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {row.fromAddr.startsWith('0x')
                      ? `${row.fromAddr.slice(0, 8)}…${row.fromAddr.slice(-4)}`
                      : row.fromAddr}
                  </p>
                ) : null}
                {row.hint ? (
                  <p className="text-xs leading-snug text-sky-950/95 dark:text-sky-50/95">{row.hint}</p>
                ) : null}
                {row.error ? (
                  <p className="text-xs leading-snug text-red-800 dark:text-red-100/95">{row.error}</p>
                ) : null}
              </div>
              {onDismissMeshInboundBanner ? (
                <button
                  type="button"
                  onClick={() => onDismissMeshInboundBanner(row.id)}
                  className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  OK
                </button>
              ) : null}
            </div>
          </li>
        ) : row.kind === 'slide' ? (
          <li
            key={`slide-${row.key}`}
            className="rounded-xl border border-border bg-card/80 p-4 shadow-sm transition-colors hover:bg-accent/30"
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Slideshow ·{' '}
                <span className="font-mono text-foreground">
                  {row.key.length > 24 ? `${row.key.slice(0, 24)}…` : row.key}
                </span>
              </span>
              <time className="text-xs tabular-nums text-muted-foreground" dateTime={new Date(row.sortTs).toISOString()}>
                {new Date(row.sortTs).toLocaleString('de-DE')}
              </time>
            </div>
            <SlideShowCrossfade frames={row.frames} />
            <p className="mt-2 text-[11px] text-muted-foreground">MORG_SLIDE_V1 · CSS-Überblendung</p>
          </li>
        ) : (
          <li
            key={row.msg.id}
            id={`inbox-msg-${row.msg.id}`}
            className={cn(
              'rounded-xl border border-border bg-card/80 p-4 shadow-sm transition-colors hover:bg-accent/30',
              isPinnwandInboxMessage?.(row.msg) &&
                'border-l-4 border-l-orange-600 bg-orange-500/12 dark:bg-orange-500/15',
              isInboxMessageUnread?.(row.msg) &&
                !isPinnwandInboxMessage?.(row.msg) &&
                'border-l-4 border-l-red-500/80 bg-red-500/[0.04]',
              protokollMarkedIds.has(row.msg.id) && 'border-l-4 border-l-amber-500 bg-amber-500/[0.06]',
              pinnedPinnwandIds.has(row.msg.id) &&
                isPinnwandInboxMessage?.(row.msg) &&
                'ring-1 ring-orange-500/40'
            )}
          >
            {(() => {
              const fromLabel = contactDisplayLabel(contactDirectory, row.msg.from)
              const outgoingRow = myAddress.trim() ? isMessageOutgoing(row.msg, myAddress) : false
              const canAddContact =
                !!onAddSenderToContactBook &&
                !outgoingRow &&
                row.msg.from.startsWith('0x') &&
                row.msg.from.length >= 66
              return (
                <>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-3">
              {inboxSelectMode && (
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 rounded border-border"
                  checked={selectedInboxIds.has(row.msg.id)}
                  onChange={() => toggleInboxSelection(row.msg.id)}
                  aria-label="Nachricht auswählen"
                />
              )}
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex gap-0.5 rounded-md bg-muted/80 px-1.5 py-0.5" title="Transport">
                    {(row.msg.transports?.length
                      ? row.msg.transports
                      : row.msg.source === 'mesh'
                        ? (['mesh'] as const)
                        : (['internet'] as const)
                    ).map((t) => (
                      <span key={t} className="select-none text-sm" aria-hidden>
                        {t === 'internet'
                          ? '🌍'
                          : t === 'mesh'
                            ? '📡'
                            : t === 'telegram'
                              ? '✈️'
                              : '📱'}
                      </span>
                    ))}
                  </span>
                  <span className="font-mono text-xs font-medium text-foreground">
                    {row.msg.from.startsWith('0x')
                      ? `${row.msg.from.slice(0, 8)}…${row.msg.from.slice(-4)}`
                      : row.msg.from}
                  </span>
                  {fromLabel ? (
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      {fromLabel}
                    </span>
                  ) : null}
                  {isMeshVerifiedForAddress(row.msg.from) && (
                    <span className="inline-flex items-center text-emerald-500" title="Mesh im Kontaktverzeichnis">
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </span>
                  )}
                  {row.msg.encrypted && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                      <Lock className="h-3 w-3" aria-hidden />
                      Verschlüsselt
                    </span>
                  )}
                  {row.msg.chainPurgeable && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-800 dark:text-violet-300">
                      {isTeamBroadcastInboxMessage(row.msg) ? 'Team-Broadcast' : 'Mailbox'}
                    </span>
                  )}
                  <EinsatzInboxMessageBadges badges={getBadgesForMessage(row.msg)} />
                  {getTxDigestForMessage(row.msg) ? (
                    <EinsatzInboxExplorerLink
                      txDigest={getTxDigestForMessage(row.msg)!}
                      chainMode={einsatzChainMode}
                      rpcHint={einsatzRpcHint}
                    />
                  ) : null}
                  {protokollMarkedIds.has(row.msg.id) && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:text-amber-100">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-600 dark:text-amber-300" aria-hidden />
                      Protokoll
                    </span>
                  )}
                  {pinnedPinnwandIds.has(row.msg.id) && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold text-sky-900 dark:text-sky-100">
                      <Pin className="h-3 w-3 text-sky-600 dark:text-sky-300" aria-hidden />
                      Angeheftet
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <time className="tabular-nums" dateTime={new Date(row.msg.timestamp).toISOString()}>
                    {new Date(row.msg.timestamp).toLocaleString('de-DE')}
                  </time>
                  {myAddress.trim() ? (
                    <span
                      className={cn(
                        'rounded-md px-2 py-0.5 font-medium',
                        isMessageOutgoing(row.msg, myAddress)
                          ? 'bg-sky-500/15 text-sky-800 dark:text-sky-200'
                          : 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
                      )}
                    >
                      {isMessageOutgoing(row.msg, myAddress) ? 'Ausgang' : 'Eingang'}
                    </span>
                  ) : null}
                  {row.msg.recipient ? (
                    <span className="rounded-md bg-muted px-2 py-0.5 font-medium text-foreground/80">
                      {myAddress && addressMatchesIdentity(row.msg.recipient, myAddress)
                        ? 'An mich'
                        : formatTelegramOutboundRecipientLine(
                            telegramOutboundCounterpartyKeys(row.msg)
                          ) ??
                          `An ${row.msg.recipient.slice(0, 8)}…${row.msg.recipient.slice(-4)}`}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {onReplyToMessage ? (
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => onReplyToMessage(row.msg)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-primary/35 bg-primary/10 px-2.5 text-[11px] font-semibold text-primary hover:bg-primary/20 disabled:opacity-50"
                    title="Antworten — Kanal und Sendepfad werden übernommen"
                  >
                    <Reply className="h-3.5 w-3.5" aria-hidden />
                    Antworten
                  </button>
                ) : null}
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Aktionen für diese Nachricht"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    disabled={!canAddContact}
                    title={
                      canAddContact
                        ? undefined
                        : 'Nur bei eingehenden Zeilen mit gültiger 0x-Absenderadresse (nicht eigene Ausgänge).'
                    }
                    onClick={() => {
                      if (!canAddContact || !onAddSenderToContactBook) return
                      void onAddSenderToContactBook(row.msg.from)
                    }}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Ins Telefonbuch
                  </DropdownMenuItem>
                  {showPinnwandPinActions && onTogglePinnedPinnwand ? (
                    <DropdownMenuItem onClick={() => onTogglePinnedPinnwand(row.msg.id)}>
                      <Pin
                        className={cn(
                          'mr-2 h-4 w-4',
                          pinnedPinnwandIds.has(row.msg.id) ? 'text-sky-600 dark:text-sky-300' : ''
                        )}
                      />
                      {pinnedPinnwandIds.has(row.msg.id) ? 'Anheftung lösen' : 'An Pinnwand anheften'}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem onClick={() => toggleProtokollMark(row.msg.id)}>
                    <Star
                      className={cn(
                        'mr-2 h-4 w-4',
                        protokollMarkedIds.has(row.msg.id) ? 'fill-amber-400 text-amber-500' : ''
                      )}
                    />
                    {protokollMarkedIds.has(row.msg.id) ? 'Protokoll-Markierung entfernen' : 'Für Protokoll markieren'}
                  </DropdownMenuItem>
                  {onForwardMessage ? (
                    <>
                      <DropdownMenuItem onClick={() => onForwardMessage(row.msg, true)}>
                        <Forward className="mr-2 h-4 w-4" />
                        Weiterleiten (mit Absenderzeile)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onForwardMessage(row.msg, false)}>
                        <Forward className="mr-2 h-4 w-4" />
                        Weiterleiten (ohne Absenderadresse)
                      </DropdownMenuItem>
                    </>
                  ) : null}
                  {isRowMeshLike(row.msg) ? (
                    <>
                      <DropdownMenuItem
                        onClick={() => {
                          openR1CourierDialogFromPrefill(buildR1CourierPrefillFromMessage(row.msg, myAddress))
                        }}
                        title="R1-Kurier: Text und 0x-Adressen aus dieser Funk-Zeile vorfüllen (Signatur und Paket erzeugen im Dialog)."
                      >
                        <Package className="mr-2 h-4 w-4 opacity-80" />
                        Paket teilen
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          openProtokollAnchorDialogFromPrefill({ messageIds: [row.msg.id], variant: 'hash' })
                        }}
                        title="Protokoll-Hash-Verankerung: nur diese Nachrichten-ID, Variante A (nur Hash)."
                      >
                        <Link2 className="mr-2 h-4 w-4 opacity-80" />
                        Paket in den Tangle schreiben
                      </DropdownMenuItem>
                    </>
                  ) : null}
                  <DropdownMenuItem onClick={() => onHideInboxMessageLocal(row.msg.id)}>
                    <MessageCircle className="mr-2 h-4 w-4 opacity-60" />
                    Lokal ausblenden
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!row.msg.chainPurgeable}
                    title={teamBroadcastPurgeHint(row.msg, myAddress) ?? undefined}
                    onClick={() => void onPurgeInboxMessageChain(row.msg)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Auf Chain löschen (Rebate)
                  </DropdownMenuItem>
                  {parseHandoffZipWire(row.msg.content ?? '') ? (
                    <DropdownMenuItem
                      onClick={() => {
                        const parsed = parseHandoffZipWire(row.msg.content ?? '')
                        if (!parsed) return
                        queueHandoffZipFromInbox(parsed.zipBytes, parsed.meta)
                      }}
                      title="Handoff-ZIP in Einstellungen → Handoff importieren übernehmen"
                    >
                      <Inbox className="mr-2 h-4 w-4" />
                      Handoff importieren
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem onClick={() => void exportEcdhMorgPkgForMessage(row.msg)}>
                    <Lock className="mr-2 h-4 w-4" />
                    ECDH .morg-pkg speichern
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadSneakernetPackage(row.msg)}>
                    <Download className="mr-2 h-4 w-4" />
                    JSON (Klartext-Snapshot)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </div>
            </div>
            <ChatMessageBody
              content={row.msg.content ?? ''}
              inboxMessages={messages}
              selfMessage={row.msg}
              onSarqNakWire={onSarqNakWire}
            />
                </>
              )
            })()}
          </li>
        )
      )}
    </ul>
      {loadMoreInbox && (inboxHasMore || messages.length >= 50) ? (
        <div className="border-t border-border/70 p-3 flex justify-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={loadMoreInbox}
            className="rounded-lg border border-border bg-muted/40 px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-60"
          >
            {loadingMore ? 'Lade ältere Nachrichten…' : 'Weitere Nachrichten laden'}
          </button>
        </div>
      ) : null}
    </>
  )
}
