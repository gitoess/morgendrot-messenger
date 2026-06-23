'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ApiStatus } from '@/frontend/lib/api/status'
import type { ContactMeshEntryClient } from '@/frontend/lib/api/contacts'
import {
  buildSosLageBundlePreview,
  formatSosLageBundlePlaintext,
} from '@/frontend/lib/sos-lage-bundle'

export type SosEmergencySheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialText?: string
  apiStatus?: ApiStatus | null
  contactDirectory?: Record<string, ContactMeshEntryClient>
  myAddress?: string
  sending?: boolean
  /** Dashboard: nur Text + Bundle zurückgeben */
  onConfirmText?: (fullPlaintext: string) => void
  /** Chat: direkt senden */
  onConfirmSend?: (fullPlaintext: string) => void | Promise<void>
}

export function ChatViewSosEmergencySheet(p: SosEmergencySheetProps) {
  const [text, setText] = useState(p.initialText || '')

  useEffect(() => {
    if (p.open) setText(p.initialText || '')
  }, [p.open, p.initialText])

  const bundle = useMemo(
    () =>
      buildSosLageBundlePreview({
        freeText: text,
        apiStatus: p.apiStatus,
        contactDirectory: p.contactDirectory,
        myAddress: p.myAddress,
      }),
    [text, p.apiStatus, p.contactDirectory, p.myAddress]
  )

  const fullBody = formatSosLageBundlePlaintext(bundle)
  const canSend = Boolean(text.trim())

  const handleSend = () => {
    if (!canSend) return
    if (p.onConfirmText) {
      p.onConfirmText(fullBody)
      p.onOpenChange(false)
      return
    }
    void p.onConfirmSend?.(fullBody)
  }

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" aria-hidden />
            SOS — Hilferuf
          </DialogTitle>
          <DialogDescription>
            Unverschlüsselt über alle erreichbaren Wege (Funk, Online, ggf. Telegram-Hinweis). Kein
            automatischer 112-Ruf.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
            Geht offen raus — im Funk-Netz können Mitlausende den Inhalt lesen.
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sos-text">Was ist passiert?</Label>
            <Textarea
              id="sos-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ort, Verletzte, Gefahr …"
              rows={4}
              className="resize-y"
            />
          </div>

          <div className="space-y-1 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs">
            <p className="font-medium text-foreground">Lage-Bundle (Vorschau)</p>
            <p>Name: {bundle.displayName}</p>
            <p className="break-all font-mono">IOTA: {bundle.iotaAddress}</p>
            <p>Funk: {bundle.meshNodeId}</p>
            <p>Telegram: {bundle.telegramHint}</p>
            <p className="break-all font-mono">Package: {bundle.packageId}</p>
            <p>{bundle.locationHint}</p>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => p.onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!canSend || p.sending}
              onClick={handleSend}
            >
              {p.sending ? 'Sende…' : 'SOS senden'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
