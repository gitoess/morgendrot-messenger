'use client'

import { useMemo } from 'react'
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
  messagesForConversationFilter,
  type InboxConversationMediaStats,
} from '@/frontend/lib/inbox-conversation-media-stats'
import { resolveContactSidebarDisplayName } from '@/frontend/lib/conversation-sidebar-items'
import { contactHasAnyMailboxSlot } from '@/frontend/lib/contact-mailbox-slots'

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

export function ChatViewContactDetailDialog(p: ChatViewContactDetailDialogProps) {
  const address = p.address?.trim() ?? ''
  const entry = p.entry ?? (address ? p.directory[address] : undefined)
  const displayName = address
    ? resolveContactSidebarDisplayName(p.directory, address, entry)
    : ''

  const conversationMessages = useMemo(() => {
    if (!address || !p.myAddress.trim()) return []
    return messagesForConversationFilter(p.messages, p.myAddress, address)
  }, [address, p.messages, p.myAddress])

  const mediaStats = useMemo(() => countConversationMediaStats(conversationMessages), [conversationMessages])

  const connectedSet = useMemo(
    () => new Set((p.connectedAddresses ?? []).map((a) => a.trim().toLowerCase())),
    [p.connectedAddresses]
  )

  if (!address) return null

  const hasLora = Boolean(entry?.meshNodeId?.trim())
  const hasPrivateMailbox = entry ? contactHasAnyMailboxSlot(entry) : false
  const loraOnly = hasLora && !connectedSet.has(address.toLowerCase())

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{displayName}</DialogTitle>
          <DialogDescription>Kontaktdaten und geteilte Inhalte aus dem Nachrichtenverlauf.</DialogDescription>
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

        <section className="space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-foreground">Geteilte Medien &amp; Inhalte</h3>
          <p className="text-xs text-muted-foreground">
            {conversationMessages.length} Nachrichten im Verlauf mit diesem Kontakt.
          </p>
          <MediaStatsPanel stats={mediaStats} />
        </section>
      </DialogContent>
    </Dialog>
  )
}
