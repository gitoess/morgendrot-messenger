'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Hard-Lock: Hauptfläche nicht bedienbar + leichter Scrim.
 * Unlock-Dialog liegt außerhalb (Portal) und bleibt klickbar.
 * Ein Wrapper behält Flex-/Höhen-Klassen (Chat `h-[100dvh]`).
 */
export function VaultFailClosedSurface(p: {
  active: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'relative',
        p.className,
        p.active && 'pointer-events-none select-none'
      )}
      aria-hidden={p.active ? true : undefined}
    >
      {p.children}
      {p.active ? (
        <div
          data-testid="vault-fail-closed-scrim"
          className="pointer-events-none absolute inset-0 z-[45] bg-background/55 backdrop-blur-[1.5px]"
          aria-hidden
        />
      ) : null}
    </div>
  )
}
