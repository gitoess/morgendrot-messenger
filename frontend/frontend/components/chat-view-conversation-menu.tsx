'use client'

import {
  Download,
  Eraser,
  KeyRound,
  MoreVertical,
  UserCircle,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

export type ChatViewConversationMenuProps = {
  title: string
  subtitle?: string
  canClearHistory: boolean
  canExport: boolean
  onViewProfile?: () => void
  onExportHistory?: () => void
  onClearHistory?: () => void
  onRenewEncryptionKeys?: () => void | Promise<void>
}

/** Telegram-ähnliches ⋮-Menü für die aktive Konversation. */
export function ChatViewConversationMenu(p: ChatViewConversationMenuProps) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{p.title}</p>
        {p.subtitle ? <p className="truncate text-[10px] text-muted-foreground">{p.subtitle}</p> : null}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Chat-Optionen">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[14rem]">
          {p.onViewProfile ? (
            <DropdownMenuItem onSelect={() => p.onViewProfile?.()}>
              <UserCircle className="mr-2 h-4 w-4" />
              Profil anzeigen
            </DropdownMenuItem>
          ) : null}
          {p.onExportHistory ? (
            <DropdownMenuItem disabled={!p.canExport} onSelect={() => p.onExportHistory?.()}>
              <Download className="mr-2 h-4 w-4" />
              Verlauf exportieren
            </DropdownMenuItem>
          ) : null}
          {p.onRenewEncryptionKeys ? (
            <DropdownMenuItem onSelect={() => void p.onRenewEncryptionKeys?.()}>
              <KeyRound className="mr-2 h-4 w-4" />
              Schlüssel erneuern
            </DropdownMenuItem>
          ) : null}
          {p.onClearHistory ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!p.canClearHistory}
                className="text-destructive focus:text-destructive"
                onSelect={() => p.onClearHistory?.()}
              >
                <Eraser className="mr-2 h-4 w-4" />
                Verlauf leeren (lokal)
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
