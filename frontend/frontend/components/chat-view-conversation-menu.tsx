'use client'

import { Download, Eraser, KeyRound, Lock, MoreVertical, Settings2, Unlock, UserCircle, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
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
  onManageGroup?: () => void
  onCreateGroup?: () => void
  encryptionToggle?: {
    encrypted: boolean
    onEncryptedChange: (v: boolean) => void
    forcedTransport?: ForcedTransport
  }
}

/** Telegram-ähnliches ⋮-Menü für die aktive Konversation. */
export function ChatViewConversationMenu(p: ChatViewConversationMenuProps) {
  const enc = p.encryptionToggle
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{p.title}</p>
        {p.subtitle ? <p className="truncate text-[11px] text-muted-foreground">{p.subtitle}</p> : null}
      </div>
      {enc ? (
        <div
          className={cn(
            'inline-flex shrink-0 rounded-md border border-border bg-card p-0.5 shadow-sm',
            enc.encrypted && 'ring-1 ring-emerald-500/30'
          )}
          role="group"
          aria-label="Verschlüsselung"
        >
          <button
            type="button"
            disabled={enc.forcedTransport === 'mesh'}
            onClick={() => enc.onEncryptedChange(true)}
            className={cn(
              'inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold',
              enc.encrypted ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'
            )}
            title={enc.forcedTransport === 'mesh' ? 'Funk = Klartext' : 'Verschlüsselt'}
          >
            <Lock className="h-3 w-3" aria-hidden />
            <span className="hidden sm:inline">Verschl.</span>
          </button>
          <button
            type="button"
            onClick={() => enc.onEncryptedChange(false)}
            className={cn(
              'inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold',
              !enc.encrypted ? 'bg-amber-600/15 text-amber-800 dark:text-amber-200' : 'text-muted-foreground'
            )}
          >
            <Unlock className="h-3 w-3" aria-hidden />
            <span className="hidden sm:inline">Klar</span>
          </button>
        </div>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Chat-Optionen">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[14rem]">
          {p.onManageGroup ? (
            <DropdownMenuItem onSelect={() => p.onManageGroup?.()}>
              <Settings2 className="mr-2 h-4 w-4" />
              Gruppe verwalten…
            </DropdownMenuItem>
          ) : null}
          {p.onCreateGroup ? (
            <DropdownMenuItem onSelect={() => p.onCreateGroup?.()}>
              <Users className="mr-2 h-4 w-4" />
              Neue Gruppe erstellen
            </DropdownMenuItem>
          ) : null}
          {p.onManageGroup || p.onCreateGroup ? <DropdownMenuSeparator /> : null}
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
