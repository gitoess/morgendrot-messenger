'use client'

/**
 * S-ARQ `MORG_SEG_V1`: kein Roh-Wire in der Sprechblase — Fortschritt, „Ghost“-Raster,
 * JPEG sobald eine Phase vollständig zusammengebaut ist (Luma zuerst, optional +Chroma).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { Message } from '@/frontend/lib/types'
import {
  messageLooksLikePath4ImageTransferWire,
  parseMorgSegV1Message,
} from '@/frontend/lib/lora-sarq-parser'
import { parsePath4ImageInitMessage } from '@/frontend/lib/path4-image-transfer'
import { useMorgSegReassembly } from '@/frontend/hooks/use-morg-seg-reassembly'
import {
  fuseLoraProgressivePreferSharpBackend,
  revokeObjectUrlSafe,
  uint8ToObjectUrl,
} from '@/frontend/lib/lora-progressive-image-client'
import { normalizeMessengerWireContent } from '@/frontend/lib/compact-image-wire'

function collectSegIndices(
  inboxMessages: readonly Message[],
  fromLower: string,
  msgId: string,
  phase: 'luma' | 'chroma'
): Set<number> {
  const s = new Set<number>()
  for (const m of inboxMessages) {
    if ((m.from ?? '').trim().toLowerCase() !== fromLower) continue
    const p = parseMorgSegV1Message(m.content ?? '')
    if (p && p.msgId === msgId && p.phase === phase) s.add(p.seg)
  }
  return s
}

function SarqGhostGrid({
  n,
  received,
  label,
}: {
  n: number
  received: Set<number>
  label: string
}) {
  const cols = Math.min(8, Math.max(1, n))
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: n }, (_, i) => {
          const ok = received.has(i)
          return (
            <div
              key={i}
              className={cn(
                'aspect-square min-h-[10px] max-h-8 rounded-sm border border-border/70',
                ok
                  ? 'bg-emerald-600/20 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.35)]'
                  : 'bg-zinc-900/90 dark:bg-black/80 [background-image:repeating-linear-gradient(135deg,transparent,transparent_2px,rgba(255,255,255,0.04)_2px,rgba(255,255,255,0.04)_4px)]'
              )}
              title={ok ? `Segment ${i} (CRC ok)` : `Segment ${i} fehlt`}
            />
          )
        })}
      </div>
    </div>
  )
}

export type MorgSegV1ChatSinkProps = {
  raw: string
  inboxMessages: readonly Message[]
  selfMessage: Message
  onNakWire?: (wire: string) => void | Promise<void>
  copyRaw: () => void | Promise<void>
  copiedRaw: boolean
}

export function MorgSegV1ChatSink({
  raw,
  inboxMessages,
  selfMessage,
  onNakWire,
  copyRaw,
  copiedRaw,
}: MorgSegV1ChatSinkProps) {
  const looks = useMemo(() => messageLooksLikePath4ImageTransferWire(raw), [raw])
  const anchor = useMemo(() => parseMorgSegV1Message(raw), [raw])
  const initAnchor = useMemo(() => parsePath4ImageInitMessage(raw), [raw])
  const fromLower = useMemo(() => (selfMessage.from ?? '').trim().toLowerCase(), [selfMessage.from])
  const msgId = anchor?.msgId ?? initAnchor?.msgId ?? ''

  const inboxSig = useMemo(() => {
    const n = inboxMessages.length
    const tail = inboxMessages.map((m) => `${m.id}:${(m.content ?? '').length}`).join('|')
    return `${n}|${tail}`
  }, [inboxMessages])

  const lumaReceived = useMemo(
    () => (msgId ? collectSegIndices(inboxMessages, fromLower, msgId, 'luma') : new Set<number>()),
    [inboxMessages, fromLower, msgId, inboxSig]
  )
  const chromaReceived = useMemo(
    () => (msgId ? collectSegIndices(inboxMessages, fromLower, msgId, 'chroma') : new Set<number>()),
    [inboxMessages, fromLower, msgId, inboxSig]
  )

  const nak = useCallback(
    (wire: string) => {
      void Promise.resolve(onNakWire?.(wire))
    },
    [onNakWire]
  )

  const [lumaJpeg, setLumaJpeg] = useState<Uint8Array | null>(null)
  const [chromaJpeg, setChromaJpeg] = useState<Uint8Array | null>(null)
  const [displayUrl, setDisplayUrl] = useState<string | null>(null)
  const [imgErr, setImgErr] = useState<string | null>(null)

  const { ingestWire: ingestLuma, buffer: lumaBuffer, uiTick: lumaUiTick } = useMorgSegReassembly({
    onNakWire: nak,
    onAssembled: (u8) => setLumaJpeg(u8),
  })
  const { ingestWire: ingestChroma, buffer: chromaBuffer, uiTick: chromaUiTick } = useMorgSegReassembly({
    onNakWire: nak,
    onAssembled: (u8) => setChromaJpeg(u8),
  })

  useEffect(() => {
    const ordered = [...inboxMessages].sort((a, b) => a.timestamp - b.timestamp)
    if (!msgId) return
    for (const m of ordered) {
      if ((m.from ?? '').trim().toLowerCase() !== fromLower) continue
      const p = parseMorgSegV1Message(m.content ?? '')
      if (!p || p.msgId !== msgId) continue
      if (p.phase === 'luma') ingestLuma(m.content ?? '')
      else ingestChroma(m.content ?? '')
    }
  }, [ingestChroma, ingestLuma, fromLower, inboxSig, msgId])

  useEffect(() => {
    let alive = true
    setImgErr(null)
    setDisplayUrl(null)
    if (!lumaJpeg || lumaJpeg.length === 0) return
    let blobUrl: string | null = null
    void (async () => {
      try {
        if (chromaJpeg && chromaJpeg.length > 0) {
          const u = await fuseLoraProgressivePreferSharpBackend(lumaJpeg, chromaJpeg)
          if (alive) setDisplayUrl(u)
        } else {
          blobUrl = uint8ToObjectUrl(lumaJpeg)
          if (alive) setDisplayUrl(blobUrl)
        }
      } catch (e) {
        if (alive) setImgErr(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      alive = false
      if (blobUrl) revokeObjectUrlSafe(blobUrl)
    }
  }, [lumaJpeg, chromaJpeg])

  const phaseNFromInbox = useCallback(
    (phase: 'luma' | 'chroma') => {
      for (const m of inboxMessages) {
        const init = parsePath4ImageInitMessage(m.content ?? '')
        if (init && init.msgId === msgId && init.phase === phase) return init.n
        const p = parseMorgSegV1Message(m.content ?? '')
        if (p && p.msgId === msgId && p.phase === phase) return p.n
      }
      return null
    },
    [inboxMessages, msgId, inboxSig]
  )

  const lumaN = useMemo(() => {
    const fromInbox = phaseNFromInbox('luma')
    if (fromInbox != null) return fromInbox
    return anchor?.phase === 'luma' ? anchor.n : initAnchor?.phase === 'luma' ? initAnchor.n : null
  }, [anchor, initAnchor, phaseNFromInbox])

  const chromaN = useMemo(() => {
    const fromInbox = phaseNFromInbox('chroma')
    if (fromInbox != null) return fromInbox
    return anchor?.phase === 'chroma' ? anchor.n : initAnchor?.phase === 'chroma' ? initAnchor.n : null
  }, [anchor, initAnchor, phaseNFromInbox])

  if (!looks) {
    return <p className="text-xs text-muted-foreground">Kein MORG_SEG_V1-Wire.</p>
  }

  if (!anchor && initAnchor) {
    const phaseLabel = initAnchor.phase === 'luma' ? 'Luma' : 'Chroma'
    return (
      <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3">
        <p className="text-sm font-medium text-foreground">Bild wird zusammengesetzt… (Pfad 4)</p>
        <p className="text-xs text-muted-foreground">
          {phaseLabel}: {initAnchor.n} Segmente erwartet — warte auf Funkpakete.
        </p>
      </div>
    )
  }

  if (!anchor) {
    const cap = normalizeMessengerWireContent(raw).slice(0, 200)
    return (
      <div className="space-y-2 rounded-lg border border-amber-500/40 bg-muted/20 p-3">
        <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
          S-ARQ-Segment (Wire unvollständig oder CRC falsch) — kein Klartext in der Liste.
        </p>
        <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] text-muted-foreground">
          {cap}
          …
        </pre>
        <button type="button" onClick={() => void copyRaw()} className="text-xs font-medium text-primary hover:underline">
          {copiedRaw ? 'Kopiert' : 'Wire kopieren'}
        </button>
      </div>
    )
  }

  if (!selfMessage.from?.trim()) {
    return <p className="text-xs text-muted-foreground">S-ARQ: Absender fehlt.</p>
  }

  return (
    <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-primary/15 px-2 py-0.5 font-semibold text-primary">LoRa S-ARQ</span>
        <span className="font-mono text-muted-foreground">msgId {anchor.msgId}</span>
        <span className="text-muted-foreground">
          Phase <span className="font-medium text-foreground">{anchor.phase}</span> · Seg. {anchor.seg + 1}/{anchor.n}
        </span>
      </div>

      {imgErr ? <p className="text-xs text-amber-700 dark:text-amber-300">{imgErr}</p> : null}

      {displayUrl ? (
        <div className="relative inline-block max-w-full">
          {!chromaJpeg?.length ? (
            <span
              className="pointer-events-none absolute left-2 top-2 z-[1] rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black shadow-sm"
              title="Nur Luma-JPEG zusammengebaut; Chroma kann noch fehlen."
            >
              Luma
            </span>
          ) : null}
          <img
            src={displayUrl}
            alt="S-ARQ LoRa Bild"
            className="max-h-96 max-w-full rounded-lg border border-border object-contain"
            onError={() => setImgErr('JPEG-Anzeige fehlgeschlagen (Fragmente noch kein gültiges Bild).')}
          />
        </div>
      ) : (
        <p className="text-[11px] leading-snug text-muted-foreground">
          <strong className="font-medium text-foreground">Bild wird zusammengesetzt…</strong> Raster: empfangene
          Segmente (grün), fehlende (Platzhalter). JPEG erscheint, sobald Luma vollständig ist.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {lumaN != null && lumaN > 0 ? (
          <SarqGhostGrid n={lumaN} received={lumaReceived} label="Luma-Fortschritt" />
        ) : null}
        {chromaN != null && chromaN > 0 ? (
          <SarqGhostGrid n={chromaN} received={chromaReceived} label="Chroma-Fortschritt" />
        ) : null}
      </div>

      <div
        className="flex flex-wrap gap-2 border-t border-border/60 pt-2 text-[10px] text-muted-foreground"
        data-sarq-ui={`${lumaUiTick}-${chromaUiTick}`}
      >
        <span title="Reassembly-Zustand (Luma)">
          Luma-NAK-Runden: {lumaBuffer.getNakRoundsSent()}
          {lumaBuffer.isSessionFrozen() ? ' · eingefroren' : ''}
        </span>
        <span className="text-border">|</span>
        <span title="Reassembly-Zustand (Chroma)">
          Chroma-NAK-Runden: {chromaBuffer.getNakRoundsSent()}
          {chromaBuffer.isSessionFrozen() ? ' · eingefroren' : ''}
        </span>
      </div>

      <button type="button" onClick={() => void copyRaw()} className="text-xs font-medium text-primary hover:underline">
        {copiedRaw ? 'Kopiert' : 'Letztes Segment-Wire kopieren'}
      </button>
    </div>
  )
}
