'use client'

import { useMemo, useState } from 'react'
import { Eye, EyeOff, KeyRound, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PersonalSecretEntry } from '@/frontend/lib/api/vault-personal-secrets'

const MAX_TITLE = 120
const MAX_USER = 120
const MAX_SECRET = 8_000
const MAX_NOTE = 4_000

function newSecretId(): string {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function emptyEntry(): PersonalSecretEntry {
  return {
    id: newSecretId(),
    title: 'Neuer Eintrag',
    username: '',
    secret: '',
    note: '',
    updatedAt: Date.now(),
  }
}

type Props = {
  unlocked: boolean
  entries: PersonalSecretEntry[]
  onEntriesChange: (entries: PersonalSecretEntry[]) => void
}

export function VaultPersonalSecretsPanel({ unlocked, entries, onEntriesChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reveal, setReveal] = useState(false)
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return entries
    return entries.filter((e) => {
      const blob = `${e.title || ''} ${e.username || ''} ${e.note || ''}`.toLowerCase()
      return blob.includes(needle)
    })
  }, [entries, q])

  const selected = entries.find((e) => e.id === selectedId) ?? null

  const patchSelected = (patch: Partial<PersonalSecretEntry>) => {
    if (!selectedId) return
    onEntriesChange(
      entries.map((e) =>
        e.id === selectedId ? { ...e, ...patch, updatedAt: Date.now() } : e
      )
    )
  }

  if (!unlocked) {
    return (
      <p className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
        Tresor entsperren, um Passwörter / Safe-Einträge zu bearbeiten.
      </p>
    )
  }

  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,14rem)_1fr]">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
            onClick={() => {
              const next = emptyEntry()
              onEntriesChange([next, ...entries])
              setSelectedId(next.id)
              setReveal(false)
            }}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Neu
          </button>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Suchen…"
            className="h-8 min-w-0 flex-1 rounded-md border border-border bg-input px-2 text-xs"
          />
        </div>
        <ul className="max-h-[min(50vh,22rem)] space-y-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="px-1 py-2 text-[11px] text-muted-foreground">Keine Einträge.</li>
          ) : (
            filtered.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(e.id)
                    setReveal(false)
                  }}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted/60',
                    selectedId === e.id && 'bg-muted'
                  )}
                >
                  <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">
                      {e.title?.trim() || 'Ohne Titel'}
                    </span>
                    {e.username?.trim() ? (
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {e.username}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="space-y-2 rounded-lg border border-border/70 bg-muted/10 p-3">
        {!selected ? (
          <p className="text-sm text-muted-foreground">
            Eintrag wählen oder „Neu“ — liegt im Tresor (Vault), nicht on-chain.
          </p>
        ) : (
          <>
            <label className="block space-y-1">
              <span className="text-[10px] font-medium text-muted-foreground">Titel</span>
              <input
                value={selected.title || ''}
                maxLength={MAX_TITLE}
                onChange={(e) => patchSelected({ title: e.target.value.slice(0, MAX_TITLE) })}
                className="w-full rounded-md border border-border bg-input px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-medium text-muted-foreground">Benutzer / Login</span>
              <input
                value={selected.username || ''}
                maxLength={MAX_USER}
                onChange={(e) => patchSelected({ username: e.target.value.slice(0, MAX_USER) })}
                className="w-full rounded-md border border-border bg-input px-2.5 py-1.5 text-sm"
                autoComplete="off"
              />
            </label>
            <label className="block space-y-1">
              <span className="flex items-center justify-between text-[10px] font-medium text-muted-foreground">
                Geheimnis / Passwort
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                  onClick={() => setReveal((v) => !v)}
                >
                  {reveal ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {reveal ? 'verbergen' : 'zeigen'}
                </button>
              </span>
              <input
                type={reveal ? 'text' : 'password'}
                value={selected.secret || ''}
                maxLength={MAX_SECRET}
                onChange={(e) => patchSelected({ secret: e.target.value.slice(0, MAX_SECRET) })}
                className="w-full rounded-md border border-border bg-input px-2.5 py-1.5 font-mono text-sm"
                autoComplete="off"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-medium text-muted-foreground">Notiz</span>
              <textarea
                value={selected.note || ''}
                maxLength={MAX_NOTE}
                rows={3}
                onChange={(e) => patchSelected({ note: e.target.value.slice(0, MAX_NOTE) })}
                className="w-full resize-y rounded-md border border-border bg-input px-2.5 py-1.5 text-sm"
              />
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                onClick={() => {
                  onEntriesChange(entries.filter((e) => e.id !== selected.id))
                  setSelectedId(null)
                  setReveal(false)
                }}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Löschen
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
