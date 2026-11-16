'use client'

/**
 * Medien-Galerie mit Haken: Vorschaubilder / Labels nach Art, Auswahl speichern.
 * Vollständigen Verlauf nur auf Knopf — nicht auto (vermeidet Render-/Fetch-Schleifen).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  messages: readonly Message[]
  /** Optional: vollständigen Verlauf laden (nur per Knopf). */
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
  const [scanNote, setScanNote] = useState('')
  const messagesRef = useRef(p.messages)
  const loadMessagesRef = useRef(p.loadMessages)
  const kindsRef = useRef(p.kinds)
  messagesRef.current = p.messages
  loadMessagesRef.current = p.loadMessages
  kindsRef.current = p.kinds

  const applyList = useCallback(async (src: Message[]) => {
    const unlocked = await unlockRememberedPassphraseMessagesForExport(src)
    const kindsRaw = kindsRef.current
    const kinds: MorgMediaKindFilter | null = kindsRaw
      ? {
          ...kindsRaw,
          image: kindsRaw.image === true || kindsRaw.photo === true,
        }
      : null
    const list = await listMorgMediaForExport(unlocked.messages, { kinds })
    setItems(list)
    setSelected(new Set(list.map((x) => x.id)))
    if (list.length === 0 && src.length > 0) {
      setError(
        `${src.length} Nachrichten gescannt, 0 Medien (nur MORG-Wire; Telegram-Cloud fehlt; versiegelt: ${unlocked.stillSealed}).`
      )
    } else {
      setError('')
    }
    setScanNote(`${src.length} Nachrichten · ${list.length} Medien`)
    const urls: Record<string, string> = {}
    for (const it of list) {
      const u = objectUrlFor(it)
      if (u) urls[it.id] = u
    }
    setPreviewUrls((prev) => {
      for (const u of Object.values(prev)) URL.revokeObjectURL(u)
      return urls
    })
  }, [])

  /** Nur sichtbare Inbox — kein Full-Fetch (sonst API-Sturm). */
  const loadVisible = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await applyList([...messagesRef.current])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [applyList])

  const loadFull = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const visibleBefore = messagesRef.current.length
      const loader = loadMessagesRef.current
      const loaded = loader ? await loader() : []
      const { mergeAllMessages } = await import('@/frontend/lib/message-dedup')
      const merged = mergeAllMessages([...(loaded.length ? loaded : []), ...messagesRef.current])
      await applyList(merged)
      setScanNote(
        `Vollscan: ${loaded.length} von API/Mailboxen · ${merged.length} gesamt` +
          (loaded.length <= visibleBefore
            ? ` (sichtbar waren ${visibleBefore} — wenn Medien gleich: keine älteren MORG-Wires)`
            : ` (vorher sichtbar ${visibleBefore})`)
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [applyList])

  /** Kinds-Änderung: sichtbare Liste neu scannen (kein Full-Load). */
  const kindsKey = JSON.stringify(p.kinds ?? null)
  useEffect(() => {
    void loadVisible()
    return () => {
      setPreviewUrls((prev) => {
        for (const u of Object.values(prev)) URL.revokeObjectURL(u)
        return {}
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur kinds / compact-Wechsel
  }, [kindsKey, p.compact, loadVisible])

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
    try {
      const { count } = await downloadMorgMediaListItems(items, ids)
      p.onStatus?.(count ? `${count} Datei(en) gespeichert.` : 'Nichts gespeichert.')
    } catch (e) {
      p.onStatus?.(e instanceof Error ? e.message : String(e))
    }
  }

  const zipSelected = async () => {
    const ids = [...selected]
    if (!ids.length) {
      p.onStatus?.('Keine Medien ausgewählt.')
      return
    }
    try {
      const { count } = await downloadMorgMediaZipFromItems(items, ids)
      p.onStatus?.(count ? `Medien-ZIP: ${count} Datei(en).` : 'ZIP leer.')
    } catch (e) {
      p.onStatus?.(e instanceof Error ? e.message : String(e))
    }
  }

  if (p.compact && items.length === 0 && !loading && !error) {
    return <p className="text-xs text-muted-foreground">Keine MORG-Medien in dieser Auswahl.</p>
  }

  const needsFullScanHint = !loading && items.length === 0 && Boolean(p.loadMessages)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {p.loadMessages ? (
          <Button
            type="button"
            size="sm"
            variant={needsFullScanHint ? 'default' : 'outline'}
            disabled={loading}
            onClick={() => void loadFull()}
          >
            {loading ? 'Lädt…' : 'Gesamten Verlauf scannen'}
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="ghost" disabled={loading} onClick={() => void loadVisible()}>
          Sichtbare neu
        </Button>
        {scanNote ? <span className="text-[10px] text-muted-foreground">{scanNote}</span> : null}
      </div>
      {needsFullScanHint ? (
        <p className="text-xs text-foreground">
          In der sichtbaren Liste keine MORG-Medien. Ältere Posts/Audios/Bilder nur nach „Gesamten Verlauf
          scannen“ (lädt alle Mailboxen + Unlock).
        </p>
      ) : null}
      {loading ? <p className="text-xs text-muted-foreground">Medien werden gelesen…</p> : null}
      {error ? <p className="text-xs text-amber-800 dark:text-amber-200">{error}</p> : null}
      {!loading && items.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={selectAll}>
              Alle ({items.length})
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={selectNone}>
              Keine
            </Button>
            <Button type="button" size="sm" disabled={selectedCount === 0} onClick={() => void saveSelected()}>
              Speichern ({selectedCount})
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={selectedCount === 0}
              onClick={() => void zipSelected()}
            >
              ZIP ({selectedCount})
            </Button>
          </div>
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {KIND_SECTIONS.map(({ kind, title }) => {
              const group = byKind.get(kind)
              if (!group?.length) return null
              return (
                <div key={kind}>
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {title} ({group.length})
                  </p>
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                    {group.map((it) => {
                      const checked = selected.has(it.id)
                      const preview = previewUrls[it.id]
                      return (
                        <label
                          key={it.id}
                          className="flex cursor-pointer flex-col gap-1 rounded-md border border-border bg-muted/15 p-1.5 hover:bg-muted/30"
                        >
                          <span className="flex items-start gap-1">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={checked}
                              onChange={() => toggle(it.id)}
                            />
                            <span className="min-w-0 flex-1 truncate text-[10px] leading-tight text-foreground">
                              {it.filename}
                            </span>
                          </span>
                          {preview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={preview} alt="" className="h-14 w-full rounded object-cover" />
                          ) : (
                            <span className="flex h-14 items-center justify-center rounded bg-muted/40 text-[10px] text-muted-foreground">
                              {it.kind} · {it.sizeLabel}
                            </span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : null}
    </div>
  )
}
