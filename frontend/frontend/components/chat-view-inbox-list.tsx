'use client'

/**
 * Inbox list: renders mailbox + mesh-merged messages as rows (plain messages + slideshow groups).
 *
 * **Meshtastic (möglichst 1:1):** Funkpfad = Standard Meshtastic (Routing, Store-and-Forward, BLE zum Host).
 * Diese Komponente zeigt nur bereits zusammengeführte `Message`-Objekte – kein eigenes Mesh-Routing.
 *
 * **Morgendrot / Eigenlogik:** IOTA-Mailbox-Fetch und Merge mit lokalen Mesh-Nachrichten (`loadMessages` in der View),
 * MORG_*-Wire-Darstellung in `ChatMessageBody`, Slideshow aus `MORG_SLIDE_V1`, LoRa Luma/Chroma-Korrelation in
 * `buildChatInboxRows`, Export (.morg-pkg, JSON-Snapshot) in den Aktionen.
 *
 * Details zum Baukasten: `docs/MESHTASTIC-BUILDING-BLOCKS.md`
 *
 * Wird von `ChatViewInboxPanel` zusammen mit `ChatViewInboxToolbar` eingebunden.
 */

import {
  Download,
  Forward,
  Lock,
  MessageCircle,
  MoreHorizontal,
  ShieldCheck,
  Star,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChatMessageBody } from '@/frontend/components/chat-message-body'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SlideShowCrossfade } from '@/frontend/components/slide-show-crossfade'
import type { ChatInboxRow } from '@/frontend/lib/chat-view-inbox-rows'
import { downloadSneakernetPackage } from '@/frontend/lib/sneakernet-export'
import type { Message } from '@/frontend/lib/types'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { contactDisplayLabel } from '@/frontend/lib/contact-display'
import { formatInboxLoadError, INBOX_BASIS_OFFLINE_HEADLINE } from '@/frontend/lib/inbox-load-error'
import { addressMatchesIdentity, isMessageOutgoing } from '@/frontend/lib/inbox-partner-filter'

export type ChatViewInboxListProps = {
  loadError: string | null
  /** GET /api/status derzeit nicht erreichbar (zusätzlicher Hinweis bei leerem Posteingang). */
  basisUnreachable?: boolean
  messages: Message[]
  inboxRows: ChatInboxRow[]
  myAddress: string
  /** Kontaktverzeichnis für Anzeigenamen neben 0x… */
  contactDirectory: Record<string, ContactMeshEntryClient>
  isMeshVerifiedForAddress: (address: string) => boolean
  exportEcdhMorgPkgForMessage: (msg: Message) => void | Promise<void>
  onHideInboxMessageLocal: (id: string) => void
  onPurgeInboxMessageChain: (msg: Message) => void | Promise<void>
  /** Text ins Composer-Feld; optional mit Absenderzeile. */
  onForwardMessage?: (msg: Message, includeSender: boolean) => void
  toggleProtokollMark: (id: string) => void
  protokollMarkedIds: Set<string>
  inboxSelectMode: boolean
  selectedInboxIds: Set<string>
  toggleInboxSelection: (id: string) => void
  /** Funk-Empfang: Banner schließen (Fortschritt/Fehler). */
  onDismissMeshInboundBanner?: (id: string) => void
  loadingMore?: boolean
  loadMoreInbox?: () => void
  inboxHasMore?: boolean
}

export function ChatViewInboxList(p: ChatViewInboxListProps) {
  const {
    loadError,
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
    toggleProtokollMark,
    protokollMarkedIds,
    inboxSelectMode,
    selectedInboxIds,
    toggleInboxSelection,
    onDismissMeshInboundBanner,
    loadingMore = false,
    loadMoreInbox,
    inboxHasMore = false,
  } = p

  if (loadError) {
    const formatted = formatInboxLoadError(loadError)
    return (
      <div className="p-6">
        <div className="mx-auto max-w-lg rounded-xl border border-amber-500/40 bg-amber-500/[0.08] px-4 py-5 text-center dark:bg-amber-950/25">
          <p className="text-base font-semibold text-amber-950 dark:text-amber-100">{formatted.headline}</p>
          {formatted.headline === INBOX_BASIS_OFFLINE_HEADLINE ? (
            <p className="mt-2 text-sm leading-snug text-amber-900/90 dark:text-amber-100/90">
              Posteingang von der Basis nicht lesbar. Bereits empfangene Funk-Nachrichten erscheinen weiter unten, sobald
              vorhanden. Technische Meldung:
            </p>
          ) : null}
          <p className="mt-2 break-all text-sm text-muted-foreground">{formatted.detail}</p>
          <p className="mt-4 text-xs text-muted-foreground">
            Prüfe: Backend läuft, MAILBOX_ID und PACKAGE_ID in .env, ggf. Tor/SOCKS. Danach „Aktualisieren“.
          </p>
        </div>
      </div>
    )
  }

  if (inboxRows.length === 0) {
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
            className="rounded-xl border border-border bg-card/80 p-4 shadow-sm transition-colors hover:bg-accent/30"
          >
            {(() => {
              const fromLabel = contactDisplayLabel(contactDirectory, row.msg.from)
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
                        {t === 'internet' ? '🌍' : t === 'mesh' ? '📡' : '📱'}
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
                        : `An ${row.msg.recipient.slice(0, 8)}…${row.msg.recipient.slice(-4)}`}
                    </span>
                  ) : null}
                </div>
              </div>
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
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Forward className="mr-2 h-4 w-4" />
                        Weiterleiten
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-56">
                        <DropdownMenuItem onClick={() => onForwardMessage(row.msg, true)}>
                          Mit Absenderzeile
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onForwardMessage(row.msg, false)}>
                          Ohne Absenderadresse
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  ) : null}
                  <DropdownMenuItem onClick={() => onHideInboxMessageLocal(row.msg.id)}>
                    <MessageCircle className="mr-2 h-4 w-4 opacity-60" />
                    Lokal ausblenden
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!row.msg.chainPurgeable}
                    onClick={() => void onPurgeInboxMessageChain(row.msg)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Auf Chain löschen (Rebate)
                  </DropdownMenuItem>
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
            <ChatMessageBody content={row.msg.content ?? ''} inboxMessages={messages} selfMessage={row.msg} />
                </>
              )
            })()}
          </li>
        )
      )}
    </ul>
      {loadMoreInbox && inboxHasMore ? (
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
