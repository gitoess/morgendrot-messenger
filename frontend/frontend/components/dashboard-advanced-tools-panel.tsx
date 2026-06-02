'use client'

import { useState } from 'react'
import { ChevronDown, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  WorkspaceProjectsPanel,
  type WorkspaceTileSet,
} from '@/frontend/components/workspace-projects-panel'

export function DashboardAdvancedToolsPanel(p: {
  productMode: 'messenger' | 'projekt'
  tileSet?: WorkspaceTileSet
  onTileSetChange?: (v: WorkspaceTileSet) => void
  onOpenSettings?: () => void
}) {
  const [open, setOpen] = useState(false)
  const isMessenger = p.productMode === 'messenger'

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-8">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-left hover:bg-muted/40">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Wrench className="h-4 w-4 text-muted-foreground" aria-hidden />
          Erweiterte Funktionen
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {isMessenger ? 'Export & Technik' : 'Projekt & Export'}
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-3">
        <p className="px-1 text-xs text-muted-foreground">
          {isMessenger
            ? 'Technische Hinweise — Helfer-ZIP nur über Einsatzleitung → Export-Assistent (nicht npm-Bundle).'
            : 'Morgendrot Projekt, Messenger-Vorschau, Export und Einstellungen.'}
        </p>
        {!isMessenger && p.onOpenSettings ? (
          <button
            type="button"
            onClick={p.onOpenSettings}
            className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-left text-sm font-medium text-foreground hover:bg-muted/50"
          >
            Technische Einstellungen öffnen
          </button>
        ) : null}
        {isMessenger ? (
          <p className="rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
            <strong className="text-foreground">Helfer einrichten:</strong> Einsatzleitung →{' '}
            <strong className="text-foreground">Export-Assistent — Untergebenen einrichten</strong> (Handoff-ZIP).
            <br />
            <strong className="mt-2 inline-block text-foreground">Entwickler-Bundle:</strong>{' '}
            <code className="rounded bg-muted px-1 font-mono text-[10px]">npm run bundle:messenger</code> — nur für
            Standalone-Ordner auf dem Server, nicht für Helfer-Handys.
          </p>
        ) : p.tileSet != null && p.onTileSetChange ? (
          <WorkspaceProjectsPanel tileSet={p.tileSet} onTileSetChange={p.onTileSetChange} />
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  )
}
