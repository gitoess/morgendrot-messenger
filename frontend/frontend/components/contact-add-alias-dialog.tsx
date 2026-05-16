'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export type ContactAddAliasDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  address: string
  defaultLabel?: string
  busy?: boolean
  onSave: (label: string) => void | Promise<void>
}

export function ContactAddAliasDialog(p: ContactAddAliasDialogProps) {
  const { open, onOpenChange, address, defaultLabel = '', busy = false, onSave } = p
  const [label, setLabel] = useState(defaultLabel)

  useEffect(() => {
    if (open) setLabel(defaultLabel)
  }, [open, defaultLabel])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ins Telefonbuch</DialogTitle>
          <DialogDescription>
            Alias (Anzeigename) für Posteingang und Gruppen — die <span className="font-mono">0x</span>-Adresse bleibt der
            Schlüssel.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Adresse</label>
          <code className="block break-all rounded border border-border bg-muted/40 px-2 py-1.5 font-mono text-[11px]">
            {address}
          </code>
          <label className="text-xs font-medium text-muted-foreground">Alias / Anzeigename</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="z. B. Einsatzleitung"
            className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
            autoFocus
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onSave(label.trim())}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? 'Speichere…' : 'Speichern'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
