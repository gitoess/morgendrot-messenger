'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { ExternalLink, MessageCircle, Package, Radio, Users, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { ApiStatus } from '@/frontend/lib/api/status'
import {
  readTelegramInviteFromHandoffExtras,
  readTelegramLabelFromHandoffExtras,
} from '@/frontend/lib/handoff-extras'
import { getStandaloneHelperReadiness } from '@/frontend/lib/handoff-standalone-ready'
import { readLocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'
import { HelperJoinRequestForm } from '@/frontend/components/onboarding/helper-join-request-form'
import {
  finishOnboarding,
  getActiveOnboardingStep,
  markOnboardingStepComplete,
  readOnboardingProgress,
  setOnboardingStepIndex,
  skipOnboardingStep,
  dismissOnboarding,
  type OnboardingProgress,
  type OnboardingSkipContext,
  type OnboardingStepId,
} from '@/frontend/lib/onboarding-progress-store'
import {
  OnboardingWizardShell,
  stepTitleFor,
} from '@/frontend/components/onboarding/onboarding-wizard-shell'
import {
  readTelegramOpenInviteOnStep,
  setTelegramAlarmGroupWizardDismissed,
  writeTelegramOpenInviteOnStep,
  saveTelegramAlarmGroupPending,
  readTelegramAlarmGroupJoinInitiated,
  isTelegramAlarmGroupJoinInitiatedForLink,
  confirmTelegramAlarmGroupJoined,
  TELEGRAM_ALARM_GROUP_JOIN_CHANGED_EVENT,
} from '@/frontend/lib/telegram-alarm-group-prefs'
import { openTelegramAlarmGroupInvite } from '@/frontend/lib/telegram-alarm-group-invite'
import { toast } from 'sonner'

export type OnboardingWizardDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiSnapshot?: ApiStatus | null
  onOpenSettings?: () => void
  onOpenEinsatzleitung?: () => void
  onOpenHandoffImport?: () => void
  onActivateWallet?: () => void
  onOpenChat?: () => void
}

function bossSkipContext(api?: ApiStatus | null): OnboardingSkipContext {
  return {
    role: api?.role,
    hasPackageId: Boolean(api?.packageId?.trim()),
    hasMailboxId: Boolean(api?.mailboxId?.trim()),
    hasMeshNodeId: false,
    hasTeamId: Boolean(api?.handoffLabel?.trim()),
  }
}

