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
import { applyPeeringQrImport, parsePeeringQrPayload } from '@/frontend/lib/peering-qr'
import { fetchResolvePrivateMailboxOwner } from '@/frontend/lib/fetch-resolve-private-mailbox-owner'
import { readMyPrivateMailboxes } from '@/frontend/lib/my-private-mailbox-store'
import {
  contactFormWalletFromStorageKey,
  isIotaWalletAddress,
  isTelegramDirectoryKey,
} from '@/frontend/lib/contact-storage-key'
import {
  CONTACT_MAILBOX_SLOT_IDS,
  CONTACT_MAILBOX_SLOT_LABELS,
  type ContactMailboxSlotId,
  slotsFromEntry,
} from '@/frontend/lib/contact-mailbox-slots'

const MAILBOX_FORM_KEY: Record<ContactMailboxSlotId, keyof ContactPhonebookFormValues> = {
  shared: 'mailboxSharedId',
  private: 'mailboxPrivateId',
  team: 'mailboxTeamId',
  buffer: 'mailboxBufferId',
}

export type ContactPhonebookFormValues = {
  address: string
  label: string
  meshNodeId: string
  mailboxSharedId: string
  mailboxPrivateId: string
  mailboxTeamId: string
  mailboxBufferId: string
  telegramChatId: string
}

export type ContactPhonebookContactDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  initial?: Partial<ContactPhonebookFormValues>
  /** Verzeichnis-Schlüssel beim Bearbeiten (0x… oder tg:…); für Wallet-Sperre und Schlüsselwechsel. */
  editStorageKey?: string
  busy?: boolean
  onSave: (values: ContactPhonebookFormValues) => void | Promise<void>
  onScanImport?: (values: ContactPhonebookFormValues) => void | Promise<void>
}

const empty: ContactPhonebookFormValues = {
  address: '',
  label: '',
  meshNodeId: '',
  mailboxSharedId: '',
  mailboxPrivateId: '',
  mailboxTeamId: '',
  mailboxBufferId: '',
  telegramChatId: '',
}

