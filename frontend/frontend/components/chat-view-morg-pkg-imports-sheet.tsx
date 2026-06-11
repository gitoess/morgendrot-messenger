'use client'

import { useState } from 'react'
import { ExternalLink, FileDown, Package, Share2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ChatMessageBody } from '@/frontend/components/chat-message-body'
import type { MorgPkgImportRecord } from '@/frontend/lib/morg-pkg-import-store'
import { openMorgPkgArchiveItem } from '@/frontend/lib/morg-pkg-open-archive-item'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'
import { contactDisplayLabel } from '@/frontend/lib/contact-display'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import type { Message } from '@/frontend/lib/types'

export type ChatViewMorgPkgImportsSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  records: MorgPkgImportRecord[]
  contactDirectory: Record<string, ContactMeshEntryClient>
  onRemove: (id: string) => void
  onForwardItem: (sender: string, item: MorgPkgImportRecord['items'][number]) => void
}

function fakeMessage(sender: string, content: string, ts: number): Message {
  return {
    id: `morg-arch-${ts}`,
    from: sender,
    content,
    timestamp: ts,
    encrypted: true,
    transports: ['adhoc'],
  }
}

export function ChatViewMorgPkgImportsSheet(p: ChatViewMorgPkgImportsSheetProps) {
  const { open, onOpenChange, records, contactDirectory, onRemove, onForwardItem } = p
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const runOpen = async (recordId: string, idx: number, mode: 'open' | 'save') => {
    const rec = records.find((r) => r.id === recordId)
    const item = rec?.items[idx]
    if (!item) return
    const key = `${recordId}-${idx}-${mode}`
    setBusyKey(key)
    const r = await openMorgPkgArchiveItem(item, mode)
    setBusyKey(null)
    if (!r.ok) toast.error(r.error)
    else if (mode === 'save') toast.success('Datei gespeichert.')
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="shrink-0 border-b border-border px-4 py-4 text-left">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Package className="h-5 w-5 text-primary" aria-hidden />
            Paket-Archiv
          </SheetTitle>
          <SheetDescription>
            Importierte .morg-pkg — Vorschau hier, Bilder und Texte per „Öffnen“ bzw. „Speichern“ als Datei (nicht
            Composer).
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Pakete. Unter Posteingang → <strong className="text-foreground">Pakete</strong> → Import.
            </p>
          ) : (
            records.map((rec) => {
              const senderLabel =
                contactDisplayLabel(contactDirectory, rec.sender) ||
                (rec.sender.startsWith('0x') ? maskWalletAddress(rec.sender, 10, 8) : rec.sender)
              return (
                <article key={rec.id} className="rounded-xl border border-border bg-card p-3 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{senderLabel}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {rec.items.length} Eintrag{rec.items.length === 1 ? '' : 'e'}
                        {rec.fileName ? ` · ${rec.fileName}` : ''} ·{' '}
                        {new Date(rec.importedAt).toLocaleString('de-DE')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(rec.id)}
                      className="shrink-0 rounded-lg border border-border p-2 hover:bg-muted"
                      title="Aus Archiv entfernen"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <ul className="space-y-3">
                    {rec.items.map((item, idx) => {
                      const busyOpen = busyKey === `${rec.id}-${idx}-open`
                      const busySave = busyKey === `${rec.id}-${idx}-save`
                      return (
                        <li key={`${rec.id}-${idx}`} className="rounded-lg border border-border/70 bg-muted/20 p-2">
                          <p className="mb-1.5 text-xs font-medium text-muted-foreground">{item.label}</p>
                          <ChatMessageBody content={item.content} selfMessage={fakeMessage(rec.sender, item.content, rec.importedAt + idx)} />
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-8 gap-1.5"
                              disabled={Boolean(busyKey)}
                              onClick={() => void runOpen(rec.id, idx, 'open')}
                            >
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                              {busyOpen ? 'Öffne…' : 'Öffnen'}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5"
                              disabled={Boolean(busyKey)}
                              onClick={() => void runOpen(rec.id, idx, 'save')}
                            >
                              <FileDown className="h-3.5 w-3.5" aria-hidden />
                              {busySave ? 'Speichere…' : 'Speichern'}
                            </Button>
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              className="h-8 gap-1.5"
                              disabled={Boolean(busyKey)}
                              onClick={() => onForwardItem(rec.sender, item)}
                            >
                              <Share2 className="h-3.5 w-3.5" aria-hidden />
                              Weiterleiten
                            </Button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </article>
              )
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
