'use client'

import { useEffect, useRef, useState } from 'react'
import { QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { HandoffProvisionSeedRevealPanel } from '@/frontend/components/handoff-provision-seed-reveal-panel'
import { formatHandoffAddressShort } from '@/frontend/lib/handoff-export-display'
import { HANDOFF_SEED_QR_SECONDS } from '@/frontend/lib/handoff-provision-new-device'
import { updateBossProvisionRegistryEntry } from '@/frontend/lib/boss-provision-registry'

export function HandoffProvisionResultDialog(p: {
  open: boolean
  onOpenChange: (open: boolean) => void
  address: string
  entryId: string | null
  qrDataUrl: string
  initialQrSeconds?: number
  zipPasswordProtected?: boolean
  onSeedAcknowledged?: () => void
  /** Master-Passwort für „Seed aus Registry anzeigen“ (Custody B). */
  resolveMasterPassword?: () => string
}) {
  const {
    open,
    onOpenChange,
    address,
    entryId,
    qrDataUrl: initialQrDataUrl,
    initialQrSeconds = HANDOFF_SEED_QR_SECONDS,
    zipPasswordProtected = false,
    onSeedAcknowledged,
    resolveMasterPassword,
  } = p

  const [qrDataUrl, setQrDataUrl] = useState(initialQrDataUrl)
  const [qrSecondsLeft, setQrSecondsLeft] = useState(initialQrSeconds)
  const [seedAcknowledged, setSeedAcknowledged] = useState(false)
  const qrTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearQrTimer = () => {
    if (qrTimerRef.current) {
      clearInterval(qrTimerRef.current)
      qrTimerRef.current = null
    }
    setQrSecondsLeft(0)
    setQrDataUrl('')
  }

  useEffect(() => {
    if (!open) {
      clearQrTimer()
      return
    }
    setQrDataUrl(initialQrDataUrl)
    setQrSecondsLeft(initialQrSeconds)
    setSeedAcknowledged(false)
    if (qrTimerRef.current) clearInterval(qrTimerRef.current)
    qrTimerRef.current = setInterval(() => {
      setQrSecondsLeft((prev) => {
        if (prev <= 1) {
          clearQrTimer()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (qrTimerRef.current) clearInterval(qrTimerRef.current)
    }
  }, [open, initialQrDataUrl, initialQrSeconds])

  const onConfirmSeedShown = async () => {
    setSeedAcknowledged(true)
    if (entryId) {
      await updateBossProvisionRegistryEntry(entryId, {
        seedShownAtIso: new Date().toISOString(),
      })
    }
    onSeedAcknowledged?.()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) clearQrTimer()
        onOpenChange(v)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Seed & ZIP bereit</DialogTitle>
          <DialogDescription>
            ZIP wurde heruntergeladen{zipPasswordProtected ? ' (passwortgeschützt)' : ''}. Seed nur über QR oder
            Registry — nie in der ZIP.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="font-mono text-xs text-foreground">{formatHandoffAddressShort(address)}</p>

          {qrDataUrl && qrSecondsLeft > 0 ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-center">
              <p className="mb-2 flex items-center justify-center gap-2 text-sm font-medium">
                <QrCode className="h-4 w-4" aria-hidden />
                Seed-QR ({qrSecondsLeft}s)
              </p>
              <img src={qrDataUrl} alt="Seed-QR für Helfer" className="mx-auto rounded-lg border border-border" />
              <p className="mt-2 text-[10px] text-muted-foreground">
                Helfer: nach ZIP-Import „Seed einrichten?“ → QR scannen.
              </p>
            </div>
          ) : (
            <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              QR abgelaufen — unten „Seed erneut anzeigen“ (Registry muss in dieser Sitzung entsperrt sein).
            </p>
          )}

          {resolveMasterPassword && entryId ? (
            <HandoffProvisionSeedRevealPanel
              entryId={entryId}
              resolveMasterPassword={resolveMasterPassword}
            />
          ) : null}

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={seedAcknowledged}
              onChange={(e) => {
                if (e.target.checked) void onConfirmSeedShown()
                else setSeedAcknowledged(false)
              }}
              className="mt-1"
            />
            <span>Seed dem Helfer gezeigt / sicher übergeben</span>
          </label>

          <Button type="button" variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
