'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  FileText,
  Headphones,
  Image as ImageIcon,
  Link2,
  MessageSquareText,
  Mic,
  Video,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ContactPhonebookCard } from '@/frontend/components/contact-phonebook-card'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import type { Message } from '@/frontend/lib/types'
import { countConversationMediaStats, firstMessageIdForMediaKind, type InboxConversationMediaStats } from '@/frontend/lib/inbox-conversation-media-stats'
import { lookupContactEntry } from '@/frontend/lib/contact-display'
import { messagesForContactConversation } from '@/frontend/lib/contact-conversation-filter'
import { parseCompactImageMessage } from '@/frontend/lib/compact-image-wire'
import { reconstructCompactImageToDataUrlWithMeta } from '@/frontend/lib/compact-image-canvas'
import { resolveContactSidebarDisplayName } from '@/frontend/lib/conversation-sidebar-items'
import {
  contactHasAnyMailboxSlot,
  readContactMailboxSlots,
  readProfileContactMailboxSlotOverride,
} from '@/frontend/lib/contact-mailbox-slots'
import { buildContactInfoSections } from '@/frontend/lib/messenger-entity-info-model'
import { CONTACT_PHONEBOOK_META_CHANGED_EVENT, readContactNotes } from '@/frontend/lib/contact-phonebook-meta-store'
import { TechnicalIdRow, TechnicalIdSection } from '@/frontend/components/technical-id-row'

export type ChatViewContactDetailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  address: string | null
  entry?: ContactMeshEntryClient
  directory: Record<string, ContactMeshEntryClient>
  messages: readonly Message[]
  myAddress: string
  connectedAddresses?: string[]
  isFavorite: boolean
  onToggleFavorite: () => void
  onEdit: () => void
  onShowQr: () => void
  onRemove: () => void
  onSelectForMessenger?: () => void
  /** Aktive Package-ID (Settings / ApiStatus) — nur Anzeige. */
  packageId?: string
  /** Medienzeile tippen → Nachricht im Posteingang fokussieren. */
  onFocusMessage?: (messageId: string) => void
}

function MediaStatRow(p: {
  icon: React.ReactNode
  label: string
  count: number
  onClick?: () => void
}) {
  if (p.count <= 0) return null
  const inner = (
    <>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
        {p.icon}
      </span>
      <span className="text-sm text-foreground">
        <strong>{p.count}</strong> {p.label}
      </span>
    </>
  )
  if (p.onClick) {
    return (
      <button
        type="button"
        onClick={p.onClick}
        className="flex w-full items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
      >
        {inner}
      </button>
    )
  }
  return <div className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5">{inner}</div>
}

function MediaStatsPanel(p: {
  stats: InboxConversationMediaStats
  textCount: number
  onFocusText?: () => void
  onFocusMediaKind?: (kind: keyof InboxConversationMediaStats) => void
}) {
  const rows = [
    { icon: <MessageSquareText className="h-4 w-4" />, label: 'Textnachrichten', count: p.textCount, kind: null as null | keyof InboxConversationMediaStats },
    { icon: <ImageIcon className="h-4 w-4" />, label: 'Fotos', count: p.stats.photos, kind: 'photos' as const },
    { icon: <Video className="h-4 w-4" />, label: 'Videos', count: p.stats.videos, kind: 'videos' as const },
    { icon: <FileText className="h-4 w-4" />, label: 'Dateien', count: p.stats.files, kind: 'files' as const },
    { icon: <Headphones className="h-4 w-4" />, label: 'Audiodateien', count: p.stats.audioFiles, kind: 'audioFiles' as const },
    { icon: <Link2 className="h-4 w-4" />, label: 'Geteilte Links', count: p.stats.sharedLinks, kind: 'sharedLinks' as const },
    { icon: <BarChart3 className="h-4 w-4" />, label: 'Umfragen', count: p.stats.polls, kind: 'polls' as const },
    { icon: <Mic className="h-4 w-4" />, label: 'Sprachnachrichten', count: p.stats.voiceMessages, kind: 'voiceMessages' as const },
    { icon: <ImageIcon className="h-4 w-4" />, label: 'GIFs', count: p.stats.gifs, kind: 'gifs' as const },
  ].filter((r) => r.count > 0)

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Noch keine Nachrichten in diesem Verlauf.</p>
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {rows.map((r) => (
        <MediaStatRow
          key={r.label}
          icon={r.icon}
          label={r.label}
          count={r.count}
          onClick={
            r.kind == null
              ? p.onFocusText
              : p.onFocusMediaKind
                ? () => p.onFocusMediaKind?.(r.kind!)
                : undefined
          }
        />
      ))}
    </div>
  )
}

