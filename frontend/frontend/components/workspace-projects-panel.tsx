'use client'

import { useState } from 'react'
import { Layers, Copy, Check, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApiStatus } from '../lib/api'

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
  apiStatus: (ApiStatus & { error?: string }) | null
  className?: string
  tileSet: WorkspaceTileSet
  onTileSetChange: (v: WorkspaceTileSet) => void
  /**
   * `true`: Backend liefert `uiVariant: 'messenger'` (UI_VARIANT=messenger) – Volldashboard ist am Server nicht vorgesehen;
   * der Schalter „Volldashboard“ ist deaktiviert.
   */
  liteUiEnforcedByBackend?: boolean
}

export function WorkspaceProjectsPanel({
  apiStatus,
  className,
  tileSet,
  onTileSetChange,
  liteUiEnforcedByBackend = false,
}: WorkspaceProjectsPanelProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const apiPort = apiStatus?.apiListenPort
  const uiVar = apiStatus?.uiVariant
  const edition = apiStatus?.messengerEdition

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
              ? 'Backend: UI_VARIANT=messenger – nur Messenger-Kacheln (siehe /api/status).'
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
          Arbeitsbereich folgt dem Backend: <span className="font-mono">UI_VARIANT=messenger</span> – dieselbe
          Kachel-Auswahl wie die Lite-UI am API-Port.
        </p>
      ) : null}

      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Messenger-Projekt</strong> blendet dieselbe Kachel-Kombination ein
        wie der exportierbare Standalone-Messenger (Chat + Tresor). Export selbst bleibt ein Repo-Befehl (siehe
        unten) oder die Lite-UI auf dem API-Port.
      </p>

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
        <div className="space-y-2">
          <p>
            <span className="font-medium text-foreground">Port 3341</span> = diese{' '}
            <span className="text-foreground">Next.js</span>-Oberfläche (React-Dashboard). Sie spricht per Proxy
            mit dem Backend.
          </p>
          <p>
            <span className="font-medium text-foreground">API-Port{apiPort != null ? ` ${apiPort}` : ''}</span> ={' '}
            <span className="text-foreground">dasselbe Backend</span> mit der{' '}
            <span className="text-foreground">Lite-UI</span> (<span className="font-mono">ui/index.html</span>) –
            oft mehr Legacy-Boss-/Setup-Fläche als hier; mit <span className="font-mono">SERVE_LITE_UI_STATIC=false</span>{' '}
            am API-Port abgeschaltet (nur Next). Kein separater „Standalone-Ordner“: der entsteht erst durch{' '}
            <span className="font-mono">bundle:messenger</span>.
          </p>
          {uiVar != null && (
            <p className="font-mono text-[11px] text-foreground/80">
              Backend: UI_VARIANT={uiVar}
              {edition ? ` · MESSENGER_EDITION=${edition}` : ''}
              {apiStatus?.serveLiteUiStatic === false ? ' · SERVE_LITE_UI_STATIC=off' : ''}
            </p>
          )}
        </div>
      </div>

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
