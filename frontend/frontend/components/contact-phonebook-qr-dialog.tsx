'use client'

import { useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { buildContactQrPayload } from '@/frontend/lib/contact-qr'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'

export type ContactPhonebookQrDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  address: string
  entry?: ContactMeshEntryClient
}

export function ContactPhonebookQrDialog(p: ContactPhonebookQrDialogProps) {
  const { open, onOpenChange, address, entry } = p
  const [copied, setCopied] = useState(false)

  const qr = useMemo(() => {
    try {
      return buildContactQrPayload({
        address: address.trim(),
        displayName: entry?.label?.trim() || undefined,
        mailboxObjectId: entry?.mailboxObjectId?.trim() || undefined,
      })
    } catch {
      return ''
    }
  }, [address, entry?.label, entry?.mailboxObjectId])

  const copy = () => {
    if (!qr) return
    void navigator.clipboard.writeText(qr).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR-Code / Kontaktdaten</DialogTitle>
          <DialogDescription>
            {entry?.label?.trim() || 'Kontakt'} — <span className="font-mono">{maskWalletAddress(address)}</span>
          </DialogDescription>
        </DialogHeader>
        <textarea
          readOnly
          value={qr}
          rows={6}
          className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 font-mono text-[11px] leading-relaxed"
        />
        <button
          type="button"
          onClick={copy}
          disabled={!qr}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Kopiert' : 'QR-Daten kopieren'}
        </button>
      </DialogContent>
    </Dialog>
  )
}
