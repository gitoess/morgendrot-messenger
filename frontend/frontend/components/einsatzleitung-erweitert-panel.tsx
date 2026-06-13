'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { ApiStatus } from '@/frontend/lib/api'
import { DashboardEinsatzChainPanel } from '@/frontend/components/dashboard-einsatz-konfiguration'
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
      className="scroll-mt-4 rounded-xl border border-border/80 bg-card"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/20">
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden
        />
        <span className="text-sm font-semibold text-foreground">Erweitert — Mainnet-Archiv</span>
        <span className="text-xs text-muted-foreground">Volles Archiv + Kurz-Beweis (Boss)</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border/60 px-4 pb-4 pt-4 space-y-4">
        <EinsatzManifestAnchorPanel
          apiStatus={p.apiStatus ?? null}
          onRefreshStatus={p.onRefreshStatus}
        />
        <EinsatzForensicBatchPanel apiStatus={p.apiStatus ?? null} />
        <DashboardEinsatzChainPanel
          apiStatus={p.apiStatus ?? null}
          onRefreshStatus={p.onRefreshStatus}
        />
      </CollapsibleContent>
    </Collapsible>
  )
}
