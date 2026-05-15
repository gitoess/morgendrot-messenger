'use client'

/**
 * Telefonbuch: Anzeigename, IOTA-Adresse, Meshtastic Node-ID (optional) – GET/POST /api/contact-labels.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookUser, Save } from 'lucide-react'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { saveContactEntry } from '@/frontend/lib/api'
import { cn } from '@/lib/utils'

export type ChatViewPhonebookSectionProps = {
  directory: Record<string, ContactMeshEntryClient>
  refreshContactDirectory: () => void
  setStatusMsg: (msg: string) => void
}

type RowState = {
  label: string
  meshNodeId: string
  mailboxObjectId: string
}

export function ChatViewPhonebookSection(p: ChatViewPhonebookSectionProps) {
  const { directory, refreshContactDirectory, setStatusMsg } = p

  const sorted = useMemo(
    () =>
      Object.entries(directory).sort(([a], [b]) =>
        (directory[a]?.label || a).localeCompare(directory[b]?.label || b, 'de')
      ),
    [directory]
  )

  const [draft, setDraft] = useState<Record<string, RowState>>({})
  const [newAddr, setNewAddr] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    setDraft((prev) => {
      const next = { ...prev }
      for (const [addr, e] of Object.entries(directory)) {
        if (!next[addr]) {
          next[addr] = {
            label: e.label ?? '',
            meshNodeId: e.meshNodeId ?? '',
            mailboxObjectId: e.mailboxObjectId ?? '',
          }
        }
      }
      return next
    })
  }, [directory])

  const saveRow = useCallback(
    async (address: string) => {
      const row = draft[address]
      if (!row) return
      setBusy(address)
      try {
        const r = await saveContactEntry({
          address: address.trim(),
          label: row.label.trim() || undefined,
          meshNodeId: row.meshNodeId.trim() || undefined,
        })
        if (r.ok) {
          setDraft((d) => ({
            ...d,
            [address]: { label: row.label.trim(), meshNodeId: row.meshNodeId.trim() },
          }))
          setStatusMsg(r.message || 'Kontakt gespeichert.')
          refreshContactDirectory()
        } else {
          setStatusMsg(r.error || 'Speichern fehlgeschlagen.')
        }
      } finally {
        setBusy(null)
      }
    },
    [draft, refreshContactDirectory, setStatusMsg]
  )

  const addContact = useCallback(async () => {
    const a = newAddr.trim()
    if (!/^0x[a-fA-F0-9]{64}$/.test(a)) {
      setStatusMsg('Adresse: 0x + 64 Hex.')
      return
    }
    setBusy('__new__')
    try {
      const r = await saveContactEntry({ address: a, label: undefined })
      if (r.ok) {
        setNewAddr('')
        setStatusMsg('Kontakt angelegt – Label/Node-ID ergänzen und speichern.')
        refreshContactDirectory()
      } else {
        setStatusMsg(r.error || 'Anlegen fehlgeschlagen.')
      }
    } finally {
      setBusy(null)
    }
  }, [newAddr, refreshContactDirectory, setStatusMsg])

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <BookUser className="h-4 w-4 text-primary" />
        Telefonbuch / Kontakte
      </h4>
      <p className="mb-4 text-[11px] leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Anzeigename</strong> und{' '}
        <strong className="text-foreground">Meshtastic Node-ID</strong> (z. B. <span className="font-mono">!...</span>) helfen
        in Posteingang und Mesh-Zuordnung. Die <strong className="text-foreground">IOTA-Adresse</strong> ist der Schlüssel.
        Optional: <strong className="text-foreground">Alternative Mailbox</strong>, wenn der Kontakt eine eigene private
        Mailbox hat — sonst nutzt das System die gemeinsame Einsatz-Mailbox (M4).
      </p>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">Neue Adresse hinzufügen</label>
          <input
            type="text"
            value={newAddr}
            onChange={(e) => setNewAddr(e.target.value)}
            placeholder="0x… (64 Hex)"
            className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-xs"
          />
        </div>
        <button
          type="button"
          disabled={busy === '__new__'}
          onClick={() => void addContact()}
          className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
        >
          Hinzufügen
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground">Noch keine Kontakte – nach Handshake erscheinen Einträge, oder Adresse oben anlegen.</p>
      ) : (
        <ul className="space-y-3">
          {sorted.map(([addr, entry]) => {
            const st = draft[addr] ?? {
              label: entry.label ?? '',
              meshNodeId: entry.meshNodeId ?? '',
              mailboxObjectId: entry.mailboxObjectId ?? '',
            }
            const dirty =
              st.label !== (entry.label ?? '') ||
              st.meshNodeId !== (entry.meshNodeId ?? '') ||
              st.mailboxObjectId !== (entry.mailboxObjectId ?? '')
            return (
              <li
                key={addr}
                className="rounded-lg border border-border/80 bg-muted/10 p-3 space-y-2"
              >
                <p className="font-mono text-[11px] text-muted-foreground break-all" title={addr}>
                  {addr}
                </p>
                {entry.roleTags && entry.roleTags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {entry.roleTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground">Anzeigename</label>
                    <input
                      type="text"
                      value={st.label}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          [addr]: { ...st, label: e.target.value },
                        }))
                      }
                      placeholder="z. B. Einsatzleitung"
                      className="w-full rounded-md border border-border bg-input px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground">Meshtastic Node / Kennung</label>
                    <input
                      type="text"
                      value={st.meshNodeId}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          [addr]: { ...st, meshNodeId: e.target.value },
                        }))
                      }
                      placeholder="!abc123 oder Long Name"
                      className="w-full rounded-md border border-border bg-input px-2 py-1.5 font-mono text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground">
                    Alternative Mailbox (optional)
                  </label>
                  <input
                    type="text"
                    value={st.mailboxObjectId}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        [addr]: { ...st, mailboxObjectId: e.target.value },
                      }))
                    }
                    placeholder="Leer = gemeinsame Einsatz-Mailbox; sonst 0x… (64 Hex)"
                    className="w-full rounded-md border border-border bg-input px-2 py-1.5 font-mono text-[11px]"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Nur ausfüllen, wenn der Kontakt eine <strong className="text-foreground">eigene Mailbox</strong>{' '}
                    nutzt. Später: per QR beides auf einmal (M4c).
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy === addr || !dirty}
                  onClick={() => void saveRow(addr)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium',
                    dirty
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'border border-border text-muted-foreground opacity-60'
                  )}
                >
                  <Save className="h-3.5 w-3.5" />
                  {busy === addr ? 'Speichere…' : 'Speichern'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
