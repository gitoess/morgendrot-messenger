'use client'

/**
 * Medien-Galerie mit Haken: Vorschaubilder / Labels nach Art, Auswahl speichern.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { Message } from '@/frontend/lib/types'
import {
  downloadMorgMediaListItems,
  downloadMorgMediaZipFromItems,
  listMorgMediaForExport,
  type MorgMediaKind,
  type MorgMediaKindFilter,
  type MorgMediaListItem,
} from '@/frontend/lib/einsatzprotokoll-export'
import { unlockRememberedPassphraseMessagesForExport } from '@/frontend/lib/einsatzbericht-export'

const KIND_SECTIONS: { kind: MorgMediaKind; title: string }[] = [
  { kind: 'image', title: 'Bilder' },
  { kind: 'audio', title: 'Audio' },
  { kind: 'file', title: 'Dateien' },
  { kind: 'text', title: 'Text-Anhänge' },
  { kind: 'slide', title: 'Slides' },
]

function objectUrlFor(item: MorgMediaListItem): string | null {
  if (item.kind !== 'image' && item.kind !== 'photo' && item.kind !== 'slide') return null
  const ext = item.filename.includes('.') ? item.filename.slice(item.filename.lastIndexOf('.') + 1) : ''
  const mime =
    ext === 'png'
      ? 'image/png'
      : ext === 'webp'
        ? 'image/webp'
        : ext === 'jpg' || ext === 'jpeg'
          ? 'image/jpeg'
          : 'application/octet-stream'
  if (!mime.startsWith('image/')) return null
  return URL.createObjectURL(new Blob([item.bytes], { type: mime }))
}

export type ChatViewMediaGalleryProps = {
  messages: Message[]
  /** Optional: vollständigen Verlauf laden (sonst nur `messages`). */
  loadMessages?: () => Promise<Message[]>
  kinds?: MorgMediaKindFilter | null
  /** Wenn gesetzt: nur diese Nachrichten (z. B. eine Zeile). */
  compact?: boolean
  onStatus?: (msg: string) => void
}

export function ChatViewMediaGallery(p: ChatViewMediaGalleryProps) {
  const [items, setItems] = useState<MorgMediaListItem[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const loaded = p.loadMessages ? await p.loadMessages() : []
      const raw = loaded.length > 0 ? loaded : p.messages
      /** Sichtbare Inbox zusätzlich mergen — falls Full-Load lückenhaft war. */
      const { mergeAllMessages } = await import('@/frontend/lib/message-dedup')
      const merged = mergeAllMessages([...raw, ...p.messages])
      const unlocked = await unlockRememberedPassphraseMessagesForExport(merged)
      const kinds: MorgMediaKindFilter | null = p.kinds
        ? {
            ...p.kinds,
            image: p.kinds.image === true || p.kinds.photo === true,
          }
        : null
      const list = await listMorgMediaForExport(unlocked.messages, { kinds })
      setItems(list)
      if (list.length === 0 && merged.length > 0) {
        setError(
          `${merged.length} Nachrichten gescannt, 0 Medien (nur MORG-Wire; Telegram-Cloud fehlt; versiegelt: ${unlocked.stillSealed}).`
        )
      }
      setSelected(new Set(list.map((x) => x.id)))
      const urls: Record<string, string> = {}
      for (const it of list) {
        const u = objectUrlFor(it)
        if (u) urls[it.id] = u
      }
      setPreviewUrls((prev) => {
        for (const u of Object.values(prev)) URL.revokeObjectURL(u)
        return urls
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [p.messages, p.loadMessages, p.kinds])

  useEffect(() => {
    void load()
    return () => {
      setPreviewUrls((prev) => {
        for (const u of Object.values(prev)) URL.revokeObjectURL(u)
        return {}
      })
    }
  }, [load])

  const byKind = useMemo(() => {
    const map = new Map<MorgMediaKind, MorgMediaListItem[]>()
    for (const it of items) {
      const arr = map.get(it.kind) ?? []
      arr.push(it)
      map.set(it.kind, arr)
    }
    return map
  }, [items])

  const selectedCount = selected.size
  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const selectAll = () => setSelected(new Set(items.map((x) => x.id)))
  const selectNone = () => setSelected(new Set())

  const saveSelected = async () => {
    const ids = [...selected]
    if (!ids.length) {
      p.onStatus?.('Keine Medien ausgewählt.')
      return
    }
    const { count } = await downloadMorgMediaListItems(items, ids)
    p.onStatus?.(
      count > 0
        ? `${count} Datei(en) gespeichert (Browser ggf. Mehrfach-Downloads erlauben).`
        : 'Nichts gespeichert.'
    )
  }

  const zipSelected = async () => {
    const ids = [...selected]
    if (!ids.length) {
      p.onStatus?.('Keine Medien ausgewählt.')
      return
    }
    const { count } = await downloadMorgMediaZipFromItems(items, ids)
    p.onStatus?.(count > 0 ? `ZIP mit ${count} Datei(en).` : 'ZIP leer.')
  }

  if (loading) {
    return <p className="text-xs text-muted-foreground">Medien werden geladen…</p>
  }
  if (error) {
    return <p className="text-xs text-destructive">{error}</p>
  }
  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Keine MORG-Medien in diesen Nachrichten (Telegram-Server-Medien fehlen hier).
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={selectAll}>
          Alle
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={selectNone}>
          Keine
        </Button>
        <span className="text-[11px] text-muted-foreground">
          {selectedCount}/{items.length} gewählt
        </span>
      </div>

      <div className={p.compact ? 'max-h-48 space-y-3 overflow-y-auto' : 'max-h-72 space-y-4 overflow-y-auto'}>
        {KIND_SECTIONS.map(({ kind, title }) => {
          const section = byKind.get(kind)
          if (!section?.length) return null
          return (
            <div key={kind}>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {title} ({section.length})
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {section.map((it) => {
                  const preview = previewUrls[it.id]
                  return (
                    <label
                      key={it.id}
                      className="flex cursor-pointer flex-col gap-1 rounded-md border border-border bg-muted/15 p-1.5 hover:bg-muted/30"
                    >
                      <span className="flex items-start gap-1.5">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={selected.has(it.id)}
                          onChange={() => toggle(it.id)}
                        />
                        <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-foreground">
                          {it.filename}
                        </span>
                      </span>
                      {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={preview}
                          alt=""
                          className="h-20 w-full rounded object-cover bg-muted"
                        />
                      ) : (
                        <span className="flex h-14 items-center justify-center rounded bg-muted/40 text-[10px] text-muted-foreground">
                          {it.kind === 'audio' ? '♪ Audio' : it.kind === 'file' || it.kind === 'text' ? '📄' : 'Datei'}{' '}
                          · {it.sizeLabel}
                        </span>
                      )}
                      <span className="text-[9px] text-muted-foreground">{it.sizeLabel}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid gap-2">
        <Button
          type="button"
          size="sm"
          disabled={selectedCount === 0}
          onClick={() => void saveSelected()}
        >
          Ausgewählte speichern ({selectedCount})
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={selectedCount === 0}
          onClick={() => void zipSelected()}
        >
          Ausgewählte als ZIP
        </Button>
      </div>
    </div>
  )
}
