'use client'

import { Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MessengerExportPanel } from '@/frontend/components/messenger-export-panel'

export type WorkspaceTileSet = 'full' | 'messenger'

const TILE_SET_KEY = 'morgendrot_workspace_tile_set'

/** Legacy/localStorage — Projekt nutzt immer `full`; Wert bleibt für Tests. */
export function readWorkspaceTileSet(): WorkspaceTileSet {
  if (typeof window === 'undefined') return 'full'
  try {
    const v = window.localStorage.getItem(TILE_SET_KEY)
    return v === 'messenger' ? 'messenger' : 'full'
  } catch {
    return 'full'
  }
}

export function writeWorkspaceTileSet(v: WorkspaceTileSet) {
  try {
    window.localStorage.setItem(TILE_SET_KEY, v)
  } catch {
    /* ignore */
  }
}

interface WorkspaceProjectsPanelProps {
  className?: string
  /** Unbenutzt — Arbeitsbereich ist immer volles Projekt; Prop bleibt für API-Stabilität. */
  tileSet?: WorkspaceTileSet
  onTileSetChange?: (v: WorkspaceTileSet) => void
}

/**
 * Nur **Morgendrot Projekt** (`NEXT_PUBLIC_MORG_PRODUCT=projekt`).
 * Messenger ist eigenes Produkt (`messenger-dashboard.tsx`, `build:messenger`).
 */
export function WorkspaceProjectsPanel({ className }: WorkspaceProjectsPanelProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card/80 p-4 text-sm shadow-sm',
        className
      )}
    >
      <div className="mb-3 flex items-center gap-2 font-semibold text-foreground">
        <Layers className="h-4 w-4 text-primary" aria-hidden />
        Morgendrot Projekt
      </div>

      <p className="mb-4 text-xs text-muted-foreground">
        Volle Plattform: Zugang, Überwachung, Steuerung, Geräte-Radar und die Kachel{' '}
        <strong className="text-foreground/90">Nachrichten</strong> (Messenger-Modul). Für reine
        Einsatz-Helfer und Boss im Feld: separates Produkt{' '}
        <strong className="text-foreground/90">Morgendrot Messenger</strong> bauen (
        <span className="font-mono">npm run build:messenger</span>).
      </p>

      <MessengerExportPanel className="border-0 bg-transparent p-0 shadow-none" />
    </div>
  )
}
