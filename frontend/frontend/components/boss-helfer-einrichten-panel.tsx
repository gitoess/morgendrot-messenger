'use client'

import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import {
  EinsatzleitungHelferFlowPanel,
  type HelferEinrichtenWizardStep,
} from '@/frontend/components/einsatzleitung-helfer-flow-panel'
import { EinsatzleitungHelferJoinHintPanel } from '@/frontend/components/einsatzleitung-helfer-join-hint-panel'
import { PhonebookContactDistributePanel } from '@/frontend/components/phonebook-contact-distribute-panel'
import { EinsatzleitungMeshtasticHintPanel } from '@/frontend/components/einsatzleitung-meshtastic-hint-panel'
import { HandoffProvisionEntry } from '@/frontend/components/handoff-provision-entry'
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
  onContactsChanged?: () => void
}) {
  const [step, setStep] = useState<HelferEinrichtenWizardStep>('choose')

  const pickStep = (next: Exclude<HelferEinrichtenWizardStep, 'choose'>) => setStep(next)

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
        <div id="helfer-handoff" className="scroll-mt-4">
          <HandoffProvisionEntry
            apiSnapshot={p.apiStatus ?? null}
            contactDirectory={p.contactDirectory}
          />
        </div>
      ) : null}

      {step === 'join' ? <EinsatzleitungHelferJoinHintPanel /> : null}

      {step === 'phonebook' ? (
        <div className="space-y-3">
          <PhonebookContactDistributePanel
            directory={p.contactDirectory ?? {}}
            onContactsChanged={p.onContactsChanged ?? (() => {})}
          />
          <p className="text-xs text-muted-foreground">
            Wer schon im Team ist, steht oben unter{' '}
            <a href="#mein-team" className="font-medium text-primary hover:underline">
              Mein Team
            </a>{' '}
            (Roster &amp; Kontakte).
          </p>
        </div>
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
