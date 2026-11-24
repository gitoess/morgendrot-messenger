'use client'

import { useState, type ReactNode } from 'react'
import { Camera, Mic, Plus, Upload } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export type ChatViewComposerPlusMenuProps = {
  disabled?: boolean
  onPickFile: () => void
  onPickCamera: () => void
  onStt?: () => void
  showStt?: boolean
  /** Statisch oder `(close) => …` — close schließt das +-Menü (nach Checkbox/Bildwahl). */
  extraItems?: ReactNode | ((close: () => void) => ReactNode)
  className?: string
}

function MenuRow(p: {
  icon: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={p.disabled}
      onClick={p.onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
        {p.icon}
      </span>
      {p.label}
    </button>
  )
}

/** Anhang, Kamera, STT, Emoji … hinter „+“ (Telegram-Stil). */
export function ChatViewComposerPlusMenu(p: ChatViewComposerPlusMenuProps) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={p.disabled}
          aria-label="Weitere Aktionen"
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50 text-foreground transition-colors hover:bg-muted disabled:opacity-50',
            p.className
          )}
        >
          <Plus className="h-5 w-5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-2"
        align="start"
        side="top"
        onInteractOutside={() => close()}
        onClick={(e) => {
          const el = e.target as HTMLElement | null
          if (!el) return
          /** Emoji-Untermenü offen lassen; Checkboxen schließen nach Toggle (kein „Kleben“). */
          if (el.closest('[data-testid="chat-composer-emoji-trigger"]')) return
          if (el.closest('input[type="checkbox"]') || el.closest('label')) {
            window.setTimeout(close, 0)
            return
          }
          if (el.closest('button, [role="button"], [data-emoji]')) close()
        }}
      >
        <MenuRow
          icon={<Upload className="h-4 w-4" />}
          label="Datei anhängen"
          disabled={p.disabled}
          onClick={() => {
            close()
            p.onPickFile()
          }}
        />
        <MenuRow
          icon={<Camera className="h-4 w-4" />}
          label="Foto / Kamera"
          disabled={p.disabled}
          onClick={() => {
            close()
            p.onPickCamera()
          }}
        />
        {p.showStt && p.onStt ? (
          <MenuRow
            icon={<Mic className="h-4 w-4" />}
            label="Sprache zu Text (STT)"
            disabled={p.disabled}
            onClick={() => {
              close()
              p.onStt?.()
            }}
          />
        ) : null}
        {typeof p.extraItems === 'function' ? p.extraItems(close) : p.extraItems}
      </PopoverContent>
    </Popover>
  )
}
