'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { saveContactEntry } from '@/frontend/lib/api'
import { contactDisplayLabel } from '@/frontend/lib/contact-display'
import {
  CONTACT_MAILBOX_SLOT_LABELS,
  type ContactMailboxSlotId,
  persistContactMailboxSlots,
  slotsFromEntry,
  slotsToSavePayload,
} from '@/frontend/lib/contact-mailbox-slots'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export type ContactMailboxPhonebookDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mailboxObjectId: string
  mailboxKind: 'private' | 'team'
  mailboxLabel?: string
  directory: Record<string, ContactMeshEntryClient>
  busy?: boolean
  onSaved?: () => void
}

function maskId(id: string): string {
  const t = id.trim()
  if (t.length < 20) return t
  return `${t.slice(0, 10)}…${t.slice(-6)}`
}

export function ContactMailboxPhonebookDialog(p: ContactMailboxPhonebookDialogProps) {
  const {
    open,
    onOpenChange,
    mailboxObjectId,
    mailboxKind,
    mailboxLabel,
    directory,
    busy: busyProp = false,
    onSaved,
  } = p

  const defaultSlot: ContactMailboxSlotId = mailboxKind === 'team' ? 'team' : 'private'
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [selectedAddress, setSelectedAddress] = useState('')
  const [slot, setSlot] = useState<ContactMailboxSlotId>(defaultSlot)
  const [newAddress, setNewAddress] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [localBusy, setLocalBusy] = useState(false)
  const [error, setError] = useState('')

  const contacts = useMemo(() => {
    return Object.entries(directory)
      .map(([addr, entry]) => ({
        addr: addr.trim().toLowerCase(),
        label: contactDisplayLabel(directory, addr) || entry.label?.trim() || '',
      }))
      .filter((x) => /^0x[a-fA-F0-9]{64}$/i.test(x.addr))
      .sort((a, b) => (a.label || a.addr).localeCompare(b.label || b.addr, 'de'))
  }, [directory])

  useEffect(() => {
    if (!open) return
    setMode(contacts.length > 0 ? 'existing' : 'new')
    setSelectedAddress(contacts[0]?.addr ?? '')
    setSlot(defaultSlot)
    setNewAddress('')
    setNewLabel(mailboxLabel?.trim() || '')
    setError('')
  }, [open, contacts, defaultSlot, mailboxLabel])

  const busy = busyProp || localBusy

  const save = async () => {
    setError('')
    const mbId = mailboxObjectId.trim().toLowerCase()
    if (!/^0x[a-fA-F0-9]{64}$/.test(mbId)) {
      setError('Ungültige Mailbox-ID.')
      return
    }

    let address = ''
    let label: string | undefined
    if (mode === 'existing') {
      address = selectedAddress.trim().toLowerCase()
      if (!/^0x[a-fA-F0-9]{64}$/.test(address)) {
        setError('Bitte einen Kontakt aus der Liste wählen.')
        return
      }
      label = directory[address]?.label?.trim() || undefined
    } else {
      address = newAddress.trim().toLowerCase()
      if (!/^0x[a-fA-F0-9]{64}$/.test(address)) {
        setError('Neue Kontakt-Adresse: 0x + 64 Hex-Zeichen.')
        return
      }
      label = newLabel.trim() || undefined
    }

    const existingSlots = slotsFromEntry(directory[address], address)
    const merged = {
      mailboxSharedId: slot === 'shared' ? mbId : existingSlots.mailboxSharedId ?? '',
      mailboxPrivateId: slot === 'private' ? mbId : existingSlots.mailboxPrivateId ?? '',
      mailboxTeamId: slot === 'team' ? mbId : existingSlots.mailboxTeamId ?? '',
      mailboxBufferId: slot === 'buffer' ? mbId : existingSlots.mailboxBufferId ?? '',
    }
    const slotScope = persistContactMailboxSlots(address, merged)

    setLocalBusy(true)
    try {
      const r = await saveContactEntry({
        address,
        ...(label ? { label } : {}),
        ...(slotScope === 'telefonbuch' ? slotsToSavePayload(merged) : {}),
      })
      if (!r.ok) {
        setError(r.error || 'Speichern fehlgeschlagen.')
        return
      }
      onSaved?.()
      onOpenChange(false)
    } finally {
      setLocalBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mailbox ins Telefonbuch</DialogTitle>
          <DialogDescription>
            Die Mailbox-ID wird einem Kontakt zugeordnet (Slot{' '}
            <strong className="text-foreground">{CONTACT_MAILBOX_SLOT_LABELS[slot]}</strong>) — für Senden und
            Routing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-md border border-border bg-muted/30 px-2 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Mailbox</p>
            <code className="font-mono text-[11px] break-all">{maskId(mailboxObjectId)}</code>
            {mailboxLabel?.trim() ? (
              <p className="mt-1 text-xs text-foreground">{mailboxLabel.trim()}</p>
            ) : null}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={contacts.length === 0}
              onClick={() => setMode('existing')}
              className={cn(
                'flex-1 rounded-lg border px-2 py-2 text-xs font-medium',
                mode === 'existing' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent',
                contacts.length === 0 && 'opacity-50'
              )}
            >
              Bestehender Kontakt
            </button>
            <button
              type="button"
              onClick={() => setMode('new')}
              className={cn(
                'flex-1 rounded-lg border px-2 py-2 text-xs font-medium',
                mode === 'new' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'
              )}
            >
              Neuer Kontakt
            </button>
          </div>

          {mode === 'existing' ? (
            contacts.length === 0 ? (
              <p className="text-xs text-muted-foreground">Noch keine Kontakte — «Neuer Kontakt» wählen.</p>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-1">
                {contacts.map(({ addr, label: lbl }) => {
                  const on = selectedAddress === addr
                  return (
                    <li key={addr}>
                      <button
                        type="button"
                        onClick={() => setSelectedAddress(addr)}
                        className={cn(
                          'flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left text-xs',
                          on ? 'bg-primary/15 ring-1 ring-primary/40' : 'hover:bg-muted'
                        )}
                      >
                        {lbl ? <span className="font-medium text-foreground">{lbl}</span> : null}
                        <span className="font-mono text-[10px] text-muted-foreground break-all">{addr}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )
          ) : (
            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Wallet-Adresse (0x…)</label>
                <input
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="0x…"
                  className="mt-1 w-full rounded-md border border-border bg-input px-2 py-1.5 font-mono text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Anzeigename</label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="z. B. THW Gruppe Nord"
                  className="mt-1 w-full rounded-md border border-border bg-input px-2 py-1.5 text-xs"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground">Mailbox-Slot beim Kontakt</label>
            <select
              value={slot}
              onChange={(e) => setSlot(e.target.value as ContactMailboxSlotId)}
              className="mt-1 w-full rounded-md border border-border bg-input px-2 py-1.5 text-xs"
            >
              {(Object.keys(CONTACT_MAILBOX_SLOT_LABELS) as ContactMailboxSlotId[]).map((id) => (
                <option key={id} value={id}>
                  {CONTACT_MAILBOX_SLOT_LABELS[id]}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
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
            onClick={() => void save()}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? 'Speichere…' : 'Speichern'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
