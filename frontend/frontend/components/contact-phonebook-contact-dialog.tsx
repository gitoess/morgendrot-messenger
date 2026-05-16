'use client'

import { useEffect, useState } from 'react'
import { QrCode } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { scanMeshBundleQrWithCamera } from '@/frontend/lib/mesh-qr'
import { parseContactQrPayload } from '@/frontend/lib/contact-qr'

export type ContactPhonebookFormValues = {
  address: string
  label: string
  meshNodeId: string
  mailboxObjectId: string
}

export type ContactPhonebookContactDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  initial?: Partial<ContactPhonebookFormValues>
  busy?: boolean
  onSave: (values: ContactPhonebookFormValues) => void | Promise<void>
  onScanImport?: (values: ContactPhonebookFormValues) => void | Promise<void>
}

const empty: ContactPhonebookFormValues = {
  address: '',
  label: '',
  meshNodeId: '',
  mailboxObjectId: '',
}

export function ContactPhonebookContactDialog(p: ContactPhonebookContactDialogProps) {
  const { open, onOpenChange, mode, initial, busy = false, onSave, onScanImport } = p
  const [form, setForm] = useState<ContactPhonebookFormValues>(empty)

  useEffect(() => {
    if (open) {
      setForm({
        address: initial?.address ?? '',
        label: initial?.label ?? '',
        meshNodeId: initial?.meshNodeId ?? '',
        mailboxObjectId: initial?.mailboxObjectId ?? '',
      })
    }
  }, [open, initial?.address, initial?.label, initial?.meshNodeId, initial?.mailboxObjectId])

  const scanQr = async () => {
    const s = await scanMeshBundleQrWithCamera()
    if ('error' in s) return
    const parsed = parseContactQrPayload(s.bundleJson)
    if (!parsed) return
    const next: ContactPhonebookFormValues = {
      address: parsed.address,
      label: parsed.displayName ?? form.label,
      meshNodeId: form.meshNodeId,
      mailboxObjectId: parsed.mailboxObjectId ?? form.mailboxObjectId,
    }
    setForm(next)
    if (onScanImport) await onScanImport(next)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Neuen Kontakt anlegen' : 'Kontakt bearbeiten'}</DialogTitle>
          <DialogDescription>
            Name, IOTA-Adresse und optionale Erreichbarkeit. Private Mailbox nur, wenn der Kontakt eine eigene hat.
          </DialogDescription>
        </DialogHeader>

        <button
          type="button"
          disabled={busy}
          onClick={() => void scanQr()}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <QrCode className="h-5 w-5" aria-hidden />
          QR-Code scannen
        </button>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Name / Rufname</label>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="z. B. Anna Schmidt"
              className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm"
              autoFocus={mode === 'create'}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              IOTA-Adresse (0x…) <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              readOnly={mode === 'edit'}
              placeholder="0x + 64 Hex"
              className="w-full rounded-lg border border-border bg-input px-3 py-2.5 font-mono text-xs disabled:opacity-70"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Meshtastic Node ID (optional)</label>
            <input
              type="text"
              value={form.meshNodeId}
              onChange={(e) => setForm((f) => ({ ...f, meshNodeId: e.target.value }))}
              placeholder="z. B. THW-47-B oder !a1b2c3d4"
              className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Private Mailbox (optional)</label>
            <input
              type="text"
              value={form.mailboxObjectId}
              onChange={(e) => setForm((f) => ({ ...f, mailboxObjectId: e.target.value }))}
              placeholder="0x… — nur bei eigener Mailbox des Kontakts"
              className="w-full rounded-lg border border-border bg-input px-3 py-2.5 font-mono text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="min-h-11 rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent"
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onSave(form)}
            className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? 'Speichere…' : 'Speichern'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
