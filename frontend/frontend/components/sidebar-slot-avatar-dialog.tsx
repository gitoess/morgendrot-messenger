'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ContactAvatarEditor } from '@/frontend/components/contact-avatar-editor'

/** Lokales Bild für Sidebar-Sonderzeile (Alle / Gruppe / Alarm …). */
export function SidebarSlotAvatarDialog(p: {
  open: boolean
  onOpenChange: (open: boolean) => void
  avatarKey: string
  title: string
}) {
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Bild: {p.title}</DialogTitle>
          <DialogDescription>
            Nur auf diesem Gerät. Ändert nicht Chain, QR oder andere Kontakte.
          </DialogDescription>
        </DialogHeader>
        <ContactAvatarEditor avatarKey={p.avatarKey} label={p.title} />
      </DialogContent>
    </Dialog>
  )
}
