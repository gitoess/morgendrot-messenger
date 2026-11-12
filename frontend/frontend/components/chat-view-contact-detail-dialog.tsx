'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  FileText,
  Headphones,
  Image as ImageIcon,
  Link2,
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
import {
  countConversationMediaStats,
  type InboxConversationMediaStats,
} from '@/frontend/lib/inbox-conversation-media-stats'
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
}

function MediaStatRow(p: { icon: React.ReactNode; label: string; count: number }) {
  if (p.count <= 0) return null
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">{p.icon}</span>
      <span className="text-sm text-foreground">
        <strong>{p.count}</strong> {p.label}
      </span>
    </div>
  )
}

function MediaStatsPanel({ stats }: { stats: InboxConversationMediaStats }) {
  const rows = [
    { icon: <ImageIcon className="h-4 w-4" />, label: 'Fotos', count: stats.photos },
    { icon: <Video className="h-4 w-4" />, label: 'Videos', count: stats.videos },
    { icon: <FileText className="h-4 w-4" />, label: 'Dateien', count: stats.files },
    { icon: <Headphones className="h-4 w-4" />, label: 'Audiodateien', count: stats.audioFiles },
    { icon: <Link2 className="h-4 w-4" />, label: 'Geteilte Links', count: stats.sharedLinks },
    { icon: <BarChart3 className="h-4 w-4" />, label: 'Umfragen', count: stats.polls },
    { icon: <Mic className="h-4 w-4" />, label: 'Sprachnachrichten', count: stats.voiceMessages },
    { icon: <ImageIcon className="h-4 w-4" />, label: 'GIFs', count: stats.gifs },
  ].filter((r) => r.count > 0)

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Noch keine geteilten Medien in diesem Verlauf.</p>
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {rows.map((r) => (
        <MediaStatRow key={r.label} icon={r.icon} label={r.label} count={r.count} />
      ))}
    </div>
  )
}

function ConversationPhotoThumbnails(p: { messages: readonly Message[] }) {
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
          <div
            key={c.id}
            className="aspect-square overflow-hidden rounded-lg border border-border/60 bg-muted/30"
            title={c.label}
          >
            {src ? (
              <img src={src} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <ImageIcon className="h-6 w-6" />
              </div>
            )}
          </div>
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

  const conversationMessages = useMemo(() => {
    if (!address || !p.myAddress.trim()) return []
    return messagesForContactConversation(p.messages, p.myAddress, address, entry, p.directory)
  }, [address, p.messages, p.myAddress, entry, p.directory])

  const mediaStats = useMemo(() => countConversationMediaStats(conversationMessages), [conversationMessages])

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

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{displayName}</DialogTitle>
          <DialogDescription>
            Info: IDs, Mailboxen und geteilte Inhalte — ohne in den Einstellungen zu suchen.
          </DialogDescription>
        </DialogHeader>

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
          />
        ) : (
          <p className="font-mono text-xs text-muted-foreground break-all">{address}</p>
        )}

        {infoSections.map((section) => (
          <TechnicalIdSection
            key={section.id}
            title={section.title}
            className="border-t border-border pt-4"
          >
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

        <section className="space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-foreground">Geteilte Medien &amp; Inhalte</h3>
          <p className="text-xs text-muted-foreground">
            {conversationMessages.length}{' '}
            {conversationMessages.length === 1 ? 'Nachricht' : 'Nachrichten'} in diesem 1:1-Verlauf (IOTA, Funk,
            Telegram).
          </p>
          <ConversationPhotoThumbnails messages={conversationMessages} />
          <MediaStatsPanel stats={mediaStats} />
        </section>
      </DialogContent>
    </Dialog>
  )
}
