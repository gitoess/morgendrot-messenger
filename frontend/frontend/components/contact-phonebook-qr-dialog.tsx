'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import QRCode from 'qrcode'
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
  const [qrUrl, setQrUrl] = useState('')

  const payload = useMemo(() => {
    try {
      return buildContactQrPayload({
        address: address.trim(),
        displayName: entry?.label?.trim() || undefined,
        mailboxObjectId: entry?.mailboxObjectId?.trim() || entry?.mailboxPrivateId?.trim() || undefined,
        mailboxSharedId: entry?.mailboxSharedId?.trim() || undefined,
        mailboxTeamId: entry?.mailboxTeamId?.trim() || undefined,
        mailboxBufferId: entry?.mailboxBufferId?.trim() || undefined,
      })
    } catch {
      return ''
    }
  }, [address, entry])

  useEffect(() => {
    if (!open || !payload) {
      setQrUrl('')
      return
    }
    let cancelled = false
    void QRCode.toDataURL(payload, { width: 240, margin: 2 }).then((url) => {
      if (!cancelled) setQrUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [open, payload])

  const copy = () => {
    if (!payload) return
    void navigator.clipboard.writeText(payload).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kontakt-QR</DialogTitle>
          <DialogDescription>
            {entry?.label?.trim() || 'Kontakt'} —{' '}
            <span className="font-mono">{maskWalletAddress(address)}</span>
            . Enthält Wallet (+ optionale Mailbox-IDs) zum Einlesen unter „Kontakt-/Peering-QR scannen“.
          </DialogDescription>
        </DialogHeader>
        {qrUrl ? (
          <img src={qrUrl} alt="Kontakt-QR" className="mx-auto rounded-lg border border-border" />
        ) : (
          <p className="text-sm text-muted-foreground">QR wird erzeugt…</p>
        )}
        <button
          type="button"
          onClick={copy}
          disabled={!payload}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Kopiert' : 'QR-Text kopieren'}
        </button>
      </DialogContent>
    </Dialog>
  )
}