export function OnboardingWizardDialog(p: OnboardingWizardDialogProps) {
  const [progress, setProgress] = useState<OnboardingProgress | null>(() => readOnboardingProgress())
  const [qrUrl, setQrUrl] = useState('')
  const [openOnStep, setOpenOnStep] = useState(readTelegramOpenInviteOnStep)
  const [telegramJoinOpened, setTelegramJoinOpened] = useState(false)

  const ctx = useMemo(() => bossSkipContext(p.apiSnapshot), [p.apiSnapshot])

  const syncProgress = useCallback(() => {
    setProgress(readOnboardingProgress())
  }, [])

  useEffect(() => {
    if (!p.open) return
    syncProgress()
  }, [p.open, syncProgress])

  const active = progress ? getActiveOnboardingStep(progress, ctx) : null
  const path = progress?.path ?? 'helper'
  const stepId = active?.stepId ?? 'done'
  const stepIndex = active?.index ?? 0
  const stepTotal = active?.total ?? 1

  const inviteLink = readTelegramInviteFromHandoffExtras()
  const inviteLabel = readTelegramLabelFromHandoffExtras()

  const syncTelegramJoinState = useCallback(() => {
    if (!inviteLink) {
      setTelegramJoinOpened(false)
      return
    }
    setTelegramJoinOpened(isTelegramAlarmGroupJoinInitiatedForLink(inviteLink))
  }, [inviteLink])

  useEffect(() => {
    syncTelegramJoinState()
    const onJoinChanged = () => syncTelegramJoinState()
    window.addEventListener(TELEGRAM_ALARM_GROUP_JOIN_CHANGED_EVENT, onJoinChanged)
    return () => window.removeEventListener(TELEGRAM_ALARM_GROUP_JOIN_CHANGED_EVENT, onJoinChanged)
  }, [syncTelegramJoinState])

  useEffect(() => {
    if (!p.open || stepId !== 'telegram') return
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const hit = readTelegramAlarmGroupJoinInitiated()
      if (hit?.inviteLink === inviteLink) {
        toast.message('Zurück in Morgendrot — nach Beitritt in Telegram auf „Beigetreten — Weiter“ tippen.')
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [p.open, stepId, inviteLink])

  const handleOpenTelegramInvite = useCallback(() => {
    if (!inviteLink) return
    saveTelegramAlarmGroupPending({ inviteLink, label: inviteLabel || undefined })
    openTelegramAlarmGroupInvite(inviteLink)
    setTelegramJoinOpened(true)
    toast.message('Telegram geöffnet — der Gruppe beitreten, dann hier in Morgendrot bestätigen.')
  }, [inviteLink, inviteLabel])

  useEffect(() => {
    if (stepId !== 'telegram' || !inviteLink) {
      setQrUrl('')
      return
    }
    let cancelled = false
    void QRCode.toDataURL(inviteLink, { width: 200, margin: 2 }).then((url) => {
      if (!cancelled) setQrUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [stepId, inviteLink])

  const autoOpenTelegramRef = useRef(false)

  useEffect(() => {
    if (stepId === 'telegram' && openOnStep && inviteLink && !autoOpenTelegramRef.current) {
      autoOpenTelegramRef.current = true
      handleOpenTelegramInvite()
    }
    if (stepId !== 'telegram') autoOpenTelegramRef.current = false
  }, [stepId, openOnStep, inviteLink, handleOpenTelegramInvite])

  const advance = (action: 'complete' | 'skip') => {
    if (!progress) return
    if (stepId === 'telegram' && action === 'complete') {
      confirmTelegramAlarmGroupJoined({
        label: inviteLabel || undefined,
        inviteLink: inviteLink || undefined,
      })
      setTelegramJoinOpened(false)
    }
    if (action === 'complete') markOnboardingStepComplete(stepId)
    else skipOnboardingStep(stepId)
    const next = readOnboardingProgress()
    setProgress(next)
    const nextActive = next ? getActiveOnboardingStep(next, ctx) : null
    if (!nextActive || nextActive.stepId === 'done') finishOnboarding()
  }

  const handleBack = () => {
    if (stepIndex > 0) setOnboardingStepIndex(stepIndex - 1)
    syncProgress()
  }

  const handleLater = () => {
    dismissOnboarding()
    p.onOpenChange(false)
  }

  const pathTitle =
    path === 'boss' ? 'Einsatzleitung einrichten' : path === 'helper' ? 'Helfer-Einrichtung' : 'Privat starten'

  const renderStepBody = () => {
    const readiness = getStandaloneHelperReadiness()

    if (stepId === 'identity') {
      return (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Callsign und Rolle bestätigen — Kontakt-ID unter Einstellungen prüfen.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => p.onOpenSettings?.()}>
            Einstellungen öffnen
          </Button>
        </div>
      )
    }
    if (stepId === 'iota') {
      return (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Package-ID, Mailbox und RPC — in den Netzwerkprofilen oder Konfiguration.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => p.onOpenSettings?.()}>
            IOTA-Einstellungen
          </Button>
        </div>
      )
    }
    if (stepId === 'funk') {
      return (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Meshtastic Node-ID und Kanal — unter Einstellungen → Funk.</p>
          <Radio className="h-8 w-8 text-sky-400" aria-hidden />
        </div>
      )
    }
    if (stepId === 'team') {
      return (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Team-Name und Team-Mailboxen — in der Konfiguration oder Einsatzleitung.</p>
        </div>
      )
    }
    if (stepId === 'helpers') {
      return (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Neue Helfer über Handoff-ZIP oder QR provisionieren.</p>
          <Button type="button" onClick={() => p.onOpenEinsatzleitung?.()}>
            Helfer einrichten
          </Button>
        </div>
      )
    }
    if (stepId === 'handoff') {
      const handoffSnap = readLocalHandoffAppliedSnapshot()
      return (
        <div className="space-y-4 text-sm text-muted-foreground">
          <Package className="h-8 w-8 text-purple-400" aria-hidden />
          <p>Handoff-ZIP vom Boss importieren — öffentliche Keys, Seed bleibt auf dem Gerät.</p>
          <Button type="button" onClick={() => p.onOpenHandoffImport?.()}>
            Handoff importieren
          </Button>
          {readiness.hasHandoff ? (
            <p className="text-emerald-400" role="status">
              Handoff erkannt — weiter zum nächsten Schritt.
            </p>
          ) : (
            <HelperJoinRequestForm
              defaultBossAddress={handoffSnap?.bossAddress}
              defaultName={handoffSnap?.handoffLabel}
            />
          )}
        </div>
      )
    }
    if (stepId === 'telegram') {
      if (!inviteLink) {
        return (
          <p className="text-sm text-muted-foreground">
            Kein Telegram-Link im Handoff — Schritt wird übersprungen.
          </p>
        )
      }
      return (
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Für wichtige Alarmierungen (SOS, Team-Update): der Einsatz-Gruppe beitreten. Nur Hinweise — Inhalte
            bleiben in Morgendrot.
          </p>
          {inviteLabel ? (
            <p className="font-medium text-foreground">
              <MessageCircle className="mr-1.5 inline h-4 w-4" aria-hidden />
              {inviteLabel}
            </p>
          ) : null}
          {qrUrl ? (
            <img src={qrUrl} alt="QR Telegram-Einladung" className="mx-auto rounded-lg border border-border" />
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="tg-open-on-step" className="text-xs text-muted-foreground">
              Link beim Öffnen dieses Schritts anzeigen
            </Label>
            <Switch
              id="tg-open-on-step"
              checked={openOnStep}
              onCheckedChange={(v) => {
                setOpenOnStep(v)
                writeTelegramOpenInviteOnStep(v)
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleOpenTelegramInvite}>
              <ExternalLink className="mr-1.5 h-4 w-4" aria-hidden />
              Gruppe beitreten
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setTelegramAlarmGroupWizardDismissed(true)
                skipOnboardingStep('telegram')
                syncProgress()
              }}
            >
              Nicht interessiert
            </Button>
          </div>
          {telegramJoinOpened ? (
            <p
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-950 dark:text-emerald-100"
              role="status"
            >
              Telegram wurde geöffnet. Nach dem Beitritt in der Telegram-App unten auf{' '}
              <strong>Beigetreten — Weiter</strong> tippen.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Morgendrot kann den Beitritt nicht automatisch erkennen — nach Telegram kurz hierher zurück und
              bestätigen.
            </p>
          )}
        </div>
      )
    }
    if (stepId === 'wallet' || stepId === 'solo-intro') {
      return (
        <div className="space-y-3 text-sm text-muted-foreground">
          <Wallet className="h-8 w-8 text-emerald-400" aria-hidden />
          <p>
            {path === 'wanderer'
              ? 'Privat/Solo: kein Boss, kein Team-Sync — Wallet anlegen oder Seed importieren.'
              : 'Seed-QR scannen oder Mnemonic eingeben — Keys bleiben auf diesem Gerät.'}
          </p>
          <Button type="button" onClick={() => p.onActivateWallet?.()}>
            Wallet einrichten
          </Button>
        </div>
      )
    }
    if (stepId === 'team-self') {
      return (
        <div className="space-y-3 text-sm text-muted-foreground">
          <Users className="h-8 w-8 text-amber-400" aria-hidden />
          <p>Callsign und Funk-Node-ID unter Profil „Ich“ prüfen.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => p.onOpenSettings?.()}>
            Profil öffnen
          </Button>
        </div>
      )
    }
    if (stepId === 'peering') {
      return (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Boss-QR scannen oder Kontakt-ID setzen — Peering in Nachrichten.</p>
          <Button type="button" onClick={() => p.onOpenChat?.()}>
            Nachrichten öffnen
          </Button>
        </div>
      )
    }
    return (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p className="text-foreground font-medium">Einrichtung abgeschlossen.</p>
        <ul className="list-inside list-disc space-y-1">
          <li>Dashboard und Nachrichten nutzen</li>
          <li>Einstellungen → „Einrichtung fortsetzen“ jederzeit</li>
        </ul>
        <Button type="button" onClick={() => p.onOpenChange(false)}>
          Schließen
        </Button>
      </div>
    )
  }

  if (!progress) return null

  return (
    <OnboardingWizardShell
      open={p.open}
      onOpenChange={p.onOpenChange}
      title={pathTitle}
      description="Geführter Erststart — bestehende Panels werden verlinkt, nichts wird doppelt gebaut."
      stepIndex={stepIndex}
      stepTotal={stepTotal}
      stepTitle={stepTitleFor(stepId as OnboardingStepId, path)}
      showBack={stepIndex > 0 && stepId !== 'done'}
      showSkip={stepId !== 'done' && stepId !== 'telegram'}
      showLater={stepId !== 'done'}
      onBack={handleBack}
      onSkip={() => advance('skip')}
      onLater={handleLater}
      onNext={stepId === 'done' ? () => p.onOpenChange(false) : () => advance('complete')}
      nextLabel={
        stepId === 'done' ? 'Fertig' : stepId === 'telegram' && telegramJoinOpened ? 'Beigetreten — Weiter' : 'Weiter'
      }
    >
      {renderStepBody()}
    </OnboardingWizardShell>
  )
}
