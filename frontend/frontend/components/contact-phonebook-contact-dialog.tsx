'use client'

import { useEffect, useRef, useState } from 'react'
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
import { fetchResolvePrivateMailboxOwner } from '@/frontend/lib/fetch-resolve-private-mailbox-owner'
import { readMyPrivateMailboxes } from '@/frontend/lib/my-private-mailbox-store'

export type ContactPhonebookFormValues = {
  address: string
  label: string
  meshNodeId: string
  mailboxObjectId: string
  telegramChatId: string
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
  telegramChatId: '',
}

export function ContactPhonebookContactDialog(p: ContactPhonebookContactDialogProps) {
  const { open, onOpenChange, mode, initial, busy = false, onSave, onScanImport } = p
  const [form, setForm] = useState<ContactPhonebookFormValues>(empty)
  const [resolveOwnerBusy, setResolveOwnerBusy] = useState(false)
  const [resolveOwnerHint, setResolveOwnerHint] = useState('')
  const openSnapshotRef = useRef<Partial<ContactPhonebookFormValues> | undefined>(undefined)
  const myMailboxes = open ? readMyPrivateMailboxes() : []

  useEffect(() => {
    if (!open) {
      openSnapshotRef.current = undefined
      return
    }
    if (openSnapshotRef.current) return
    const snapshot: ContactPhonebookFormValues = {
      address: initial?.address ?? '',
      label: initial?.label ?? '',
      meshNodeId: initial?.meshNodeId ?? '',
      mailboxObjectId: initial?.mailboxObjectId ?? '',
      telegramChatId: initial?.telegramChatId ?? '',
    }
    openSnapshotRef.current = snapshot
    setForm(snapshot)
  }, [open, initial])

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
      telegramChatId: form.telegramChatId,
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
            Mindestens IOTA-Adresse (0x…) oder Telegram Chat-ID. Ohne Wallet reicht Name + Chat-ID für Telegram-Hinweise;
            Online-Send auf IOTA braucht später eine Adresse.
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
            <label className="text-xs font-medium text-muted-foreground">
              Telegram Chat-ID {!form.address.trim() ? <span className="text-destructive">*</span> : '(optional)'}
            </label>
            <input
              type="text"
              value={form.telegramChatId}
              onChange={(e) => setForm((f) => ({ ...f, telegramChatId: e.target.value }))}
              placeholder="Zahl von @userinfobot — auch ohne IOTA-Adresse speicherbar"
              className="w-full rounded-lg border border-border bg-input px-3 py-2.5 font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Private Mailbox des Kontakts (optional)
            </label>
            {myMailboxes.length > 0 ? (
              <select
                value={form.mailboxObjectId}
                onChange={(e) => setForm((f) => ({ ...f, mailboxObjectId: e.target.value }))}
                className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-xs"
              >
                <option value="">— keine (Einsatz-Shared) —</option>
                {myMailboxes.map((m) => (
                  <option key={m.objectId} value={m.objectId}>
                    {(m.label ? `${m.label} · ` : '') + m.objectId.slice(0, 10)}…{m.objectId.slice(-6)}
                  </option>
                ))}
              </select>
            ) : null}
            <input
              type="text"
              value={form.mailboxObjectId}
              onChange={(e) => {
                setResolveOwnerHint('')
                setForm((f) => ({ ...f, mailboxObjectId: e.target.value }))
              }}
              placeholder="0x… — private Mailbox des Kontakts (aus QR/Profil)"
              className="w-full rounded-lg border border-border bg-input px-3 py-2.5 font-mono text-xs"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={resolveOwnerBusy || !/^0x[a-fA-F0-9]{64}$/i.test(form.mailboxObjectId.trim())}
                onClick={() => {
                  void (async () => {
                    setResolveOwnerBusy(true)
                    setResolveOwnerHint('')
                    const r = await fetchResolvePrivateMailboxOwner(form.mailboxObjectId)
                    setResolveOwnerBusy(false)
                    if (!r.ok) {
                      setResolveOwnerHint(r.error)
                      return
                    }
                    setForm((f) => ({ ...f, address: r.owner }))
                    setResolveOwnerHint(`Wallet des Mailbox-Owners aus der Chain übernommen (${r.owner.slice(0, 10)}…).`)
                  })()
                }}
                className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] font-medium hover:bg-primary/15 disabled:opacity-50"
              >
                {resolveOwnerBusy ? 'Lade Owner…' : 'Wallet aus Chain (Owner)'}
              </button>
            </div>
            {resolveOwnerHint ? (
              <p className="text-[10px] text-muted-foreground">{resolveOwnerHint}</p>
            ) : null}
            <p className="text-[10px] text-muted-foreground">
              Nur Mailbox-ID bekannt? Owner per Chain laden, dann speichern. Senden geht immer an die{' '}
              <strong className="text-foreground">Wallet</strong>; die Mailbox-ID steuert nur das Postfach on-chain.
              Pro Kontakt ist derzeit <strong className="text-foreground">eine</strong> alternative Mailbox-ID speicherbar.
            </p>
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