export function ContactPhonebookContactDialog(p: ContactPhonebookContactDialogProps) {
  const { open, onOpenChange, mode, initial, editStorageKey = '', busy = false, onSave, onScanImport } = p
  const [form, setForm] = useState<ContactPhonebookFormValues>(empty)
  const [resolveOwnerBusy, setResolveOwnerBusy] = useState(false)
  const [resolveOwnerHint, setResolveOwnerHint] = useState('')
  const openSnapshotRef = useRef<Partial<ContactPhonebookFormValues> | undefined>(undefined)
  const myMailboxes = open ? readMyPrivateMailboxes() : []
  const editKey = editStorageKey.trim().toLowerCase()
  const walletLocked = mode === 'edit' && isIotaWalletAddress(editKey)
  const telegramOnlyEdit = mode === 'edit' && isTelegramDirectoryKey(editKey)

  useEffect(() => {
    if (!open) {
      openSnapshotRef.current = undefined
      return
    }
    if (openSnapshotRef.current) return
    const rawAddr = (initial?.address ?? editKey).trim().toLowerCase()
    const slotInit = slotsFromEntry(initial)
    const snapshot: ContactPhonebookFormValues = {
      address: contactFormWalletFromStorageKey(rawAddr),
      label: initial?.label ?? '',
      meshNodeId: initial?.meshNodeId ?? '',
      ...slotInit,
      telegramChatId:
        initial?.telegramChatId ??
        (rawAddr.startsWith('tg:') ? rawAddr.slice(3) : ''),
    }
    openSnapshotRef.current = snapshot
    setForm(snapshot)
  }, [open, initial, editKey])

  const scanQr = async () => {
    const s = await scanMeshBundleQrWithCamera()
    if ('error' in s) return
    const peering = parsePeeringQrPayload(s.bundleJson)
    if (!peering) return
    applyPeeringQrImport(peering)
    const contactExtras = parseContactQrPayload(s.bundleJson)
    const next: ContactPhonebookFormValues = {
      ...form,
      address: peering.address,
      label: peering.displayName ?? form.label,
      mailboxPrivateId:
        contactExtras?.mailboxPrivateId ?? contactExtras?.mailboxObjectId ?? form.mailboxPrivateId,
      mailboxSharedId: contactExtras?.mailboxSharedId ?? form.mailboxSharedId,
      mailboxTeamId: contactExtras?.mailboxTeamId ?? form.mailboxTeamId,
      mailboxBufferId: contactExtras?.mailboxBufferId ?? form.mailboxBufferId,
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
              IOTA-Adresse (0x…){' '}
              {!form.address.trim() && !telegramOnlyEdit ? (
                <span className="text-muted-foreground">(optional bei Telegram)</span>
              ) : !telegramOnlyEdit ? (
                <span className="text-destructive">*</span>
              ) : null}
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              readOnly={walletLocked}
              placeholder="0x + 64 Hex"
              className="w-full rounded-lg border border-border bg-input px-3 py-2.5 font-mono text-xs read-only:opacity-70"
            />
            {walletLocked ? (
              <p className="text-[10px] text-muted-foreground">
                Wallet-Schlüssel ist fest. Andere Adresse = neuen Kontakt anlegen.
              </p>
            ) : telegramOnlyEdit ? (
              <p className="text-[10px] text-muted-foreground">
                Nur-Telegram-Kontakt: hier optional IOTA-Wallet ergänzen (neuer Verzeichnis-Eintrag).
              </p>
            ) : null}
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
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Ziel-Mailboxen des Kontakts (optional, M4e)</p>
            {CONTACT_MAILBOX_SLOT_IDS.map((slotId) => (
              <div key={slotId} className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">
                  {CONTACT_MAILBOX_SLOT_LABELS[slotId]}
                </label>
                {slotId === 'private' && myMailboxes.length > 0 ? (
                  <select
                    value={form.mailboxPrivateId}
                    onChange={(e) => setForm((f) => ({ ...f, mailboxPrivateId: e.target.value }))}
                    className="mb-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-xs"
                  >
                    <option value="">— manuell / QR —</option>
                    {myMailboxes.map((m) => (
                      <option key={m.objectId} value={m.objectId}>
                        {(m.label ? `${m.label} · ` : '') + m.objectId.slice(0, 10)}…{m.objectId.slice(-6)}
                      </option>
                    ))}
                  </select>
                ) : null}
                <input
                  type="text"
                  value={form[MAILBOX_FORM_KEY[slotId]] as string}
                  onChange={(e) => {
                    setResolveOwnerHint('')
                    const key = MAILBOX_FORM_KEY[slotId]
                    setForm((f) => ({ ...f, [key]: e.target.value }))
                  }}
                  placeholder="0x + 64 Hex"
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-[11px]"
                />
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={resolveOwnerBusy || !/^0x[a-fA-F0-9]{64}$/i.test(form.mailboxPrivateId.trim())}
                onClick={() => {
                  void (async () => {
                    setResolveOwnerBusy(true)
                    setResolveOwnerHint('')
                    const r = await fetchResolvePrivateMailboxOwner(form.mailboxPrivateId)
                    setResolveOwnerBusy(false)
                    if (!r.ok) {
                      setResolveOwnerHint(r.error)
                      return
                    }
                    setForm((f) => ({ ...f, address: r.owner }))
                    setResolveOwnerHint(`Wallet des Mailbox-Owners übernommen (${r.owner.slice(0, 10)}…).`)
                  })()
                }}
                className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] font-medium hover:bg-primary/15 disabled:opacity-50"
              >
                {resolveOwnerBusy ? 'Lade Owner…' : 'Wallet aus Chain (Privat-Mailbox)'}
              </button>
            </div>
            {resolveOwnerHint ? (
              <p className="text-[10px] text-muted-foreground">{resolveOwnerHint}</p>
            ) : null}
            <p className="text-[10px] text-muted-foreground">
              Beim Senden wählst du im Composer das Ziel-Postfach. Nachrichten gehen weiter an die{' '}
              <strong className="text-foreground">Wallet</strong>; die Object-ID ist das on-chain Postfach.
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
