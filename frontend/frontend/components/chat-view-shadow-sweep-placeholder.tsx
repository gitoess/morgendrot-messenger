'use client'

import { useState } from 'react'
import { Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const REMINDER_CLIPBOARD =
  '[Morgendrot] Shadow-Seed → Main-Wallet-Sweep: UI im Messenger fertigstellen. Backend existiert (POST /api/shadow-sweep, src/shadow-sweep.ts, Dashboard ui/index.html).'

export function ChatViewShadowSweepPlaceholder() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyReminder = async () => {
    try {
      await navigator.clipboard.writeText(REMINDER_CLIPBOARD)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <div className="mb-4 rounded-lg border border-dashed border-amber-500/45 bg-amber-500/10 p-4 dark:bg-amber-950/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <div>
              <p className="text-sm font-medium text-foreground">Wallet: Schatten → Main (Sweep)</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Assets von einer temporären Schatten-Adresse auf deine Main-Wallet – Anbindung folgt.
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setOpen(true)}>
            Öffnen
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Shadow-Seed → Main-Wallet sweepen</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Diese Funktion überträgt <strong className="text-foreground">Assets</strong> (Coins und
                  übertragbare Objekte) von einer <strong className="text-foreground">temporären Schatten-Adresse</strong>{' '}
                  auf deine <strong className="text-foreground">Main-Wallet</strong> – typisch nach Auslieferung eines
                  Geräts oder eines Schatten-Seeds.
                </p>
                <p className="rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-950 dark:text-amber-100/90">
                  <strong>Hinweis:</strong> Noch nicht vollständig in dieser Oberfläche angebunden – wird später
                  fertiggestellt. Die Server-Logik existiert bereits (siehe Dokumentation / Dashboard).
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => void copyReminder()} disabled={copied}>
              {copied ? 'Kopiert' : 'Erinnerung in Zwischenablage'}
            </Button>
            <Button type="button" onClick={() => setOpen(false)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
