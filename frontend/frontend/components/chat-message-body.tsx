'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, FileText } from 'lucide-react'
import {
  normalizeMessengerWireContent,
  parseCompactImageMessage,
  parseCompactTextMessage,
  parseFileTxtMessage,
  parseMorgAudioV1Message,
} from '@/frontend/lib/compact-image-wire'
import { reconstructCompactImageToDataUrl } from '@/frontend/lib/compact-image-canvas'
import type { Message } from '@/frontend/lib/types'
import {
  parseLoraProgressiveMessage,
  findPartnerChromaJpeg,
  fuseLoraProgressivePreferSharpBackend,
  uint8ToObjectUrl,
  revokeObjectUrlSafe,
  downloadUint8AsFile,
  downloadDataUrlAsFile,
  LORA_CHROMA_WAIT_MS,
} from '@/frontend/lib/lora-progressive-image-client'
import { cn } from '@/lib/utils'

const TXT_PREVIEW_CHARS = 480
const TXT_COLLAPSE_MAX_H = 'max-h-36' /* 9rem */

function downloadTextFile(fileName: string, utf8Text: string) {
  const blob = new Blob([utf8Text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function CollapsiblePlainText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const long = text.length > TXT_PREVIEW_CHARS || text.split('\n').length > 8
  const [open, setOpen] = useState(!long)
  const preview = long && !open ? text.slice(0, TXT_PREVIEW_CHARS).trimEnd() + '…' : text

  return (
    <div className="space-y-1.5">
      <pre
        className={cn(
          'overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-2.5 text-sm text-foreground leading-relaxed',
          !open && long ? `${TXT_COLLAPSE_MAX_H}` : 'max-h-96',
          className
        )}
      >
        {preview}
      </pre>
      {long ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {open ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" aria-hidden />
              Weniger
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              Volltext ({text.length.toLocaleString('de-DE')} Zeichen)
            </>
          )}
        </button>
      ) : null}
    </div>
  )
}

/** Opus in Ogg: Blob-URL + &lt;audio controls&gt; – zuverlässiger als data:-URL in Chromium/Safari. */
function MorgAudioPlayer({ blobBase64 }: { blobBase64: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setErr(null)
    let alive = true
    const b64 = blobBase64.replace(/\s/g, '')
    try {
      const bin = atob(b64)
      const u8 = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
      if (u8.length < 4 || String.fromCharCode(u8[0]!, u8[1]!, u8[2]!, u8[3]!) !== 'OggS') {
        if (alive) setErr('Kein Ogg-Container (erwartet Magic „OggS“).')
        return
      }
      const blob = new Blob([u8], { type: 'audio/ogg' })
      const u = URL.createObjectURL(blob)
      if (alive) setUrl(u)
      return () => {
        alive = false
        URL.revokeObjectURL(u)
      }
    } catch {
      if (alive) setErr('Base64/Ogg-Daten ungültig.')
    }
    return () => {
      alive = false
    }
  }, [blobBase64])

  if (err) {
    return <p className="text-xs text-amber-600 dark:text-amber-400">{err}</p>
  }

  if (!url) {
    return <p className="text-xs text-muted-foreground">Audio wird vorbereitet…</p>
  }

  return (
    <audio controls className="h-10 w-full max-w-md rounded-md" src={url} preload="metadata">
      Dein Browser unterstützt kein HTML-Audio.
    </audio>
  )
}

/**
 * MORG_LUMA_V1 / MORG_CHROMA_V1 (gleiche msgId): S/W sofort, Hinweis unter dem Bild, Fusion ersetzt Anzeige.
 * 60 s ab erster Anzeige ohne Chroma → Fehlertext. Fusion: Backend sharp `over`, sonst Canvas-Fallback.
 */
