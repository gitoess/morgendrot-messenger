'use client'

import { BookUser } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ChatViewPhonebookSection } from '@/frontend/components/chat-view-phonebook-section'
import type { ChatViewPhonebookSectionProps } from '@/frontend/components/chat-view-phonebook-section'

export type ChatViewPhonebookSheetProps = ChatViewPhonebookSectionProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Telefonbuch als Seiten-Panel — getrennt von „Meine IOTA-Adresse“ oben im Chat. */
export function ChatViewPhonebookSheet(p: ChatViewPhonebookSheetProps) {
  const { open, onOpenChange, ...phonebook } = p

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-border bg-background p-0 sm:max-w-lg"
      >
        <SheetHeader className="shrink-0 border-b border-border px-4 py-4 text-left">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <BookUser className="h-5 w-5 text-primary" aria-hidden />
            Telefonbuch
          </SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <ChatViewPhonebookSection {...phonebook} embedded />
        </div>
      </SheetContent>
    </Sheet>
  )
}
