'use client'

import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Fail-closed Scrim über der Messenger-Hauptfläche.
 * - Hard-Lock: Unlock-Dialog (Portal) + optional Fallback-Button
 * - Soft-Pause: leichter Scrim; Passwort nur im Weitersprechen-Dialog (kein CTA unten)
 * Scrim = `fixed` am Viewport — sonst wandert der Inhalt bei scrollbaren Eltern nach unten.
 */
export function VaultFailClosedSurface(p: {
  active: boolean
  className?: string
  children: ReactNode
  onRequestUnlock?: () => void
  unlockLabel?: string
  lockedHint?: string
  /** Unterzeile; `null` = aus. Default: Hard-Lock-Hinweis. */
  lockedDetail?: string | null
  /** Soft-Pause: nur Dimmen, kein Unlock-Button (Dialog öffnet separat). */
  unlockCta?: boolean
}) {
  const showUnlockCta = p.unlockCta !== false && Boolean(p.onRequestUnlock)
  const detail =
    p.lockedDetail === null
      ? null
      : (p.lockedDetail ?? 'Bitte im Entsperren-Dialog fortfahren.')
  return (
    <div
      className={cn(
        'relative',
        p.className,
        p.active && 'pointer-events-none select-none'
      )}
      aria-hidden={p.active ? true : undefined}
      data-vault-fail-closed={p.active ? '1' : undefined}
    >
      {p.children}
      {p.active ? (
        <div
          data-testid="vault-fail-closed-scrim"
          className="fixed inset-0 z-[45] flex flex-col items-center justify-center gap-3 bg-background/70 px-4 backdrop-blur-[2px]"
          aria-hidden
        >
          <div className="pointer-events-none flex max-w-sm flex-col items-center gap-2 text-center">
            <Lock className="h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium text-foreground">
              {p.lockedHint ?? 'Tresor gesperrt — Oberfläche gesperrt.'}
            </p>
            {detail ? (
              <p className="text-xs text-muted-foreground">{detail}</p>
            ) : null}
          </div>
          {showUnlockCta ? (
            <button
              type="button"
              data-testid="vault-fail-closed-unlock"
              className="pointer-events-auto z-[46] rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-accent"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                p.onRequestUnlock?.()
              }}
            >
              {p.unlockLabel ?? 'Tresor öffnen'}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
