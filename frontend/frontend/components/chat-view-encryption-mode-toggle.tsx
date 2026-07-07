'use client'

import { useState } from 'react'
import { Lock, Unlock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export function ChatViewEncryptionModeToggle(p: {
  encrypted: boolean
  forcedTransport: ForcedTransport
  onEncryptedChange: (encrypted: boolean) => void
  /** Kompakt: kürzere Beschriftung (Konversationskopf). */
  compact?: boolean
  className?: string
}) {
  const [plainWarnOpen, setPlainWarnOpen] = useState(false)
  const showToggle = p.forcedTransport === 'internet'

  if (!showToggle) return null

  const plainLabel = p.compact ? 'Klartext' : 'Unverschlüsselt'
  const encShort = p.compact ? 'Verschl.' : 'Verschlüsselt'

  return (
    <>
      <AlertDialog open={plainWarnOpen} onOpenChange={setPlainWarnOpen}>
        <AlertDialogContent className="border-orange-500/40 bg-orange-950/20 sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-orange-100">Unverschlüsselt senden?</AlertDialogTitle>
            <AlertDialogDescription className="text-orange-50/95">
              Die Nachricht wird unverschlüsselt auf der öffentlichen Blockchain gespeichert und ist für jeden
              einsehbar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 text-white hover:bg-orange-500"
              onClick={() => p.onEncryptedChange(false)}
            >
              Verstanden, fortfahren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div
        className={cn(
          'inline-flex rounded-lg border border-border bg-background p-0.5',
          p.encrypted && 'ring-1 ring-emerald-500/30',
          p.className
        )}
        role="group"
        aria-label="Verschlüsselung"
      >
        <button
          type="button"
          onClick={() => p.onEncryptedChange(true)}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors',
            p.encrypted ? 'bg-emerald-500/20 text-emerald-400' : 'text-muted-foreground hover:bg-muted/60'
          )}
        >
          <Lock className="h-3.5 w-3.5" aria-hidden />
          {encShort}
        </button>
        <button
          type="button"
          onClick={() => {
            if (p.encrypted) setPlainWarnOpen(true)
            else p.onEncryptedChange(false)
          }}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors',
            !p.encrypted ? 'bg-amber-500/20 text-amber-400' : 'text-muted-foreground hover:bg-muted/60'
          )}
        >
          <Unlock className="h-3.5 w-3.5" aria-hidden />
          {plainLabel}
        </button>
      </div>
    </>
  )
}
