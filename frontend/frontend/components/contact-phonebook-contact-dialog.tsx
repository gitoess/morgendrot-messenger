'use client'

import { useEffect, useRef, useState } from 'react'
import { QrCode } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useMeshQrCameraScan } from '@/frontend/hooks/use-mesh-qr-camera-scan'
import { parseContactQrPayload } from '@/frontend/lib/contact-qr'
import { applyPeeringQrImport, parsePeeringQrPayload } from '@/frontend/lib/peering-qr'
import {
  contactFormWalletFromStorageKey,
  isIotaWalletAddress,
  isTelegramDirectoryKey,
} from '@/frontend/lib/contact-storage-key'
import {
  CONTACT_MAILBOX_SLOT_LABELS,
  type ContactMailboxSlotId,
  slotsFromEntry,
} from '@/frontend/lib/contact-mailbox-slots'
import { formatContactRoleTagsCsv } from '@/frontend/lib/contact-phonebook-format'

const EXTRA_MAILBOX_SLOTS: ContactMailboxSlotId[] = ['shared', 'team', 'buffer']

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
  roleTagsCsv: string
}

export type ContactPhonebookContactDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  initial?: Partial<ContactPhonebookFormValues>
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
  roleTagsCsv: '',
}

function hasExtraMailboxSlots(form: ContactPhonebookFormValues): boolean {
  return EXTRA_MAILBOX_SLOTS.some((id) => Boolean(form[MAILBOX_FORM_KEY[id]]?.trim()))
}

export function ContactPhonebookContactDialog(p: ContactPhonebookContactDialogProps) {
  const { open, onOpenChange, mode, initial, editStorageKey = '', busy = false, onSave, onScanImport } = p
  const [form, setForm] = useState<ContactPhonebookFormValues>(empty)
  const [showExtraMailboxes, setShowExtraMailboxes] = useState(false)
  const openSnapshotRef = useRef<Partial<ContactPhonebookFormValues> | undefined>(undefined)
  const { startScan, cameraDialog } = useMeshQrCameraScan({ title: 'Kontakt-QR scannen' })
  const editKey = editStorageKey.trim().toLowerCase()
  const walletLocked = mode === 'edit' && isIotaWalletAddress(editKey)
  const telegramOnlyEdit = mode === 'edit' && isTelegramDirectoryKey(editKey)

  useEffect(() => {
    if (!open) {
      openSnapshotRef.current = undefined
      setShowExtraMailboxes(false)
      return
    }
    if (openSnapshotRef.current) return
    const rawAddr = (initial?.address ?? editKey).trim().toLowerCase()
    const slotInit = slotsFromEntry(initial, rawAddr.startsWith('0x') ? rawAddr : undefined)
    const snapshot: ContactPhonebookFormValues = {
      address: contactFormWalletFromStorageKey(rawAddr),
      label: initial?.label ?? '',
      meshNodeId: initial?.meshNodeId ?? '',
      ...slotInit,
      telegramChatId:
        initial?.telegramChatId ?? (rawAddr.startsWith('tg:') ? rawAddr.slice(3) : ''),
      roleTagsCsv:
        initial?.roleTagsCsv ??
        formatContactRoleTagsCsv(
          Array.isArray((initial as { roleTags?: string[] } | undefined)?.roleTags)
            ? (initial as { roleTags?: string[] }).roleTags
            : undefined
        ),
    }
    openSnapshotRef.current = snapshot
    setForm(snapshot)
    setShowExtraMailboxes(hasExtraMailboxSlots(snapshot))
  }, [open, initial, editKey])

  const scanQr = async () => {
    const s = await startScan()
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
    if (hasExtraMailboxSlots(next)) setShowExtraMailboxes(true)
    if (onScanImport) await onScanImport(next)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{mode === 'create' ? 'Neuen Kontakt anlegen' : 'Kontakt bearbeiten'}</DialogTitle>
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
                  Optional IOTA-Wallet ergänzen (legt einen zusätzlichen Eintrag an).
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Rollen-Tags (optional, kommagetrennt)</label>
              <input
                type="text"
                value={form.roleTagsCsv}
                onChange={(e) => setForm((f) => ({ ...f, roleTagsCsv: e.target.value }))}
                placeholder="z. B. Medic, THW, Gruppenführer"
                className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Meshtastic Node-ID (optional)</label>
              <input
                type="text"
                value={form.meshNodeId}
                onChange={(e) => setForm((f) => ({ ...f, meshNodeId: e.target.value }))}
                placeholder="z. B. !a1b2c3d4"
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
                placeholder="Numerische ID"
                className="w-full rounded-lg border border-border bg-input px-3 py-2.5 font-mono text-xs"
              />
            </div>

            <details className="rounded-lg border border-border/70 bg-muted/10 px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Erweitert · Postfach-ID (optional)
              </summary>
              <div className="mt-2 space-y-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground">
                    {CONTACT_MAILBOX_SLOT_LABELS.private}
                  </label>
                  <input
                    type="text"
                    value={form.mailboxPrivateId}
                    onChange={(e) => setForm((f) => ({ ...f, mailboxPrivateId: e.target.value }))}
                    placeholder="0x + 64 Hex — on-chain Postfach"
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-[11px]"
                  />
                </div>
                {showExtraMailboxes || hasExtraMailboxSlots(form) ? (
                  <div className="space-y-2 border-t border-border/50 pt-2">
                    <p className="text-[10px] text-muted-foreground">Weitere Ziel-Mailboxen (Experte)</p>
                    {EXTRA_MAILBOX_SLOTS.map((slotId) => (
                      <div key={slotId} className="space-y-1">
                        <label className="text-[10px] font-medium text-muted-foreground">
                          {CONTACT_MAILBOX_SLOT_LABELS[slotId]}
                        </label>
                        <input
                          type="text"
                          value={form[MAILBOX_FORM_KEY[slotId]] as string}
                          onChange={(e) => {
                            const key = MAILBOX_FORM_KEY[slotId]
                            setForm((f) => ({ ...f, [key]: e.target.value }))
                          }}
                          placeholder="0x + 64 Hex"
                          className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-[11px]"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowExtraMailboxes(true)}
                    className="text-[10px] font-medium text-primary underline hover:no-underline"
                  >
                    Team / Einsatz / Puffer eintragen
                  </button>
                )}
              </div>
            </details>
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
      {cameraDialog}
    </>
  )
}
