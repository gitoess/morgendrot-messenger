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

export type ChatViewGroupSettingsSheetProps = ChatViewGroupPanelProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Gruppe anlegen/bearbeiten — Chat bleibt im Hauptbereich. */
export function ChatViewGroupSettingsSheet(p: ChatViewGroupSettingsSheetProps) {
  const { open, onOpenChange, ...groupPanelProps } = p

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border px-4 py-4 text-left">
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 shrink-0 text-foreground/70" aria-hidden />
            Gruppe verwalten
          </SheetTitle>
          <SheetDescription>
            Mitglieder → Kanal. „Pro Mitglied“ = einzelner Handshake je Person (nicht Team-Broadcast).
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <ChatViewGroupPanel {...groupPanelProps} embedded />
        </div>
      </SheetContent>
    </Sheet>
  )
}
