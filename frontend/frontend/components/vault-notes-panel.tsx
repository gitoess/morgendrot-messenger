'use client'

import { useMemo, useRef, useState } from 'react'
import { FileText, FolderOpen, ImageIcon, Mic, Paperclip, Plus, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VaultNoteAttachment, VaultNoteEntry } from '@/frontend/lib/api/vault-notes'
import {
  ingestVaultNoteAttachment,
  vaultNoteAttachmentDataUrl,
  VN_MAX_ATTACHMENTS,
} from '@/frontend/lib/vault-note-attachment-ingest'

const VN_MAX_BODY = 50_000
const VN_MAX_TITLE = 120
const VN_MAX_FOLDER = 64

function newNoteId(): string {
  return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function emptyNote(folder?: string): VaultNoteEntry {
  return {
    id: newNoteId(),
    title: 'Neue Notiz',
    ...(folder?.trim() ? { folder: folder.trim().slice(0, VN_MAX_FOLDER) } : {}),
    body: '',
    updatedAt: Date.now(),
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`
  return `${(n / (1024 * 1024)).toFixed(1)} MiB`
}

function approxBase64Bytes(b64: string): number {
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((b64.length * 3) / 4) - pad)
}

function AttachmentIcon({ kind }: { kind: VaultNoteAttachment['kind'] }) {
  if (kind === 'image') return <ImageIcon className="h-3.5 w-3.5 shrink-0" />
  if (kind === 'audio') return <Mic className="h-3.5 w-3.5 shrink-0" />
  return <FileText className="h-3.5 w-3.5 shrink-0" />
}

type VaultNotesPanelProps = {
  unlocked: boolean
  notes: VaultNoteEntry[]
  onNotesChange: (notes: VaultNoteEntry[]) => void
}

export function VaultNotesPanel({ unlocked, notes, onNotesChange }: VaultNotesPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [folderFilter, setFolderFilter] = useState<string>('__all__')
  const [attachError, setAttachError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const folders = useMemo(() => {
    const set = new Set<string>()
    for (const n of notes) {
      const f = (n.folder ?? '').trim()
      if (f) set.add(f)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'de'))
  }, [notes])

  const filtered = useMemo(() => {
    if (folderFilter === '__all__') return notes
    if (folderFilter === '__none__') return notes.filter((n) => !(n.folder ?? '').trim())
    return notes.filter((n) => (n.folder ?? '').trim() === folderFilter)
  }, [notes, folderFilter])

  const selected = notes.find((n) => n.id === selectedId) ?? null
  const attachments = selected?.attachments ?? []

  const patchSelected = (patch: Partial<VaultNoteEntry>) => {
    if (!selectedId) return
    onNotesChange(
      notes.map((n) =>
        n.id === selectedId ? { ...n, ...patch, updatedAt: Date.now() } : n
      )
    )
  }

  const handleAdd = () => {
    const folder =
      folderFilter !== '__all__' && folderFilter !== '__none__' ? folderFilter : undefined
    const note = emptyNote(folder)
    onNotesChange([...notes, note])
    setSelectedId(note.id)
  }

  const handleDelete = () => {
    if (!selectedId) return
    if (!window.confirm('Diese Notiz löschen?')) return
    const next = notes.filter((n) => n.id !== selectedId)
    onNotesChange(next)
    setSelectedId(next[0]?.id ?? null)
  }

  const handleRemoveAttachment = (attId: string) => {
    const next = attachments.filter((a) => a.id !== attId)
    patchSelected({ attachments: next.length ? next : undefined })
  }

  const handleFilePick = async (files: FileList | null) => {
    setAttachError(null)
    if (!files?.length || !selectedId) return
    const file = files[0]
    if (!file) return
    if (attachments.length >= VN_MAX_ATTACHMENTS) {
      setAttachError(`Maximal ${VN_MAX_ATTACHMENTS} Anhänge pro Notiz.`)
      return
    }
    const result = await ingestVaultNoteAttachment(file)
    if (!result.ok) {
      setAttachError(result.message)
      return
    }
    patchSelected({ attachments: [...attachments, result.attachment] })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (!unlocked) {
    return (
      <p className="text-sm text-muted-foreground">
        Tresor entsperren, um Notizen zu bearbeiten.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <FolderOpen className="h-4 w-4" />
          Ordner
          <select
            value={folderFilter}
            onChange={(e) => setFolderFilter(e.target.value)}
            className="rounded-lg border border-border bg-input px-2 py-1 text-sm text-foreground"
          >
            <option value="__all__">Alle</option>
            <option value="__none__">Ohne Ordner</option>
            {folders.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium hover:bg-accent"
        >
          <Plus className="h-3.5 w-3.5" />
          Notiz
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,11rem)_1fr]">
        <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border bg-muted/20 p-2 text-sm">
          {filtered.length === 0 ? (
            <li className="px-2 py-1 text-muted-foreground">Keine Notizen — „Notiz“ anlegen.</li>
          ) : (
            filtered.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(n.id)
                    setAttachError(null)
                  }}
                  className={cn(
                    'w-full rounded-md px-2 py-1.5 text-left hover:bg-accent',
                    selectedId === n.id && 'bg-accent font-medium'
                  )}
                >
                  <span className="block truncate">{n.title || 'Ohne Titel'}</span>
                  {n.folder?.trim() ? (
                    <span className="block truncate text-[10px] text-muted-foreground">{n.folder}</span>
                  ) : null}
                  {(n.attachments?.length ?? 0) > 0 ? (
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {n.attachments!.length} Anhang{n.attachments!.length === 1 ? '' : 'e'}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>

        {selected ? (
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-muted-foreground">Titel</span>
                <input
                  value={selected.title}
                  maxLength={VN_MAX_TITLE}
                  onChange={(e) => patchSelected({ title: e.target.value.slice(0, VN_MAX_TITLE) })}
                  className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted-foreground">Ordner (optional)</span>
                <input
                  value={selected.folder ?? ''}
                  maxLength={VN_MAX_FOLDER}
                  onChange={(e) => {
                    const v = e.target.value.slice(0, VN_MAX_FOLDER)
                    patchSelected({ folder: v.trim() ? v : undefined })
                  }}
                  placeholder="z. B. Einsatz, Privat"
                  className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2"
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="text-muted-foreground">Inhalt</span>
              <textarea
                value={selected.body}
                maxLength={VN_MAX_BODY}
                rows={6}
                onChange={(e) => patchSelected({ body: e.target.value.slice(0, VN_MAX_BODY) })}
                className="mt-1 w-full resize-y rounded-lg border border-border bg-input px-3 py-2 min-h-[120px]"
              />
            </label>

            <div className="space-y-2 rounded-lg border border-border bg-muted/10 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Anhänge</span>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.gif,.webp,.bmp,.txt,.opus,.ogg,image/*,text/plain,audio/ogg"
                    className="hidden"
                    onChange={(e) => void handleFilePick(e.target.files)}
                  />
                  <button
                    type="button"
                    disabled={attachments.length >= VN_MAX_ATTACHMENTS}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    Datei
                  </button>
                  <span className="text-[10px] text-muted-foreground">
                    Bild, .txt, Opus/Ogg · max. {VN_MAX_ATTACHMENTS}
                  </span>
                </div>
              </div>
              {attachError ? (
                <p className="text-xs text-red-500">{attachError}</p>
              ) : null}
              {attachments.length === 0 ? (
                <p className="text-xs text-muted-foreground">Keine Anhänge.</p>
              ) : (
                <ul className="space-y-2">
                  {attachments.map((att) => (
                    <li
                      key={att.id}
                      className="rounded-md border border-border/60 bg-background p-2 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <AttachmentIcon kind={att.kind} />
                          <span className="truncate font-medium">{att.name}</span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {formatBytes(approxBase64Bytes(att.dataBase64))}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(att.id)}
                          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-red-500"
                          title="Anhang entfernen"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {att.kind === 'image' ? (
                        <img
                          src={vaultNoteAttachmentDataUrl(att)}
                          alt={att.name}
                          className="mt-2 max-h-40 rounded border border-border object-contain"
                        />
                      ) : null}
                      {att.kind === 'audio' ? (
                        <audio
                          controls
                          preload="metadata"
                          className="mt-2 w-full max-w-md"
                          src={vaultNoteAttachmentDataUrl(att)}
                        />
                      ) : null}
                      {att.kind === 'text' ? (
                        <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/30 p-2 text-xs">
                          {(att.textContent ?? '').slice(0, 4000)}
                          {(att.textContent?.length ?? 0) > 4000 ? '…' : ''}
                        </pre>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">
                {selected.body.length.toLocaleString('de-DE')} / {VN_MAX_BODY.toLocaleString('de-DE')} Zeichen
              </span>
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2 py-1 text-xs text-red-500 hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Löschen
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Notiz in der Liste wählen.</p>
        )}
      </div>
    </div>
  )
}
