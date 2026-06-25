'use client'

import { useRef, useState } from 'react'
import { ChevronLeft, QrCode } from 'lucide-react'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import {
  EinsatzleitungHelferFlowPanel,
  type HelferEinrichtenWizardStep,
} from '@/frontend/components/einsatzleitung-helfer-flow-panel'
import { EinsatzleitungHelferOverviewPanel } from '@/frontend/components/einsatzleitung-helfer-overview-panel'
import { EinsatzleitungHelferJoinHintPanel } from '@/frontend/components/einsatzleitung-helfer-join-hint-panel'
import { EinsatzleitungTeamOverviewPanel } from '@/frontend/components/einsatzleitung-team-overview-panel'
import { EinsatzleitungMeshtasticHintPanel } from '@/frontend/components/einsatzleitung-meshtastic-hint-panel'
import { BossHandoffExportPanel } from '@/frontend/components/boss-handoff-export-panel'
import { BossHandoffQuickProvisionWizard } from '@/frontend/components/boss-handoff-quick-provision-wizard'
import { DashboardEinsatzParameterPanel } from '@/frontend/components/dashboard-einsatz-konfiguration'
import { Button } from '@/components/ui/button'

const STEP_LABELS: Record<Exclude<HelferEinrichtenWizardStep, 'choose'>, string> = {
  handoff: 'Handoff-ZIP',
  join: 'Spontan beitreten',
  phonebook: 'Telefonbuch',
}

export function BossHelferEinrichtenPanel(p: {
  apiStatus?: ApiStatus | null
  contactDirectory?: Record<string, ContactMeshEntryClient>
  onRefreshStatus?: () => void | Promise<void>
  onOpenMailboxes?: () => void
  onContactsChanged?: () => void
}) {
  const [step, setStep] = useState<HelferEinrichtenWizardStep>('choose')
  const [quickWizardOpen, setQuickWizardOpen] = useState(false)
  const expertRef = useRef<HTMLDetailsElement>(null)

  const pickStep = (next: Exclude<HelferEinrichtenWizardStep, 'choose'>) => setStep(next)

  const openExpert = () => {
    setQuickWizardOpen(false)
    expertRef.current?.setAttribute('open', '')
    expertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section id="helfer-einrichten" className="scroll-mt-4 space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Helfer einrichten</p>
        {step !== 'choose' ? (
          <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setStep('choose')}>
            <ChevronLeft className="mr-1 h-3.5 w-3.5" aria-hidden />
            Methode wechseln
          </Button>
        ) : null}
      </div>

      <EinsatzleitungHelferFlowPanel activeStep={step} onSelectStep={pickStep} />

      {step === 'choose' ? (
        <p className="text-xs text-muted-foreground">
          Wähle oben eine Methode — danach siehst du nur die passenden Schritte, nicht alles auf einmal.
        </p>
      ) : (
        <p className="text-xs font-medium text-primary">
          Schritt 2 — {STEP_LABELS[step]}
        </p>
      )}

      {step === 'handoff' ? (
        <div id="helfer-handoff" className="scroll-mt-4 space-y-4">
          <EinsatzleitungTeamOverviewPanel
            serverMailboxId={p.apiStatus?.mailboxId}
            onOpenMailboxes={p.onOpenMailboxes}
          />

          <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Schnellweg (empfohlen)</p>
            <p className="text-xs text-muted-foreground">
              Bezeichnung + Preset → ZIP + Seed-QR. Nutzt dieselbe Export-Pipeline wie der Experten-Assistent.
            </p>
            <Button type="button" onClick={() => setQuickWizardOpen(true)}>
              <QrCode className="mr-2 h-4 w-4" aria-hidden />
              Schnell-Assistent starten
            </Button>
          </div>

          <details ref={expertRef} className="rounded-lg border border-border/70 bg-muted/10 px-3 py-2">
            <summary className="cursor-pointer py-1 text-sm font-medium text-foreground">
              Experten-Assistent (Rechte-Matrix, Partner, IOTA, Vorlagen)
            </summary>
            <div className="mt-3">
              <BossHandoffExportPanel
                apiSnapshot={p.apiStatus ?? null}
                contactDirectory={p.contactDirectory}
                embedded
                layout="compact"
              />
            </div>
          </details>

          <BossHandoffQuickProvisionWizard
            open={quickWizardOpen}
            onOpenChange={setQuickWizardOpen}
            apiSnapshot={p.apiStatus ?? null}
            contactDirectory={p.contactDirectory}
            onOpenExpert={openExpert}
          />
        </div>
      ) : null}

      {step === 'join' ? <EinsatzleitungHelferJoinHintPanel /> : null}

      {step === 'phonebook' ? (
        <EinsatzleitungHelferOverviewPanel
          contactDirectory={p.contactDirectory ?? {}}
          onContactsChanged={p.onContactsChanged ?? (() => {})}
        />
      ) : null}

      {step !== 'choose' && step !== 'handoff' ? (
        <details className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium text-foreground">Erweitert (Funk, Einsatzparameter)</summary>
          <div className="mt-3 space-y-4">
            <EinsatzleitungMeshtasticHintPanel />
            <DashboardEinsatzParameterPanel
              apiStatus={p.apiStatus ?? null}
              contactDirectory={p.contactDirectory}
              onRefreshStatus={p.onRefreshStatus}
              inline
            />
          </div>
        </details>
      ) : null}
    </section>
  )
}
