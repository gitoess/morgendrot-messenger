'use client'

import { useEffect, useState } from 'react'
import { Download, Eraser, Flame, FlaskConical, KeyRound, MoreVertical, Settings2, UserCircle, Users } from 'lucide-react'
import { ChatViewEncryptionModeToggle } from '@/frontend/components/chat-view-encryption-mode-toggle'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import {
  RATCHET_EXPERIMENT_CHANGED,
  readRatchetExperimentEnabled,
  writeRatchetExperimentEnabled,
} from '@/frontend/lib/ratchet-experiment'

export type ChatViewConversationMenuProps = {
  title: string
  subtitle?: string
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

/** Telegram-ähnliches ⋮-Menü — Kernpunkte immer sichtbar (disabled wenn nicht anwendbar). */
export function ChatViewConversationMenu(p: ChatViewConversationMenuProps) {
  const enc = p.encryptionToggle
  const burn = p.burnOnRead
  const hasGroupActions = Boolean(p.onManageGroup || p.onCreateGroup)
  const [ratchetExp, setRatchetExp] = useState(false)

  useEffect(() => {
    setRatchetExp(readRatchetExperimentEnabled())
    const sync = () => setRatchetExp(readRatchetExperimentEnabled())
    window.addEventListener(RATCHET_EXPERIMENT_CHANGED, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(RATCHET_EXPERIMENT_CHANGED, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

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
          {hasGroupActions ? (
            <>
              {p.onManageGroup ? (
                <DropdownMenuItem onSelect={() => p.onManageGroup?.()}>
                  <Settings2 className="mr-2 h-4 w-4" />
                  Gruppe verwalten…
                </DropdownMenuItem>
              ) : null}
              {p.onCreateGroup ? (
                <DropdownMenuItem onSelect={() => p.onCreateGroup?.()}>
                  <Users className="mr-2 h-4 w-4" />
                  {p.onManageGroup ? 'Neue Gruppe erstellen' : 'Gruppen verwalten…'}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
            </>
          ) : null}

          <DropdownMenuItem
            disabled={!p.onViewProfile}
            title={!p.onViewProfile ? 'Partner in der Liste wählen' : undefined}
            onSelect={() => p.onViewProfile?.()}
          >
            <UserCircle className="mr-2 h-4 w-4" />
            Profil anzeigen
          </DropdownMenuItem>

          <DropdownMenuItem
            disabled={!p.onExportHistory || !p.canExport}
            title={
              !p.onExportHistory
                ? 'Export hier nicht angebunden'
                : !p.canExport
                  ? 'Keine Nachrichten zum Export'
                  : undefined
            }
            onSelect={() => p.onExportHistory?.()}
          >
            <Download className="mr-2 h-4 w-4" />
            Verlauf exportieren
          </DropdownMenuItem>

          <DropdownMenuItem
            disabled={!p.onRenewEncryptionKeys}
            title={
              p.onRenewEncryptionKeys
                ? p.renewEncryptionHint ??
                  'Session-Epoch erhöhen (Forward Secrecy ab Rotation). Alte Nachrichten bleiben lesbar.'
                : 'Nur bei 1:1 mit gültiger Partner-0x'
            }
            onSelect={() => void p.onRenewEncryptionKeys?.()}
          >
            <KeyRound className="mr-2 h-4 w-4" />
            {p.renewEncryptionLabel ?? 'Schlüssel erneuern'}
          </DropdownMenuItem>

          <DropdownMenuItem
            disabled={!burn}
            title={
              burn
                ? 'Bei burnbaren Chain-Nachrichten nach dem Lesen Burn vorschlagen (mit Bestätigung).'
                : 'Burn-on-read hier nicht verfügbar'
            }
            onSelect={() => burn?.onEnabledChange(!burn.enabled)}
          >
            <Flame className={burn?.enabled ? 'mr-2 h-4 w-4 text-orange-600' : 'mr-2 h-4 w-4'} />
            {burn?.enabled ? 'Burn-on-read: an' : 'Burn-on-read: aus'}
          </DropdownMenuItem>

          <DropdownMenuItem
            title={
              ratchetExp
                ? 'Double-Ratchet-Experiment an — Composer bleibt bei v2; Hook nur bei Session (C1.5).'
                : 'Opt-in Double Ratchet (H.23 C1). Beide Seiten brauchen Flag + Session. Kein Produktiv-Default.'
            }
            onSelect={() => {
              const next = !ratchetExp
              writeRatchetExperimentEnabled(next)
              setRatchetExp(next)
            }}
          >
            <FlaskConical className={ratchetExp ? 'mr-2 h-4 w-4 text-amber-700' : 'mr-2 h-4 w-4'} />
            {ratchetExp ? 'Double Ratchet: an (Exp.)' : 'Double Ratchet (Experiment)'}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!p.onClearHistory || !p.canClearHistory}
            className="text-destructive focus:text-destructive"
            title={
              !p.onClearHistory
                ? 'Lokal leeren hier nicht angebunden'
                : !p.canClearHistory
                  ? 'Keine sichtbaren Nachrichten'
                  : undefined
            }
            onSelect={() => p.onClearHistory?.()}
          >
            <Eraser className="mr-2 h-4 w-4" />
            Verlauf leeren (lokal)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
