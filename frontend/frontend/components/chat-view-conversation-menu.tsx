'use client'

import { useEffect, useState } from 'react'
import { Download, Eraser, Flame, FlaskConical, Info, KeyRound, MoreVertical, Settings2, Users } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
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
  /** Info: IDs / Mailbox / TX / Telegram — nicht Einstellungen. */
  onViewInfo?: () => void
  /** @deprecated Prefer onViewInfo */
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
  /**
   * Chain-Sicherheit (Burn-on-read, Schlüssel erneuern, Double Ratchet).
   * Aus bei Funk/Telegram — gehört nicht in den Posteingang-„Optionen“-Menü.
   */
  showChainSecurityTools?: boolean
  /** toolbar = nur ⋮ in der Posteingang-Zeile (ohne Direktchat-Banner). */
  variant?: 'header' | 'toolbar'
}

/** Telegram-ähnliches ⋮-Menü — Kernpunkte immer sichtbar (disabled wenn nicht anwendbar). */
export function ChatViewConversationMenu(p: ChatViewConversationMenuProps) {
  const burn = p.burnOnRead
  const chainSecurity = p.showChainSecurityTools !== false
  const hasGroupActions = Boolean(p.onManageGroup || p.onCreateGroup)
  const onInfo = p.onViewInfo ?? p.onViewProfile
  const toolbarOnly = p.variant === 'toolbar'
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

  const infoLabel = p.onManageGroup ? 'Gruppen-Info' : 'Info'

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Chat-Optionen">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[14rem]">
        {onInfo || hasGroupActions ? (
          <>
            {onInfo ? (
              <DropdownMenuItem onSelect={() => onInfo()}>
                <Info className="mr-2 h-4 w-4" />
                {infoLabel}
              </DropdownMenuItem>
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
                {p.onManageGroup ? 'Neue Gruppe erstellen' : 'Gruppen verwalten…'}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
          </>
        ) : (
          <DropdownMenuItem disabled title="Partner in der Liste wählen">
            <Info className="mr-2 h-4 w-4" />
            Info
          </DropdownMenuItem>
        )}

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

        {chainSecurity ? (
          <>
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
                  ? 'Bei löschbaren Chain-Nachrichten nach dem Lesen Löschen vorschlagen (mit Bestätigung).'
                  : 'Nach-Lesen-Löschen hier nicht verfügbar'
              }
              onSelect={() => burn?.onEnabledChange(!burn.enabled)}
            >
              <Flame className={burn?.enabled ? 'mr-2 h-4 w-4 text-orange-600' : 'mr-2 h-4 w-4'} />
              {burn?.enabled ? 'Nach Lesen löschen: an' : 'Nach Lesen löschen: aus'}
            </DropdownMenuItem>

            <DropdownMenuItem
              title={
                ratchetExp
                  ? 'Experiment an — ändert Senden noch nicht (Composer bleibt Envelope v2). FS heute: Schlüssel erneuern.'
                  : 'Experiment — ändert Senden noch nicht. Opt-in H.23 C1; beide Seiten brauchen Flag, wenn Wire verdrahtet ist.'
              }
              onSelect={() => {
                const next = !ratchetExp
                writeRatchetExperimentEnabled(next)
                setRatchetExp(next)
              }}
            >
              <FlaskConical className={ratchetExp ? 'mr-2 h-4 w-4 text-amber-700' : 'mr-2 h-4 w-4'} />
              {ratchetExp
                ? 'Double Ratchet: an (ändert Senden nicht)'
                : 'Double Ratchet (Exp. — ändert Senden nicht)'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
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
  )

  if (toolbarOnly) return menu

  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        {onInfo ? (
          <button
            type="button"
            className="block w-full min-w-0 rounded-md text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onInfo()}
            title={`${infoLabel} öffnen`}
            aria-label={`${infoLabel} öffnen`}
          >
            <p className="truncate text-sm font-semibold text-foreground">{p.title}</p>
            {p.subtitle ? <p className="truncate text-[11px] text-muted-foreground">{p.subtitle}</p> : null}
          </button>
        ) : (
          <>
            <p className="truncate text-sm font-semibold text-foreground">{p.title}</p>
            {p.subtitle ? <p className="truncate text-[11px] text-muted-foreground">{p.subtitle}</p> : null}
          </>
        )}
      </div>
      {menu}
    </div>
  )
}
