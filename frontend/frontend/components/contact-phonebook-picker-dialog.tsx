'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookUser } from 'lucide-react'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { contactDisplayLabel } from '@/frontend/lib/contact-display'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export type ContactPhonebookPickerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  directory: Record<string, ContactMeshEntryClient>
  title?: string
  description?: string
  confirmLabel?: string
  /** Mehrfachauswahl (Standard: true) */
  multi?: boolean
  onConfirm: (addresses: string[]) => void
}

export function ContactPhonebookPickerDialog(p: ContactPhonebookPickerDialogProps) {
  const {
    open,
    onOpenChange,
    directory,
    title = 'Aus Telefonbuch wählen',
    description = 'Gespeicherte Kontakte mit 0x-Adresse. Anzeigename = Alias im Telefonbuch.',
    confirmLabel = 'Übernehmen',
    multi = true,
    onConfirm,
  } = p

  const entries = useMemo(() => {
    return Object.entries(directory)
      .map(([addr, e]) => ({
        addr: addr.trim(),
        label: (e.label ?? '').trim() || contactDisplayLabel(directory, addr) || '',
      }))
      .filter((x) => /^0x[a-fA-F0-9]{64}$/i.test(x.addr))
      .sort((a, b) => (a.label || a.addr).localeCompare(b.label || b.addr, 'de'))
  }, [directory])

  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (!open) setSelected(new Set())
  }, [open])

  const toggle = (addr: string) => {
    const key = addr.toLowerCase()
    setSelected((prev) => {
      const n = new Set(prev)
      if (!multi) {
        return n.has(key) ? new Set() : new Set([key])
      }
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }

  const confirm = () => {
    const addrs = entries.map((e) => e.addr).filter((a) => selected.has(a.toLowerCase()))
    if (addrs.length === 0) return
    onConfirm(addrs)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookUser className="h-5 w-5 text-primary" aria-hidden />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Kontakte — unten im Bereich <strong className="text-foreground">Telefonbuch</strong> eine Adresse
            anlegen oder aus dem Posteingang „Ins Telefonbuch“ nutzen.
          </p>
        ) : (
          <ul className="max-h-[50vh] space-y-1 overflow-y-auto rounded-md border border-border p-1">
            {entries.map(({ addr, label }) => {
              const on = selected.has(addr.toLowerCase())
              return (
                <li key={addr}>
                  <button
                    type="button"
                    onClick={() => toggle(addr)}
                    className={cn(
                      'flex w-full flex-col items-start rounded-md px-3 py-2 text-left text-sm transition-colors',
                      on ? 'bg-primary/15 ring-1 ring-primary/40' : 'hover:bg-muted'
                    )}
                  >
                    {label ? (
                      <span className="font-medium text-foreground">{label}</span>
                    ) : null}
                    <span className="font-mono text-[11px] text-muted-foreground break-all">{addr}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
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
            disabled={selected.size === 0}
            onClick={confirm}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {confirmLabel}
            {selected.size > 0 ? ` (${selected.size})` : ''}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
