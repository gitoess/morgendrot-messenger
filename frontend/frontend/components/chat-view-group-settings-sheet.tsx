'use client'

import { Users } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ChatViewGroupPanel, type ChatViewGroupPanelProps } from '@/frontend/components/chat-view-group-panel'
import {
  ChatViewEncryptedPartnerPanel,
  type ChatViewEncryptedPartnerPanelProps,
} from '@/frontend/components/chat-view-encrypted-partner-panel'

export type ChatViewGroupSettingsSheetProps = ChatViewGroupPanelProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
  encryptedPartnerPanel?: ChatViewEncryptedPartnerPanelProps | null
}

/** Gruppe anlegen/bearbeiten, Team-Postfach, Handshakes — aus dem Chat heraus, nicht im Nachrichtenfluss. */
export function ChatViewGroupSettingsSheet(p: ChatViewGroupSettingsSheetProps) {
  const { open, onOpenChange, encryptedPartnerPanel, ...groupPanelProps } = p

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border px-4 py-4 text-left">
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 shrink-0 text-violet-500" aria-hidden />
            Gruppe verwalten
          </SheetTitle>
          <SheetDescription>
            Erstellen, speichern, Mitglieder, Team-Postfach und Handshakes — der Chat bleibt im Hauptbereich.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <ChatViewGroupPanel {...groupPanelProps} embedded />
          {encryptedPartnerPanel ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Handshake</p>
              <ChatViewEncryptedPartnerPanel {...encryptedPartnerPanel} />
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