function ConversationPhotoThumbnails(p: {
  messages: readonly Message[]
  onOpenMessage?: (messageId: string) => void
}) {
  const candidates = useMemo(() => {
    const out: { id: string; dataUrl?: string; label: string }[] = []
    for (const m of p.messages) {
      const content = `${m.content ?? ''}`
      const dataMatch = content.match(/data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/i)
      if (dataMatch) {
        out.push({ id: m.id, dataUrl: dataMatch[0], label: 'Foto' })
        continue
      }
      if (parseCompactImageMessage(content)) {
        out.push({ id: m.id, label: 'Bild' })
      }
    }
    return out.slice(0, 12)
  }, [p.messages])

  const [urls, setUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    let alive = true
    void (async () => {
      const next: Record<string, string> = {}
      for (const c of candidates) {
        if (c.dataUrl) {
          next[c.id] = c.dataUrl
          continue
        }
        const msg = p.messages.find((m) => m.id === c.id)
        if (!msg) continue
        const parsed = parseCompactImageMessage(`${msg.content ?? ''}`)
        if (!parsed) continue
        try {
          const r = await reconstructCompactImageToDataUrlWithMeta(parsed.blobBase64)
          if (r.dataUrl) next[c.id] = r.dataUrl
        } catch {
          /* Vorschau optional */
        }
      }
      if (alive) setUrls(next)
    })()
    return () => {
      alive = false
    }
  }, [candidates, p.messages])

  if (candidates.length === 0) return null

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {candidates.map((c) => {
        const src = urls[c.id]
        return (
          <button
            key={c.id}
            type="button"
            className="aspect-square overflow-hidden rounded-lg border border-border/60 bg-muted/30 transition-colors hover:ring-2 hover:ring-primary/40"
            title={c.label}
            onClick={() => p.onOpenMessage?.(c.id)}
          >
            {src ? (
              <img src={src} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <ImageIcon className="h-6 w-6" />
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function ChatViewContactDetailDialog(p: ChatViewContactDetailDialogProps) {
  const address = p.address?.trim() ?? ''
  const entry = p.entry ?? (address ? lookupContactEntry(p.directory, address) : undefined)
  const displayName = address
    ? resolveContactSidebarDisplayName(p.directory, address, entry)
    : ''
  const [techOpen, setTechOpen] = useState(false)
  const [notesRev, setNotesRev] = useState(0)
  useEffect(() => {
    const bump = () => setNotesRev((n) => n + 1)
    window.addEventListener(CONTACT_PHONEBOOK_META_CHANGED_EVENT, bump)
    return () => window.removeEventListener(CONTACT_PHONEBOOK_META_CHANGED_EVENT, bump)
  }, [])
  const localNote = useMemo(() => {
    void notesRev
    return address ? readContactNotes()[address.trim().toLowerCase()] : undefined
  }, [address, notesRev])

  const conversationMessages = useMemo(() => {
    if (!address || !p.myAddress.trim()) return []
    return messagesForContactConversation(p.messages, p.myAddress, address, entry, p.directory)
  }, [address, p.messages, p.myAddress, entry, p.directory])

  const mediaStats = useMemo(() => countConversationMediaStats(conversationMessages), [conversationMessages])
  const textCount = useMemo(() => {
    const mediaLike =
      mediaStats.photos +
      mediaStats.videos +
      mediaStats.files +
      mediaStats.audioFiles +
      mediaStats.voiceMessages +
      mediaStats.polls +
      mediaStats.gifs
    return Math.max(0, conversationMessages.length - mediaLike)
  }, [conversationMessages.length, mediaStats])

  const connectedSet = useMemo(
    () => new Set((p.connectedAddresses ?? []).map((a) => a.trim().toLowerCase())),
    [p.connectedAddresses]
  )

  const infoSections = useMemo(() => {
    if (!address) return []
    return buildContactInfoSections({
      address,
      entry,
      slotOverrides: {
        ...readContactMailboxSlots(entry),
        ...readProfileContactMailboxSlotOverride(address),
      },
      messages: conversationMessages,
      packageId: p.packageId,
    })
  }, [address, entry, conversationMessages, p.packageId])

  if (!address) return null

  const hasLora = Boolean(entry?.meshNodeId?.trim())
  const hasPrivateMailbox = entry ? contactHasAnyMailboxSlot(entry, address) : false
  const loraOnly = hasLora && !connectedSet.has(address.toLowerCase())

  const focusFirst = () => {
    const first = conversationMessages[0]
    if (first) {
      p.onFocusMessage?.(first.id)
      p.onOpenChange(false)
    }
  }

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{displayName}</DialogTitle>
          <DialogDescription>Adresse, Sendepfade und Medien. Technische Mailbox-IDs unter Mehr.</DialogDescription>
        </DialogHeader>

        <section className="space-y-2 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Adresse</p>
          <p className="break-all font-mono text-xs text-foreground">{address}</p>
          <p className="pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Sendepfade
          </p>
          <ul className="space-y-1 text-sm text-foreground">
            <li>Online / IOTA — diese 0x-Adresse</li>
            <li>
              {entry?.meshNodeId?.trim()
                ? `Funk — Node ${entry.meshNodeId.trim()}`
                : 'Funk — keine Node-ID im Telefonbuch'}
            </li>
            <li>
              {entry?.telegramChatId?.trim()
                ? `Telegram — Chat-ID ${entry.telegramChatId.trim()}`
                : 'Telegram — keine Chat-ID im Telefonbuch'}
            </li>
          </ul>
        </section>

        {entry ? (
          <ContactPhonebookCard
            address={address}
            entry={entry}
            displayName={displayName}
            isFavorite={p.isFavorite}
            isOnline={connectedSet.has(address.toLowerCase())}
            hasLora={hasLora}
            hasPrivateMailbox={hasPrivateMailbox}
            loraOnly={loraOnly}
            expanded
            onToggleExpand={() => undefined}
            onToggleFavorite={p.onToggleFavorite}
            onEdit={p.onEdit}
            onShowQr={p.onShowQr}
            onRemove={p.onRemove}
            onRecordContact={() => undefined}
            onSelectForMessenger={p.onSelectForMessenger}
            hideChannelIds
            note={localNote}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Kein Telefonbuch-Eintrag — nur Adresse bekannt.</p>
        )}

        <section className="space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-foreground">Geteilte Medien &amp; Inhalte</h3>
          <p className="text-xs text-muted-foreground">
            {conversationMessages.length}{' '}
            {conversationMessages.length === 1 ? 'Nachricht' : 'Nachrichten'} in diesem 1:1-Verlauf.
          </p>
          <ConversationPhotoThumbnails
            messages={conversationMessages}
            onOpenMessage={(id) => {
              p.onFocusMessage?.(id)
              p.onOpenChange(false)
            }}
          />
          <MediaStatsPanel
            stats={mediaStats}
            textCount={textCount}
            onFocusText={conversationMessages.length > 0 ? focusFirst : undefined}
            onFocusMediaKind={
              p.onFocusMessage
                ? (kind) => {
                    const id = firstMessageIdForMediaKind(conversationMessages, kind)
                    if (!id) return
                    p.onFocusMessage?.(id)
                    p.onOpenChange(false)
                  }
                : undefined
            }
          />
        </section>

        <section className="border-t border-border pt-4">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-left text-sm font-semibold text-foreground hover:bg-muted/40"
            onClick={() => setTechOpen((v) => !v)}
            aria-expanded={techOpen}
          >
            <span>Mehr — Identität &amp; Mailboxen</span>
            {techOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          {techOpen ? (
            <div className="mt-3 space-y-4">
              {infoSections.map((section) => (
                <TechnicalIdSection key={section.id} title={section.title}>
                  {section.fields.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">{section.note ?? '—'}</p>
                  ) : (
                    <>
                      {section.fields.map((f) => (
                        <TechnicalIdRow
                          key={f.id}
                          label={f.label}
                          value={f.value}
                          copyable={f.copyable}
                          hint={f.hint}
                          href={f.href}
                          hrefLabel={f.hrefLabel}
                        />
                      ))}
                      {section.note ? (
                        <p className="border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
                          {section.note}
                        </p>
                      ) : null}
                    </>
                  )}
                </TechnicalIdSection>
              ))}
            </div>
          ) : null}
        </section>
      </DialogContent>
    </Dialog>
  )
}
