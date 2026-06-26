'use client'

import { useRef, useState } from 'react'
import { QrCode } from 'lucide-react'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import { BossHandoffExportPanel } from '@/frontend/components/boss-handoff-export-panel'
import { BossHandoffQuickProvisionWizard } from '@/frontend/components/boss-handoff-quick-provision-wizard'
import { EinsatzleitungTeamOverviewPanel } from '@/frontend/components/einsatzleitung-team-overview-panel'
import { Button } from '@/components/ui/button'

/** Gemeinsamer Einstieg: Schnell-Assistent + Experten-Panel (H4 — Einsatzleitung & Onboarding). */
export function HandoffProvisionEntry(p: {
  apiSnapshot?: ApiStatus | null
  contactDirectory?: Record<string, ContactMeshEntryClient>
  onOpenMailboxes?: () => void
  showTeamOverview?: boolean
  showExpertPanel?: boolean
}) {
  const [quickWizardOpen, setQuickWizardOpen] = useState(false)
  const expertRef = useRef<HTMLDetailsElement>(null)

  const openExpert = () => {
    setQuickWizardOpen(false)
    expertRef.current?.setAttribute('open', '')
    expertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="space-y-4">
      {p.showTeamOverview !== false ? (
        <EinsatzleitungTeamOverviewPanel
          serverMailboxId={p.apiSnapshot?.mailboxId}
          onOpenMailboxes={p.onOpenMailboxes}
        />
      ) : null}

      <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 p-4 space-y-3">
        <p className="text-sm font-medium text-foreground">Schnellweg (empfohlen)</p>
        <p className="text-xs text-muted-foreground">
          Geführter Dialog: Bezeichnung → optional Rechte &amp; Team → Registry → ZIP + Seed + QR.
        </p>
        <Button type="button" onClick={() => setQuickWizardOpen(true)}>
          <QrCode className="mr-2 h-4 w-4" aria-hidden />
          Schnell-Assistent starten
        </Button>
      </div>

      {p.showExpertPanel !== false ? (
        <details ref={expertRef} className="rounded-lg border border-border/70 bg-muted/10 px-3 py-2">
          <summary className="cursor-pointer py-1 text-sm font-medium text-foreground">
            Experten-Assistent (Rechte-Matrix, Partner, IOTA, Vorlagen)
          </summary>
          <div className="mt-3">
            <BossHandoffExportPanel
              apiSnapshot={p.apiSnapshot ?? null}
              contactDirectory={p.contactDirectory}
              embedded
              layout="compact"
            />
          </div>
        </details>
      ) : null}

      <BossHandoffQuickProvisionWizard
        open={quickWizardOpen}
        onOpenChange={setQuickWizardOpen}
        apiSnapshot={p.apiSnapshot ?? null}
        contactDirectory={p.contactDirectory}
        onOpenExpert={p.showExpertPanel !== false ? openExpert : undefined}
      />
    </div>
  )
}
