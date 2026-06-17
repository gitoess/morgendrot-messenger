'use client'

import type { ReactNode } from 'react'
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
  extraItems?: ReactNode
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
  return (
    <Popover>
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
      <PopoverContent className="w-64 p-2" align="start" side="top">
        <MenuRow
          icon={<Upload className="h-4 w-4" />}
          label="Datei anhängen"
          disabled={p.disabled}
          onClick={p.onPickFile}
        />
        <MenuRow
          icon={<Camera className="h-4 w-4" />}
          label="Foto / Kamera"
          disabled={p.disabled}
          onClick={p.onPickCamera}
        />
        {p.showStt && p.onStt ? (
          <MenuRow
            icon={<Mic className="h-4 w-4" />}
            label="Sprache zu Text (STT)"
            disabled={p.disabled}
            onClick={p.onStt}
          />
        ) : null}
        {p.extraItems}
      </PopoverContent>
    </Popover>
  )
}