function LoRaProgressiveLumaBody({
  content,
  inboxMessages,
  selfMessage,
  copyRaw,
  copiedRaw,
}: {
  content: string
  inboxMessages: Message[]
  selfMessage: Message
  copyRaw: () => void
  copiedRaw: boolean
}) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null)
  const [decErr, setDecErr] = useState<string | null>(null)
  const [chromaTimedOut, setChromaTimedOut] = useState(false)
  /** Wallclock-Start für 60 s Timeout – wird nicht bei jedem anderen Inbox-Eintrag zurückgesetzt. */
  const chromaWaitStartedAtRef = useRef<number | null>(null)

  const parsed = useMemo(() => parseLoraProgressiveMessage(content), [content])
  const msgId = parsed?.kind === 'luma' ? parsed.msgId : ''
  const caption = parsed?.kind === 'luma' ? parsed.caption : undefined
  const lumaJpeg = parsed?.kind === 'luma' ? parsed.jpeg : null

  const inboxSig = useMemo(
    () => inboxMessages.map((m) => `${m.id}:${(m.content ?? '').length}`).join('|'),
    [inboxMessages]
  )

  const hasChroma = useMemo(() => {
    if (!msgId) return false
    return (
      findPartnerChromaJpeg(inboxMessages, selfMessage.from, msgId, selfMessage.timestamp) != null
    )
  }, [inboxMessages, selfMessage.from, selfMessage.id, selfMessage.timestamp, msgId])

  useEffect(() => {
    let alive = true
    let lumaObjUrl: string | null = null
    setDecErr(null)
    setDisplayUrl(null)
    const p = parseLoraProgressiveMessage(content)
    if (!p || p.kind !== 'luma' || !msgId) return
    const chroma = findPartnerChromaJpeg(
      inboxMessages,
      selfMessage.from,
      msgId,
      selfMessage.timestamp
    )
    void (async () => {
      try {
        if (chroma) {
          const u = await fuseLoraProgressivePreferSharpBackend(p.jpeg, chroma)
          if (alive) setDisplayUrl(u)
        } else {
          lumaObjUrl = uint8ToObjectUrl(p.jpeg)
          if (alive) setDisplayUrl(lumaObjUrl)
        }
      } catch (e) {
        if (alive) setDecErr(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      alive = false
      revokeObjectUrlSafe(lumaObjUrl)
    }
  }, [content, inboxSig, selfMessage.from, selfMessage.id, selfMessage.timestamp, msgId])

  useEffect(() => {
    if (!msgId) return
    const chroma = findPartnerChromaJpeg(
      inboxMessages,
      selfMessage.from,
      msgId,
      selfMessage.timestamp
    )
    if (chroma) {
      setChromaTimedOut(false)
      chromaWaitStartedAtRef.current = null
      return
    }
    if (chromaWaitStartedAtRef.current === null) {
      chromaWaitStartedAtRef.current = Date.now()
    }
    const elapsed = Date.now() - chromaWaitStartedAtRef.current
    const remaining = Math.max(0, LORA_CHROMA_WAIT_MS - elapsed)
    const t = window.setTimeout(() => setChromaTimedOut(true), remaining)
    return () => window.clearTimeout(t)
  }, [inboxSig, selfMessage.from, selfMessage.id, selfMessage.timestamp, msgId])

  if (!lumaJpeg || !msgId) {
    return (
      <p className="text-xs text-muted-foreground">LoRa Luma-Wire ungültig.</p>
    )
  }

  return (
    <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3">
      {decErr && <p className="text-xs text-red-400">{decErr}</p>}
      {!displayUrl && !decErr && (
        <p className="text-xs text-muted-foreground">Bild wird dekodiert…</p>
      )}
      {displayUrl ? (
        <img
          src={displayUrl}
          alt={hasChroma ? 'LoRa Bild (Luma+Chroma)' : 'LoRa S/W (Luma)'}
          className="max-h-96 max-w-full rounded-lg border border-border object-contain"
        />
      ) : null}
      {displayUrl && !hasChroma && !chromaTimedOut ? (
        <p className="text-xs text-muted-foreground">Farbübertragung läuft…</p>
      ) : null}
      {displayUrl && chromaTimedOut && !hasChroma ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Farbübertragung fehlgeschlagen – S/W-Bild angezeigt.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => downloadUint8AsFile(lumaJpeg, `lora-${msgId}-luma.jpg`)}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          S/W-Bild speichern/exportieren
        </button>
      </div>
      {caption ? (
        <p className="whitespace-pre-wrap break-words text-sm text-foreground">{caption}</p>
      ) : null}
      <button
        type="button"
        onClick={() => void copyRaw()}
        className="text-xs font-medium text-primary hover:underline"
      >
        {copiedRaw ? 'Kopiert' : 'Wire kopieren'}
      </button>
    </div>
  )
}

/** Nur sichtbar wenn kein passendes Luma in der Inbox (verwaiste Phase 2). */
function LoRaChromaOrphanBody({
  content,
  copyRaw,
  copiedRaw,
}: {
  content: string
  copyRaw: () => void
  copiedRaw: boolean
}) {
  const [url, setUrl] = useState<string | null>(null)
  const parsed = useMemo(() => parseLoraProgressiveMessage(content), [content])
  const msgId = parsed?.kind === 'chroma' ? parsed.msgId : ''
  useEffect(() => {
    const p = parseLoraProgressiveMessage(content)
    if (!p || p.kind !== 'chroma') {
      setUrl(null)
      return
    }
    const u = uint8ToObjectUrl(p.jpeg)
    setUrl(u)
    return () => revokeObjectUrlSafe(u)
  }, [content])
  if (!parsed || parsed.kind !== 'chroma') {
    return <p className="text-xs text-muted-foreground">LoRa Chroma-Wire ungültig.</p>
  }
  return (
    <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3">
      <p className="text-xs text-amber-700 dark:text-amber-300">
        LoRa Farbphase ohne zugehöriges S/W (msgId {msgId}) – nur Chroma-JPEG.
      </p>
      {url ? (
        <img
          src={url}
          alt="LoRa Chroma (verwaist)"
          className="max-h-48 max-w-full rounded-lg border border-border object-contain"
        />
      ) : null}
      <button
        type="button"
        onClick={() => downloadUint8AsFile(parsed.jpeg, `lora-${msgId}-chroma.jpg`)}
        className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
      >
        Chroma-JPEG speichern
      </button>
      <button
        type="button"
        onClick={() => void copyRaw()}
        className="text-xs font-medium text-primary hover:underline"
      >
        {copiedRaw ? 'Kopiert' : 'Wire kopieren'}
      </button>
    </div>
  )
}

export function ChatMessageBody({
  content,
  inboxMessages = [],
  selfMessage,
}: {
  content: string
  /** Für LoRa Luma/Chroma-Zusammenführung (gleiche Inbox). */
  inboxMessages?: Message[]
  /** Aktuelle Nachrichtenzeile (Absender, Zeitstempel). */
  selfMessage?: Message
}) {
  const raw = String(content ?? '')
  /** Anzeige: einmal voll normalisiert. Parser bekommen `raw` und probieren mehrere Varianten (JSON-Hülle, Slice ab `[[`, …). */
  const wire = useMemo(() => normalizeMessengerWireContent(raw), [content])

  const parsedImg = parseCompactImageMessage(raw)
  const parsedFile = parsedImg ? null : parseFileTxtMessage(raw)
  const parsedAudio = parsedImg || parsedFile ? null : parseMorgAudioV1Message(raw)
  const parsedTxt = parsedImg || parsedFile || parsedAudio ? null : parseCompactTextMessage(raw)
  const parsedLora =
    parsedImg || parsedFile || parsedAudio || parsedTxt ? null : parseLoraProgressiveMessage(raw)

  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState<'raw' | 'plain' | false>(false)

  useEffect(() => {
    if (!parsedImg) {
      setImgUrl(null)
      setErr(null)
      return
    }
    let alive = true
    setImgUrl(null)
    setErr(null)
    void reconstructCompactImageToDataUrl(parsedImg.blobBase64)
      .then((u) => {
        if (alive) setImgUrl(u)
      })
      .catch((e) => {
        if (alive) setErr(e instanceof Error ? e.message : String(e))
      })
    return () => {
      alive = false
    }
  }, [parsedImg?.blobBase64, content])

  const copyRaw = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied('raw')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const copyPlainTxt = async () => {
    const body = parsedTxt?.text ?? parsedFile?.text
    if (body == null) return
    try {
      const cap = (parsedTxt?.caption ?? parsedFile?.caption)?.trim()
      const out = cap ? `${body}\n\n${cap}` : body
      await navigator.clipboard.writeText(out)
      setCopied('plain')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  if (parsedImg) {
    return (
      <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3">
        {err && <p className="text-xs text-red-400">{err}</p>}
        {!imgUrl && !err && <p className="text-xs text-muted-foreground">Bild wird dekodiert…</p>}
        {imgUrl ? (
          <img
            src={imgUrl}
            alt="Kompaktes Bild (Luma+Chroma)"
            className="max-h-96 max-w-full rounded-lg border border-border object-contain"
          />
        ) : null}
        {parsedImg.caption ? (
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">{parsedImg.caption}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {imgUrl ? (
            <button
              type="button"
              onClick={() => downloadDataUrlAsFile(imgUrl, 'morg-compact-img.jpg')}
              className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              Bild speichern
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void copyRaw()}
            className="rounded-md border border-border bg-transparent px-2.5 py-1.5 text-xs font-medium text-primary hover:underline"
          >
            {copied === 'raw' ? 'Kopiert' : 'Wire kopieren'}
          </button>
        </div>
      </div>
    )
  }

  if (parsedAudio) {
    return (
      <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
          <span className="rounded bg-primary/15 px-2 py-0.5 text-xs text-primary">Sprache</span>
          <span className="text-muted-foreground">Opus/Ogg</span>
        </div>
        <MorgAudioPlayer blobBase64={parsedAudio.blobBase64} />
        {parsedAudio.caption ? (
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">{parsedAudio.caption}</p>
        ) : null}
        <button
          type="button"
          onClick={() => void copyRaw()}
          className="text-xs font-medium text-primary hover:underline"
        >
          {copied === 'raw' ? 'Kopiert' : 'Wire kopieren'}
        </button>
      </div>
    )
  }

  if (parsedFile) {
    const lines = parsedFile.text.split('\n').length
    return (
      <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="break-all text-sm font-medium text-foreground">{parsedFile.fileName}</span>
          <span className="text-xs text-muted-foreground">
            .txt · {parsedFile.text.length.toLocaleString('de-DE')} Zeichen · {lines} Zeilen
          </span>
        </div>
        <CollapsiblePlainText text={parsedFile.text} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadTextFile(parsedFile.fileName, parsedFile.text)}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            Datei speichern…
          </button>
        </div>
        {parsedFile.caption ? (
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">{parsedFile.caption}</p>
        ) : null}
        <div className="flex flex-wrap gap-3 border-t border-border/60 pt-2">
          <button
            type="button"
            onClick={() => void copyRaw()}
            className="text-xs font-medium text-primary hover:underline"
          >
            {copied === 'raw' ? 'Kopiert' : 'Wire kopieren'}
          </button>
          <button
            type="button"
            onClick={() => void copyPlainTxt()}
            className="text-xs font-medium text-primary hover:underline"
          >
            {copied === 'plain' ? 'Kopiert' : 'Inhalt kopieren'}
          </button>
        </div>
      </div>
    )
  }

  if (parsedTxt) {
    return (
      <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3">
        <div className="text-xs font-medium text-muted-foreground">Eingebetteter Text (MORG_TXT_V1)</div>
        <CollapsiblePlainText text={parsedTxt.text} />
        {parsedTxt.caption ? (
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">{parsedTxt.caption}</p>
        ) : null}
        <div className="flex flex-wrap gap-3 border-t border-border/60 pt-2">
          <button
            type="button"
            onClick={() => void copyRaw()}
            className="text-xs font-medium text-primary hover:underline"
          >
            {copied === 'raw' ? 'Kopiert' : 'Wire kopieren'}
          </button>
          <button
            type="button"
            onClick={() => void copyPlainTxt()}
            className="text-xs font-medium text-primary hover:underline"
          >
            {copied === 'plain' ? 'Kopiert' : 'Klartext kopieren'}
          </button>
        </div>
      </div>
    )
  }

  if (parsedLora?.kind === 'luma' && selfMessage) {
    return (
      <LoRaProgressiveLumaBody
        content={raw}
        inboxMessages={inboxMessages}
        selfMessage={selfMessage}
        copyRaw={copyRaw}
        copiedRaw={copied === 'raw'}
      />
    )
  }

  if (parsedLora?.kind === 'chroma') {
    return (
      <LoRaChromaOrphanBody
        content={raw}
        copyRaw={copyRaw}
        copiedRaw={copied === 'raw'}
      />
    )
  }

  const looksLikeWire =
    wire.startsWith('[[') ||
    (wire.length > 200 && /^[A-Za-z0-9+/=\s]+$/.test(wire.slice(0, 400)))
  const hasCompactImgMarker = raw.includes('MORG_COMPACT_IMG_V1:')
  const hasCompactImgPrefix =
    raw.includes('[[MORG_COMPACT_IMG_V1:') || wire.includes('[[MORG_COMPACT_IMG_V1:')
  const hasLoraMarker =
    raw.includes('MORG_LUMA_V1:') ||
    raw.includes('MORG_CHROMA_V1:') ||
    wire.includes('[[MORG_LUMA_V1:') ||
    wire.includes('[[MORG_CHROMA_V1:')
  return (
    <div className="space-y-2 rounded-lg border border-border/80 bg-muted/15 p-3">
      {hasLoraMarker ? (
        <p className="text-xs text-amber-700 dark:text-amber-300/90">
          LoRa-Bild-Wire erkannt, Dekodierung fehlgeschlagen — Länge/Base64/Ende{' '}
          <span className="font-mono">]]</span> prüfen oder Nachricht unvollständig.
        </p>
      ) : null}
      {hasCompactImgMarker ? (
        <p className="text-xs text-amber-700 dark:text-amber-300/90">
          {hasCompactImgPrefix ? (
            <>
              Kompakt-Bild erkannt, Dekodierung fehlgeschlagen — Wire oft abgeschnitten (fehlendes{' '}
              <span className="font-mono">]]</span>) oder Base64 beschädigt.
            </>
          ) : (
            <>
              Marker <span className="font-mono">MORG_COMPACT_IMG_V1</span> ohne korrektes Präfix{' '}
              <span className="font-mono">[[MORG_COMPACT_IMG_V1:</span> — Klartext vermutlich beschädigt.
            </>
          )}
        </p>
      ) : null}
      {!hasCompactImgMarker && !hasLoraMarker && looksLikeWire ? (
        <p className="text-xs text-amber-700 dark:text-amber-300/90">
          Inhalt wirkt wie Roh-Wire oder Base64 – kein bekannter Marker (Bild/Text/Audio). Online-Bild:{' '}
          <span className="font-mono">[[MORG_COMPACT_IMG_V1:</span> … Funk LoRa:{' '}
          <span className="font-mono">[[MORG_LUMA_V1:</span> / <span className="font-mono">[[MORG_CHROMA_V1:</span>.
        </p>
      ) : null}
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{wire}</p>
      <button
        type="button"
        onClick={() => void copyRaw()}
        className="text-xs font-medium text-primary hover:underline"
      >
        {copied === 'raw' ? 'Kopiert' : 'Text kopieren'}
      </button>
    </div>
  )
}
