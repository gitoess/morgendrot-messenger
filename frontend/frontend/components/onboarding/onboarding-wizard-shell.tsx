'use client'

import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { OnboardingStepId } from '@/frontend/lib/onboarding-progress-store'
import { scheduleReleaseStuckModalPointerEvents } from '@/frontend/lib/release-modal-pointer-events'

export function OnboardingStepIndicator(p: { current: number; total: number; className?: string }) {
  const pct = p.total > 0 ? Math.round(((p.current + 1) / p.total) * 100) : 0
  return (
    <div className={cn('space-y-1.5', p.className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Schritt {p.current + 1} von {p.total}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-sky-500 transition-all"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )
}

export type OnboardingWizardShellProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  stepIndex: number
  stepTotal: number
  stepTitle: string
  /** Eine Zeile: was jetzt zu tun ist */
  stepHint?: string
  children: ReactNode
  onBack?: () => void
  onNext?: () => void | Promise<void>
  onSkip?: () => void
  onLater?: () => void
  nextLabel?: string
  showBack?: boolean
  showSkip?: boolean
  showLater?: boolean
  nextDisabled?: boolean
  /** Pfeil neben Primäraktion — bei „Fertig“ aus. */
  showNextChevron?: boolean
  /** X / Overlay-Schließen — z. B. dismissOnboarding (vor onOpenChange(false)). */
  onDismiss?: () => void
}

export function OnboardingWizardShell(p: OnboardingWizardShellProps) {
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      p.onDismiss?.()
      scheduleReleaseStuckModalPointerEvents()
    }
    p.onOpenChange(open)
  }

  return (
    <Dialog open={p.open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{p.title}</DialogTitle>
          {p.description ? <DialogDescription>{p.description}</DialogDescription> : null}
        </DialogHeader>
        <OnboardingStepIndicator current={p.stepIndex} total={p.stepTotal} />
        <div className="space-y-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">{p.stepTitle}</h3>
            {p.stepHint ? <p className="mt-1 text-sm text-muted-foreground">{p.stepHint}</p> : null}
          </div>
          {p.children}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex flex-wrap gap-2">
            {p.showBack && p.onBack ? (
              <Button type="button" variant="outline" size="sm" onClick={p.onBack}>
                <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
                Zurück
              </Button>
            ) : null}
            {p.showLater && p.onLater ? (
              <Button type="button" variant="ghost" size="sm" onClick={p.onLater}>
                Später
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {p.showSkip && p.onSkip ? (
              <Button type="button" variant="secondary" size="sm" onClick={p.onSkip}>
                Überspringen
              </Button>
            ) : null}
            {p.onNext ? (
              <Button
                type="button"
                size="sm"
                onClick={() => void Promise.resolve(p.onNext?.())}
                disabled={p.nextDisabled}
              >
                {p.nextLabel ?? 'Weiter'}
                {p.showNextChevron !== false ? (
                  <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
                ) : null}
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export const BOSS_STEP_TITLES: Record<string, string> = {
  wallet: 'Wallet',
  'network-plan': 'Wo senden?',
  'einsatz-rules': 'Einsatz-Regeln',
  chain: 'Chain anbinden',
  package: 'Chain anbinden',
  mailboxes: 'Postfächer',
  telegram: 'Telegram',
  meshtastic: 'Funk',
  helpers: 'Helfer-Gerät',
  done: 'Fertig',
}

export const HELPER_STEP_TITLES: Record<string, string> = {
  handoff: 'Handoff importieren',
  telegram: 'Telegram',
  wallet: 'Wallet',
  'team-self': 'Im Team',
  peering: 'Boss',
  done: 'Fertig',
}

export const WANDERER_STEP_TITLES: Record<string, string> = {
  wallet: 'Wallet',
  address: 'Adresse',
  'private-mailbox': 'Postfächer',
  meshtastic: 'Funk',
  done: 'Fertig',
}

export function stepTitleFor(stepId: OnboardingStepId, path: 'boss' | 'helper' | 'wanderer'): string {
  if (path === 'boss') return BOSS_STEP_TITLES[stepId] ?? stepId
  if (path === 'helper') return HELPER_STEP_TITLES[stepId] ?? stepId
  return WANDERER_STEP_TITLES[stepId] ?? stepId
}
