'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { ApiStatus } from '@/frontend/lib/api'
import { EinsatzManifestAnchorPanel } from '@/frontend/components/einsatz-manifest-anchor-panel'
import { EinsatzForensicBatchPanel } from '@/frontend/components/einsatz-forensic-batch-panel'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

export function EinsatzleitungErweitertPanel(p: {
  apiStatus?: ApiStatus | null
  onRefreshStatus?: () => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      id="einsatz-erweitert"
      className="scroll-mt-4 rounded-xl border border-border bg-card"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/20">
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden
        />
        <span className="text-sm font-semibold text-foreground">Erweitert — Archiv &amp; Beweis</span>
        <span className="text-xs text-muted-foreground">Nachrichten on-chain + Kurz-Beweis</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border/60 px-4 pb-4 pt-4 space-y-4">
        <EinsatzManifestAnchorPanel
          apiStatus={p.apiStatus ?? null}
          onRefreshStatus={p.onRefreshStatus}
        />
        <EinsatzForensicBatchPanel apiStatus={p.apiStatus ?? null} />
        {/* Chain / Move-Upgrade: absichtlich entfernt → IOTA-Settings (Roadmap T23) */}
      </CollapsibleContent>
    </Collapsible>
  )
}
