'use client'

import { Download, Eraser, Flame, KeyRound, MoreVertical, Settings2, UserCircle, Users } from 'lucide-react'
import { ChatViewEncryptionModeToggle } from '@/frontend/components/chat-view-encryption-mode-toggle'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'

export type ChatViewConversationMenuProps = {
  title: string
  subtitle?: string
  /**
   * Kurzer Hinweis oben im ⋮-Menü, warum Einträge fehlen
   * (z. B. Direktchat vs. Konversation aus der Liste).
   */
  menuScopeNote?: string
  canClearHistory: boolean
  canExport: boolean
  onViewProfile?: () => void
  onExportHistory?: () => void
  onClearHistory?: () => void
  onRenewEncryptionKeys?: () => void | Promise<void>
  /** z. B. „Schlüssel erneuern (Epoch 2)“ */
  renewEncryptionLabel?: string
  renewEncryptionHint?: string
  burnOnRead?: {
    enabled: boolean
    onEnabledChange: (v: boolean) => void
  }
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
  const burn = p.burnOnRead
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{p.title}</p>
        {p.subtitle ? <p className="truncate text-[11px] text-muted-foreground">{p.subtitle}</p> : null}
      </div>
      {enc ? (
        <ChatViewEncryptionModeToggle
          compact
          encrypted={enc.encrypted}
          forcedTransport={enc.forcedTransport ?? 'internet'}
          onEncryptedChange={enc.onEncryptedChange}
          className="shrink-0 shadow-sm"
        />
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Chat-Optionen">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[14rem]">
          {p.menuScopeNote ? (
            <>
              <DropdownMenuLabel className="max-w-[16rem] whitespace-normal text-[11px] font-normal leading-snug text-muted-foreground">
                {p.menuScopeNote}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
            </>
          ) : null}
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
            <DropdownMenuItem
              onSelect={() => void p.onRenewEncryptionKeys?.()}
              title={
                p.renewEncryptionHint ??
                'Session-Epoch erhöhen (Forward Secrecy ab Rotation). Alte Nachrichten bleiben lesbar.'
              }
            >
              <KeyRound className="mr-2 h-4 w-4" />
              {p.renewEncryptionLabel ?? 'Schlüssel erneuern'}
            </DropdownMenuItem>
          ) : null}
          {burn ? (
            <DropdownMenuItem
              onSelect={() => burn.onEnabledChange(!burn.enabled)}
              title="Bei löschbaren Chain-Nachrichten nach dem Lesen Purge vorschlagen (mit Bestätigung)."
            >
              <Flame className={burn.enabled ? 'mr-2 h-4 w-4 text-orange-600' : 'mr-2 h-4 w-4'} />
              {burn.enabled ? 'Burn-on-read: an' : 'Burn-on-read: aus'}
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
