'use client'

import { useMemo, useRef, useState } from 'react'
import { Check, QrCode } from 'lucide-react'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import { BossHandoffExportPanel } from '@/frontend/components/boss-handoff-export-panel'
import { BossHandoffQuickProvisionWizard } from '@/frontend/components/boss-handoff-quick-provision-wizard'
import { Button } from '@/components/ui/button'
import {
  bossProvisionedHelpersLabel,
  countBossProvisionedHelpers,
} from '@/frontend/lib/handoff-provision-count'

function StatusRow(p: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={p.ok ? 'text-emerald-500' : 'text-muted-foreground'} aria-hidden>
        {p.ok ? <Check className="h-4 w-4" /> : '○'}
      </span>
      <span className={p.ok ? 'text-foreground' : 'text-muted-foreground'}>{p.label}</span>
    </div>
  )
}

/** Gemeinsamer Einstieg: Schnell-Assistent + Experten-Panel (H4 — Einsatzleitung & Onboarding). */
export function HandoffProvisionEntry(p: {
  apiSnapshot?: ApiStatus | null
  contactDirectory?: Record<string, ContactMeshEntryClient>
  showExpertPanel?: boolean
  /** Wizard: eine Hauptaktion, Experten-UI unter „Mehr Optionen“. */
  layout?: 'default' | 'wizard'
}) {
  const layout = p.layout ?? 'default'
  const [quickWizardOpen, setQuickWizardOpen] = useState(false)
  const [countTick, setCountTick] = useState(0)
  const [expertOpen, setExpertOpen] = useState(false)
  const expertRef = useRef<HTMLDetailsElement>(null)

  const helperCount = useMemo(
    () => countBossProvisionedHelpers(p.apiSnapshot, p.contactDirectory),
    [p.apiSnapshot, p.contactDirectory, countTick]
  )
  const helperLabel = bossProvisionedHelpersLabel(helperCount)

  const openExpert = () => {
    setQuickWizardOpen(false)
    setExpertOpen(true)
    expertRef.current?.setAttribute('open', '')
    expertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const onQuickWizardOpenChange = (open: boolean) => {
    setQuickWizardOpen(open)
    if (!open) setCountTick((n) => n + 1)
  }

  const quickWizard = (
    <BossHandoffQuickProvisionWizard
      open={quickWizardOpen}
      onOpenChange={onQuickWizardOpenChange}
      apiSnapshot={p.apiSnapshot ?? null}
      contactDirectory={p.contactDirectory}
      onOpenExpert={p.showExpertPanel !== false ? openExpert : undefined}
    />
  )

  const expertPanel =
    p.showExpertPanel !== false ? (
      <details
        ref={expertRef}
        className={
          layout === 'wizard'
            ? 'rounded-md border border-border/60 p-3'
            : 'rounded-lg border border-border/70 bg-muted/10 px-3 py-2'
        }
        onToggle={(e) => setExpertOpen((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary
          className={
            layout === 'wizard'
              ? 'cursor-pointer text-sm font-medium text-muted-foreground'
              : 'cursor-pointer py-1 text-sm font-medium text-foreground'
          }
        >
          {layout === 'wizard' ? 'Mehr Optionen' : 'Experten-Assistent (Rechte-Matrix, Partner, IOTA, Vorlagen)'}
        </summary>
        {expertOpen ? (
          <div className="mt-3">
            <BossHandoffExportPanel
              apiSnapshot={p.apiSnapshot ?? null}
              contactDirectory={p.contactDirectory}
              embedded
              layout="compact"
            />
          </div>
        ) : null}
      </details>
    ) : null

  if (layout === 'wizard') {
    return (
      <div className="space-y-4">
        <StatusRow ok={helperCount > 0} label={helperLabel} />
        <Button
          type="button"
          className="w-full sm:w-auto"
          size="lg"
          onClick={() => setQuickWizardOpen(true)}
        >
          <QrCode className="mr-2 h-4 w-4" aria-hidden />
          Schnell-Assistent starten
        </Button>
        {expertPanel}
        {quickWizard}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <StatusRow ok={helperCount > 0} label={helperLabel} />
      <p className="text-xs text-muted-foreground">
        Bereits eingerichtete Helfer, Seeds und Gruppen findest du oben unter{' '}
        <a href="#mein-team" className="font-medium text-primary hover:underline">
          Mein Team
        </a>
        .
      </p>

      <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 p-4 space-y-3">
        <p className="text-sm font-medium text-foreground">Schnellweg (empfohlen)</p>
        <p className="text-xs text-muted-foreground">
          Geführter Dialog: Bezeichnung → optional Rechte &amp; Team → optional Registry →{' '}
          <strong className="font-medium text-foreground">ZIP + Seed + QR</strong> oder{' '}
          <strong className="font-medium text-foreground">Nur ZIP (eigene Wallet)</strong>.
        </p>
        <Button type="button" onClick={() => setQuickWizardOpen(true)}>
          <QrCode className="mr-2 h-4 w-4" aria-hidden />
          Schnell-Assistent starten
        </Button>
      </div>

      {expertPanel}
      {quickWizard}
    </div>
  )
}
