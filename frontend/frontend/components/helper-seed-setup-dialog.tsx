'use client'

import { useState } from 'react'
import { KeyRound, QrCode, ScanLine } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { useMeshQrCameraScan } from '@/frontend/hooks/use-mesh-qr-camera-scan'
import { parseSeedSetupFromQrText } from '@/frontend/lib/seed-setup-qr'
import { isPlausibleSdkImport } from '@/frontend/lib/dashboard-unlock'
import {
  activateStandaloneHelperWallet,
  getStandaloneHelperReadiness,
  notifyStandaloneWalletActivated,
} from '@/frontend/lib/handoff-standalone-ready'
import {
  hasPersistedDirectIotaSessionSigner,
  restoreDirectIotaSessionSignerFromEncryptedStorage,
} from '@/frontend/lib/direct-iota-mnemonic-session'
import { persistDirectChainFieldIds } from '@/frontend/lib/direct-iota-chain-context'
import { ensureStandaloneChatEcdhKeypair } from '@/frontend/lib/direct-chat-ecdh-session'
import { readLocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'
import {
  parseHandoffEnvLines,
  readHandoffEnvBackup,
  syncLocalHandoffSnapshotToChainContext,
} from '@/frontend/lib/handoff-device-bootstrap'
import { useAppTranslation } from '@/frontend/lib/i18n/hooks'
import { LocaleFlagSwitch } from '@/frontend/components/locale-flag-switch'

export function HelperSeedSetupDialog(p: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onActivated?: () => void
}) {
  const { t } = useAppTranslation('helper')
  const [seedImport, setSeedImport] = useState('')
  const [appPassword, setAppPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [scanHint, setScanHint] = useState('')
  const { startScan, cameraDialog } = useMeshQrCameraScan({ title: 'Seed-QR scannen' })
  const readiness = getStandaloneHelperReadiness()
  const hasSavedSeed = hasPersistedDirectIotaSessionSigner()

  const onUnlockSaved = async () => {
    setError('')
    const password = appPassword.trim()
    if (password.length < 8) {
      setError(t('errors.savedPasswordMin'))
      return
    }
    setBusy(true)
    try {
      const restored = await restoreDirectIotaSessionSignerFromEncryptedStorage({ password })
      if (!restored.ok) {
        setError(restored.error)
        return
      }
      persistDirectChainFieldIds({ senderAddress: restored.address })
      const handoff = readLocalHandoffAppliedSnapshot()
      const envBackup = readHandoffEnvBackup()
      if (handoff) {
        const env = envBackup ? parseHandoffEnvLines(envBackup) : undefined
        syncLocalHandoffSnapshotToChainContext(handoff, env)
      }
      const ecdh = await ensureStandaloneChatEcdhKeypair()
      if (!ecdh.ok) {
        setError(ecdh.error)
        return
      }
      setAppPassword('')
      p.onOpenChange(false)
      notifyStandaloneWalletActivated()
      p.onActivated?.()
    } finally {
      setBusy(false)
    }
  }

  const onScanQr = async () => {
    setError('')
    setScanHint('')
    setBusy(true)
    try {
      const scanned = await startScan()
      if ('error' in scanned) {
        if (scanned.error !== 'Scan abgebrochen.') setScanHint(scanned.error)
        return
      }
      const parsed = parseSeedSetupFromQrText(scanned.bundleJson)
      if (!parsed) {
        setScanHint(t('scanInvalidSchema'))
        return
      }
      setSeedImport(parsed.seedImport)
      setScanHint(t('scanSuccess'))
    } finally {
      setBusy(false)
    }
  }

  const onPasteQr = () => {
    setError('')
    const raw = window.prompt(t('pastePrompt'))
    if (!raw?.trim()) return
    const parsed = parseSeedSetupFromQrText(raw)
    if (!parsed) {
      setError(t('pasteInvalid'))
      return
    }
    setSeedImport(parsed.seedImport)
    setScanHint(t('pasteSuccess'))
  }

  const onActivate = async () => {
    setError('')
    const mnemonic = seedImport.trim()
    if (!isPlausibleSdkImport(mnemonic)) {
      setError(t('errors.mnemonicRequired'))
      return
    }
    const password = appPassword.trim()
    if (password && password.length < 8) {
      setError(t('errors.optionalPasswordMin'))
      return
    }
    setBusy(true)
    try {
      const r = await activateStandaloneHelperWallet({
        mnemonic,
        password: password.length >= 8 ? password : undefined,
      })
      if (!r.ok) {
        setError(r.error)
        return
      }
      setSeedImport('')
      setAppPassword('')
      p.onOpenChange(false)
      notifyStandaloneWalletActivated()
      p.onActivated?.()
    } finally {
      setBusy(false)
    }
  }

  const descriptionLabel = readiness.handoffLabel
    ? t('descriptionLabel', { label: readiness.handoffLabel })
    : ''

  return (
    <>
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle>{t('title')}</DialogTitle>
              <DialogDescription>{t('description', { label: descriptionLabel })}</DialogDescription>
            </div>
            <LocaleFlagSwitch className="shrink-0" />
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void onScanQr()}>
              <ScanLine className="mr-2 h-4 w-4" aria-hidden />
              {t('scanQr')}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={onPasteQr}>
              <QrCode className="mr-2 h-4 w-4" aria-hidden />
              {t('pasteQrText')}
            </Button>
          </div>

          {scanHint ? (
            <p className="text-xs text-muted-foreground" role="status">
              {scanHint}
            </p>
          ) : null}

          <div>
            <Label htmlFor="helper-seed-import">{t('mnemonicLabel')}</Label>
            <Textarea
              id="helper-seed-import"
              value={seedImport}
              onChange={(e) => setSeedImport(e.target.value)}
              placeholder={t('mnemonicPlaceholder')}
              className="mt-1 min-h-[6rem] font-mono text-xs"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div>
            <Label htmlFor="helper-app-password">{t('appPasswordLabel')}</Label>
            <Input
              id="helper-app-password"
              type="password"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              placeholder={t('appPasswordPlaceholder')}
              className="mt-1"
              autoComplete="new-password"
            />
          </div>

          {hasSavedSeed ? (
            <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs">
              <p className="font-medium text-foreground">{t('savedProfileTitle')}</p>
              <p className="mt-1 text-muted-foreground">{t('savedProfileHint')}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                disabled={busy}
                onClick={() => void onUnlockSaved()}
              >
                {t('unlockWithAppPassword')}
              </Button>
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="button" className="w-full" disabled={busy} onClick={() => void onActivate()}>
            <KeyRound className="mr-2 h-4 w-4" aria-hidden />
            {busy ? t('activating') : t('activateWallet')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    {cameraDialog}
    </>
  )
}
