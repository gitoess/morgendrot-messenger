'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ChatViewEinsatzProfilInline } from '@/frontend/components/chat-view-einsatz-profil-inline'

export type ChatViewEinsatzProfilImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onContactsApplied?: () => void
}

export function ChatViewEinsatzProfilImportDialog(p: ChatViewEinsatzProfilImportDialogProps) {
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Kontaktliste importieren</DialogTitle>
          <DialogDescription>
            Schreibt ins <strong className="text-foreground">Telefonbuch</strong> (Backend-Kontaktdatei). Format:{' '}
            <strong className="text-foreground">initialProfile</strong> — nicht die volle Telefonbuch-Struktur mit
            Mailbox-Slots.
          </DialogDescription>
        </DialogHeader>
        <ChatViewEinsatzProfilInline
          hideOuterCollapsible
          compact
          onContactsApplied={() => {
            p.onContactsApplied?.()
            p.onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
