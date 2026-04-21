'use client'

import { useState } from 'react'
import { Layers, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export type WorkspaceTileSet = 'full' | 'messenger'

const TILE_SET_KEY = 'morgendrot_workspace_tile_set'

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

const BUNDLE_CMD = 'npm run bundle:messenger'
const BUNDLE_NOTE =
  'Erzeugt u. a. exports/Morgendrot-Messenger-standalone/ – Ordner kopieren, dort npm install && npm start.'

interface WorkspaceProjectsPanelProps {
  className?: string
  tileSet: WorkspaceTileSet
  onTileSetChange: (v: WorkspaceTileSet) => void
  /**
   * `true`: Lite-Messenger-Bundle (`uiVariant: 'messenger'`) und Nutzer ist nicht Boss – nur Nachrichten + Tresor;
   * Schalter „Volldashboard“ ist deaktiviert. Boss kann weiter auf Volldashboard wechseln.
   */
  liteUiEnforcedByBackend?: boolean
}

export function WorkspaceProjectsPanel({
  className,
  tileSet,
  onTileSetChange,
  liteUiEnforcedByBackend = false,
}: WorkspaceProjectsPanelProps) {
  const [copied, setCopied] = useState<string | null>(null)

  const copy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card/80 p-4 text-sm shadow-sm',
        className
      )}
    >
      <div className="mb-3 flex items-center gap-2 font-semibold text-foreground">
        <Layers className="h-4 w-4 text-primary" />
        Arbeitsbereich &amp; Projekte
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={liteUiEnforcedByBackend}
          onClick={() => onTileSetChange('full')}
          title={
            liteUiEnforcedByBackend
              ? 'Lite-Messenger: Volldashboard nur für die Rolle Boss. Siehe /api/status (uiVariant, role).'
              : undefined
          }
          className={cn(
            'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
            tileSet === 'full'
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border text-muted-foreground hover:bg-accent',
            liteUiEnforcedByBackend && 'cursor-not-allowed opacity-50 hover:bg-transparent'
          )}
        >
          Volldashboard
        </button>
        <button
          type="button"
          onClick={() => onTileSetChange('messenger')}
          className={cn(
            'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
            tileSet === 'messenger'
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border text-muted-foreground hover:bg-accent'
          )}
        >
          Messenger-Projekt (Nachrichten + Tresor)
        </button>
      </div>
      {liteUiEnforcedByBackend ? (
        <p className="mb-3 text-[11px] leading-snug text-sky-600/90 dark:text-sky-300/90">
          <span className="font-mono">UI_VARIANT=messenger</span>: Für deine Rolle nur Messenger-Kacheln (Nachrichten +
          Tresor). Volldashboard kann nur die Rolle <strong className="text-foreground/90">Boss</strong> wählen.
        </p>
      ) : null}

      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="mb-1 text-xs font-medium text-foreground">Standalone exportieren (Haupt-Repo)</div>
        <p className="mb-2 text-xs text-muted-foreground">{BUNDLE_NOTE}</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-background px-2 py-1 font-mono text-[11px]">{BUNDLE_CMD}</code>
          <button
            type="button"
            onClick={() => copy(BUNDLE_CMD, 'bundle')}
            className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
          >
            {copied === 'bundle' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            Kopieren
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Boss: Zusätzlich in der Lite-UI Abschnitt „Messenger exportieren“ oder{' '}
          <span className="font-mono">POST /api/messenger-export-batch</span> (Stapel-Env für Geräte).
        </p>
      </div>
    </div>
  )
}
