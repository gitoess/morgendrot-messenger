'use client'

import { Smile } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { TELEGRAM_EMOJI_QUICK_PICK } from '@/frontend/lib/telegram-emoji-quick-pick'

export type ChatComposerEmojiPickerProps = {
  onPick: (emoji: string) => void
  disabled?: boolean
  /** Gleiche Höhe wie „Datei importieren“ / „Von Kamera“. */
  compact?: boolean
}

export function ChatComposerEmojiPicker({ onPick, disabled, compact = false }: ChatComposerEmojiPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={
            compact
              ? 'inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/60 disabled:opacity-50'
              : 'inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2.5 text-sm text-foreground hover:bg-muted disabled:opacity-50'
          }
          aria-label="Emoji einfügen (Telegram)"
          data-testid="chat-composer-emoji-trigger"
        >
          <Smile className="h-4 w-4 shrink-0" aria-hidden />
          <span className={compact ? 'inline' : 'hidden sm:inline'}>Emoji</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto max-w-[min(20rem,calc(100vw-2rem))] p-2">
        <p className="mb-2 px-1 text-[11px] text-muted-foreground">Für Telegram &amp; Nachrichtentext</p>
        <div
          className="grid max-h-48 grid-cols-8 gap-0.5 overflow-y-auto"
          role="listbox"
          aria-label="Emoji-Auswahl"
        >
          {TELEGRAM_EMOJI_QUICK_PICK.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="option"
              className="flex h-9 w-9 items-center justify-center rounded-md text-lg hover:bg-muted"
              onClick={() => onPick(emoji)}
              aria-label={`Emoji ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
