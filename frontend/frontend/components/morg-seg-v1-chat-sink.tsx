'use client'

/**
 * S-ARQ `MORG_SEG_V1`: Fortschritt + JPEG aus Live-Store (Mesh-Zeit),
 * nicht abhängig von Inbox-Remount / Tab-Fokus.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Message } from '@/frontend/lib/types'
import {
  messageLooksLikePath4ImageTransferWire,
  parseMorgSegV1Message,
} from '@/frontend/lib/lora-sarq-parser'
import { parsePath4ImageInitMessage } from '@/frontend/lib/path4-image-transfer'
import {
  downloadUint8AsFile,
  fuseLoraProgressivePreferSharpBackend,
  revokeObjectUrlSafe,
  uint8ToObjectUrl,
} from '@/frontend/lib/lora-progressive-image-client'
import { normalizeMessengerWireContent } from '@/frontend/lib/compact-image-wire'
import { SarqSegmentProgressGrid } from '@/frontend/components/sarq-segment-progress-grid'
import {
  getSarqLiveAssembled,
  getSarqLivePhase,
  maskToReceivedSet,
  normalizeSarqPeerKey,
  noteSarqSegFromMesh,
  requestSarqLiveMissing,
  seedSarqLiveFromInit,
  setSarqLiveNakHandler,
  subscribeSarqLiveAssembled,
  subscribeSarqLiveProgress,
  type SarqLivePhaseSnap,
} from '@/frontend/lib/lora-sarq-live-progress'

/** Überlebt Remount: INIT-NAK nur einmal pro Session. */
const initNakDoneGlobal = new Set<string>()

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
  const fromLower = useMemo(() => normalizeSarqPeerKey(selfMessage.from ?? ''), [selfMessage.from])
  const msgId = anchor?.msgId ?? initAnchor?.msgId ?? ''

  const inboxSig = useMemo(() => {
    const n = inboxMessages.length
    const tail = inboxMessages.map((m) => `${m.id}:${(m.content ?? '').length}`).join('|')
    return `${n}|${tail}`
  }, [inboxMessages])

  const [liveTick, setLiveTick] = useState(0)
  const [lumaJpeg, setLumaJpeg] = useState<Uint8Array | null>(null)
  const [chromaJpeg, setChromaJpeg] = useState<Uint8Array | null>(null)
  const [displayUrl, setDisplayUrl] = useState<string | null>(null)
  const [lumaOnlyUrl, setLumaOnlyUrl] = useState<string | null>(null)
  const [imgErr, setImgErr] = useState<string | null>(null)

  const nak = useCallback(
    (wire: string) => {
      void Promise.resolve(onNakWire?.(wire)).catch((e: unknown) => {
        console.debug(
          '[sarq-nak-ui]',
          e instanceof Error ? e.message : typeof e === 'object' ? JSON.stringify(e) : String(e)
        )
      })
    },
    [onNakWire]
  )

  /** Globaler NAK-Rückkanal + Live-Subscribe (auch wenn Inbox-React stockt). */
  useEffect(() => {
    setSarqLiveNakHandler(nak)
    const offProg = subscribeSarqLiveProgress(() => setLiveTick((x) => x + 1))
    const offAsm = subscribeSarqLiveAssembled((meta) => {
      if (normalizeSarqPeerKey(meta.fromLower) !== fromLower || meta.msgId !== msgId) return
      if (meta.phase === 'luma') setLumaJpeg(meta.bytes)
      else setChromaJpeg(meta.bytes)
    })
    return () => {
      offProg()
      offAsm()
      /** Nicht nullen: anderer Sink / Orchestrator kann Handler halten. */
    }
  }, [nak, fromLower, msgId])

  /** Inbox → Live-Store (Late-Join / Reload / verpasste Mesh-Hooks). */
  useEffect(() => {
    if (!msgId || !fromLower) return
    const ordered = [...inboxMessages].sort((a, b) => a.timestamp - b.timestamp)
    for (const m of ordered) {
      if (normalizeSarqPeerKey(m.from ?? '') !== fromLower) continue
      const init = parsePath4ImageInitMessage(m.content ?? '')
      if (init && init.msgId === msgId) {
        const ik = `${fromLower}:${init.msgId}:${init.phase}:${init.n}`
        const first = !initNakDoneGlobal.has(ik)
        if (first) initNakDoneGlobal.add(ik)
        seedSarqLiveFromInit(fromLower, init.msgId, init.phase, init.n, { nakNow: first })
      }
      const p = parseMorgSegV1Message(m.content ?? '')
      if (p && p.msgId === msgId) {
        noteSarqSegFromMesh(m.from ?? fromLower, m.content ?? '', { deferIdle: true })
      }
    }
  }, [fromLower, inboxSig, msgId])

  /** Hydrate JPEG falls Assemble vor Sink-Mount. */
  useEffect(() => {
    if (!msgId || !fromLower) return
    const l = getSarqLiveAssembled(fromLower, msgId, 'luma')
    const c = getSarqLiveAssembled(fromLower, msgId, 'chroma')
    if (l) setLumaJpeg(l)
    if (c) setChromaJpeg(c)
  }, [fromLower, msgId, liveTick])

  useEffect(() => {
    let alive = true
    setImgErr(null)
    setDisplayUrl(null)
    setLumaOnlyUrl(null)
    if (!lumaJpeg || lumaJpeg.length === 0) return
    let lumaUrl: string | null = null
    let fuseUrl: string | null = null
    void (async () => {
      try {
        lumaUrl = uint8ToObjectUrl(lumaJpeg)
        if (alive) setLumaOnlyUrl(lumaUrl)
        if (chromaJpeg && chromaJpeg.length > 0) {
          try {
            fuseUrl = await fuseLoraProgressivePreferSharpBackend(lumaJpeg, chromaJpeg)
            if (alive) setDisplayUrl(fuseUrl)
          } catch (fuseErr) {
            if (alive) {
              setDisplayUrl(lumaUrl)
              setImgErr(
                `Farbe fehlgeschlagen — S/W bleibt: ${
                  fuseErr instanceof Error
                    ? fuseErr.message
                    : (() => {
                        try {
                          return JSON.stringify(fuseErr)
                        } catch {
                          return 'Fusionsfehler'
                        }
                      })()
                }`
              )
            }
          }
        } else if (alive) {
          setDisplayUrl(lumaUrl)
        }
      } catch (e) {
        if (alive) {
          try {
            if (!lumaUrl) lumaUrl = uint8ToObjectUrl(lumaJpeg)
            setDisplayUrl(lumaUrl)
            setLumaOnlyUrl(lumaUrl)
          } catch {
            /* ignore */
          }
          setImgErr(e instanceof Error ? e.message : String(e))
        }
      }
    })()
    return () => {
      alive = false
      if (fuseUrl) revokeObjectUrlSafe(fuseUrl)
      if (lumaUrl) revokeObjectUrlSafe(lumaUrl)
    }
  }, [lumaJpeg, chromaJpeg])

  const lumaSnap: SarqLivePhaseSnap | null = useMemo(() => {
    if (!msgId || !fromLower) return null
    return getSarqLivePhase(fromLower, msgId, 'luma')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- liveTick = Store-Änderung
  }, [fromLower, msgId, liveTick])

  const chromaSnap: SarqLivePhaseSnap | null = useMemo(() => {
    if (!msgId || !fromLower) return null
    return getSarqLivePhase(fromLower, msgId, 'chroma')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- liveTick
  }, [fromLower, msgId, liveTick])

  const lumaN =
    lumaSnap?.n ??
    (anchor?.phase === 'luma' ? anchor.n : initAnchor?.phase === 'luma' ? initAnchor.n : null)
  const chromaN =
    chromaSnap?.n ??
    (anchor?.phase === 'chroma' ? anchor.n : initAnchor?.phase === 'chroma' ? initAnchor.n : null)

  const lumaReceived = useMemo(() => {
    if (lumaSnap) return maskToReceivedSet(lumaSnap.receivedMask, lumaSnap.n)
    return new Set<number>()
  }, [lumaSnap])

  const chromaReceived = useMemo(() => {
    if (chromaSnap) return maskToReceivedSet(chromaSnap.receivedMask, chromaSnap.n)
    return new Set<number>()
  }, [chromaSnap])

  const anyFrozen = Boolean(lumaSnap?.frozen || chromaSnap?.frozen)
  const anyIncomplete =
    (lumaSnap && !lumaSnap.assembled && lumaSnap.receivedCount < lumaSnap.n) ||
    (chromaSnap && !chromaSnap.assembled && chromaSnap.receivedCount < chromaSnap.n)

  const requestMissing = useCallback(() => {
    if (!msgId || !fromLower) return
    requestSarqLiveMissing(fromLower, msgId, 'luma')
    requestSarqLiveMissing(fromLower, msgId, 'chroma')
  }, [fromLower, msgId])

  if (!looks) {
    return <p className="text-xs text-muted-foreground">Kein MORG_SEG_V1-Wire.</p>
  }

  if (!anchor && initAnchor) {
    const phaseLabel = initAnchor.phase === 'luma' ? 'Luma' : 'Chroma'
    const snap = initAnchor.phase === 'luma' ? lumaSnap : chromaSnap
    const received = snap ? maskToReceivedSet(snap.receivedMask, snap.n) : new Set<number>()
    return (
      <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3">
        <p className="text-sm font-medium text-foreground">Bild wird zusammengesetzt… (Pfad 4)</p>
        <p className="text-xs text-muted-foreground">
          {phaseLabel}: {initAnchor.n} Segmente erwartet — warte auf Funkpakete.
        </p>
        <SarqSegmentProgressGrid
          n={initAnchor.n}
          received={received}
          label={`${phaseLabel}-Fortschritt`}
        />
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
        <div className="space-y-2">
          <div className="relative inline-block max-w-full">
            {!chromaJpeg?.length ? (
              <span
                className="pointer-events-none absolute left-2 top-2 z-[1] rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black shadow-sm"
                title="Nur Luma (S/W). Farbe kommt, sobald Chroma-Segmente vollständig sind."
              >
                S/W · Luma
              </span>
            ) : (
              <span
                className="pointer-events-none absolute left-2 top-2 z-[1] rounded bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm"
                title="Luma + Chroma zusammengefügt."
              >
                Farbe
              </span>
            )}
            <img
              src={displayUrl}
              alt="S-ARQ LoRa Bild"
              className="max-h-96 max-w-full rounded-lg border border-border object-contain"
              onError={() => setImgErr('JPEG-Anzeige fehlgeschlagen (Fragmente noch kein gültiges Bild).')}
            />
          </div>
          {chromaJpeg?.length && lumaOnlyUrl ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">S/W behalten (Luma)</p>
                <img
                  src={lumaOnlyUrl}
                  alt="S-ARQ Luma S/W"
                  className="max-h-28 max-w-[7rem] rounded border border-border object-contain"
                />
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  className="text-left text-[10px] font-medium text-primary hover:underline"
                  onClick={() => downloadUint8AsFile(lumaJpeg!, `lora-${msgId || 'bild'}-sw.jpg`)}
                >
                  S/W speichern
                </button>
                <button
                  type="button"
                  className="text-left text-[10px] font-medium text-primary hover:underline"
                  onClick={() => {
                    if (!displayUrl) return
                    const a = document.createElement('a')
                    a.href = displayUrl
                    a.download = `lora-${msgId || 'bild'}-farbe.jpg`
                    a.rel = 'noopener'
                    document.body.appendChild(a)
                    a.click()
                    a.remove()
                  }}
                >
                  Farbe speichern
                </button>
              </div>
            </div>
          ) : lumaJpeg?.length ? (
            <button
              type="button"
              className="text-[10px] font-medium text-primary hover:underline"
              onClick={() => downloadUint8AsFile(lumaJpeg, `lora-${msgId || 'bild'}-sw.jpg`)}
            >
              S/W speichern
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-[11px] leading-snug text-muted-foreground">
          <strong className="font-medium text-foreground">Bild wird zusammengesetzt…</strong> Zuerst S/W (Luma),
          danach Farbe (Chroma). Raster: empfangen = grün.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {lumaN != null && lumaN > 0 ? (
          <SarqSegmentProgressGrid n={lumaN} received={lumaReceived} label="Luma-Fortschritt" />
        ) : null}
        {chromaN != null && chromaN > 0 ? (
          <SarqSegmentProgressGrid n={chromaN} received={chromaReceived} label="Chroma-Fortschritt" />
        ) : chromaSnap || chromaJpeg?.length ? (
          <SarqSegmentProgressGrid
            n={chromaSnap?.n ?? chromaN ?? 1}
            received={chromaReceived}
            label="Chroma-Fortschritt"
          />
        ) : null}
      </div>

      <div
        className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-2 text-[10px] text-muted-foreground"
        data-sarq-ui={`live-${liveTick}`}
      >
        <span title="Reassembly-Zustand (Luma)">
          Luma {lumaSnap?.receivedCount ?? lumaReceived.size}/{lumaN ?? '?'} · NAK {lumaSnap?.nakRounds ?? 0}
          {lumaSnap?.frozen ? ' · eingefroren' : ''}
          {lumaSnap?.assembled ? ' · fertig' : ''}
        </span>
        <span className="text-border">|</span>
        <span title="Reassembly-Zustand (Chroma)">
          Chroma {chromaSnap?.receivedCount ?? chromaReceived.size}/{chromaN ?? '?'} · NAK{' '}
          {chromaSnap?.nakRounds ?? 0}
          {chromaSnap?.frozen ? ' · eingefroren' : ''}
          {chromaSnap?.assembled ? ' · fertig' : ''}
        </span>
        {anyFrozen || anyIncomplete ? (
          <button
            type="button"
            className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-muted"
            title="Fehlende Segmente erneut per NAK anfordern (hebt Freeze)"
            onClick={requestMissing}
          >
            Lücken erneut anfordern
          </button>
        ) : null}
      </div>

      <button type="button" onClick={() => void copyRaw()} className="text-xs font-medium text-primary hover:underline">
        {copiedRaw ? 'Kopiert' : 'Letztes Segment-Wire kopieren'}
      </button>
    </div>
  )
}
