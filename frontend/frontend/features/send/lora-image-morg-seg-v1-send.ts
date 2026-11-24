'use client'

/**
 * § H.25a — Bild über Pfad 4 via MORG_SEG_V1 + Sender-NAK-Loop.
 *
 * **STABIL-Anker** (Live 2026-11-23 Abend — User: schöner Lauf).
 * - Erster Burst: jedes Segment **einmal**
 * - Danach: **nur** fehlende Indizes (Rate-Limit-Sofort-Retry + Peer-NAK) — nie Blind-Alles-nochmal
 * - `wantAck: false` + queueConfirm — kein Firmware-ACK-Stau
 * - Gap ≥ Airtime; Rate-Limit (38) = Paket **nicht** in der Luft → gezielt nochmal
 * Weiter: nur stabilisieren / vorsichtig Tempo — siehe `lora-h25a-stable-anchor.mdc`
 */

import type { ChatAttachedLora } from '@/frontend/lib/chat-view-attached-types'
import type { MeshtasticBleSendApi } from '@/frontend/lib/chat-view-messenger-transport'
import { parseMorgNakV1Message } from '@/frontend/lib/lora-sarq-parser'
import { missingIndicesFromNakMask } from '@/frontend/lib/lora-sarq-wire'
import {
  formatFluentLoraPreSendWarning,
  isFluentLoraImagePlan,
  planFluentLoraImage,
  type FluentLoraImagePlan,
  type FluentLoraPhasePlan,
} from '@/frontend/features/send/lora-image-morg-seg-v1-policy'
import { formatUnknownError } from '@/frontend/lib/format-unknown-error'
import { normalizeMeshtasticOutboundFailure } from '@/frontend/lib/meshtastic-routing-error'

/**
 * MediumFast ~200 B ToA ≈ 0,3–0,5 s + ESP32-Queue.
 * 700→580: ~17 % weniger Burst-Zeit bei ~25 Seg/Phase (Live-grün vorausgesetzt).
 * Nicht unter ~500 ohne neuen Live-Beweis (Rate-Limit 38).
 */
const PACKET_GAP_MS = 580
/** RATE_LIMIT_EXCEEDED: Firmware hat verworfen — Pause, dann **nur dieses** Segment. */
const RATE_LIMIT_GAP_MS = 2_000
/** Pause Luma→Chroma (Idle-NAK RX 2,5 s — Settle kürzer ok, Peer oft schon fertig). */
const PHASE_SETTLE_MS = 1_000
/** Peer-Wartefenster; ≥ Idle-NAK, aber nicht unnötig lang nach sichtbarem Bild. */
const NAK_ROUND_WAIT_MS = 3_500
const MAX_NAK_ROUNDS = 4
/** Max. Sofort-Retries nur für Rate-Limit-Indizes (nicht Vollphase). */
const MAX_RATE_LIMIT_REPAIR_PASSES = 2
const MAX_NAK_EXTRA_BATCHES = 4

export type SegSendOutcome = 'ok' | 'rate_limit' | 'soft'

/**
 * Soft ≠ Rate-Limit.
 * `rateLimit: true` / reines `error: 38` = nicht in der Luft → gezielt nachholen.
 * Soft-Routing (queued) hat Priorität vor nacktem error:38 — sonst wirkt Repair wie Voll-Resend.
 */
export function classifySegSendResult(r: unknown): SegSendOutcome {
  if (!r || typeof r !== 'object') return 'ok'
  const o = r as { rateLimit?: unknown; error?: unknown; softRouting?: unknown; soft?: unknown }
  if (o.rateLimit === true) return 'rate_limit'
  if (o.softRouting === true || o.soft === true) return 'soft'
  if (o.error === 38) return 'rate_limit'
  return 'ok'
}

function gapForOutcome(outcome: SegSendOutcome): number {
  if (outcome === 'rate_limit') return RATE_LIMIT_GAP_MS
  /** Soft = oft trotzdem in der Luft — kein Extra-Gap (Tempo). */
  return PACKET_GAP_MS
}

async function yieldForUiPaint(): Promise<void> {
  await new Promise<void>((r) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => r())
    } else {
      setTimeout(r, 0)
    }
  })
}

export type SendLoraImageViaMorgSegV1Params = {
  attached: ChatAttachedLora
  dest: number | 'broadcast'
  meshtastic: MeshtasticBleSendApi
  throwIfCancelled: () => void
  onProgress: (line: string | null) => void
  onStatusMsg: (msg: string) => void
  drainInboundMeshText: () => string[]
  sendMeshText: (text: string, dest: number | 'broadcast') => Promise<unknown>
  ensureConnected?: () => Promise<boolean>
}

export type SendLoraImageViaMorgSegV1Result =
  | { ok: true; plan: FluentLoraImagePlan; preSendWarning: string }
  | { ok: false; error: string }

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function sleepCancellable(ms: number, throwIfCancelled: () => void): Promise<void> {
  const end = Date.now() + ms
  while (Date.now() < end) {
    throwIfCancelled()
    await sleep(Math.min(100, end - Date.now()))
  }
}

/** Für Vitest (§ H.25a NAK-Loop). */
export function collectMissingFromNaks(
  inbound: string[],
  msgId: string,
  phase: 'luma' | 'chroma',
  n: number
): number[] {
  const missing = new Set<number>()
  for (const text of inbound) {
    const nak = parseMorgNakV1Message(text)
    if (!nak || nak.msgId !== msgId || nak.phase !== phase) continue
    if (nak.mask === 0) continue
    for (const i of missingIndicesFromNakMask(nak.mask, n)) missing.add(i)
  }
  return [...missing].sort((a, b) => a - b)
}

export function peerReportedPhaseComplete(
  inbound: string[],
  msgId: string,
  phase: 'luma' | 'chroma'
): boolean {
  for (const text of inbound) {
    const nak = parseMorgNakV1Message(text)
    if (!nak || nak.msgId !== msgId || nak.phase !== phase) continue
    if (nak.mask === 0) return true
  }
  return false
}

async function sendWireOnce(
  wire: string,
  dest: number | 'broadcast',
  sendMeshText: SendLoraImageViaMorgSegV1Params['sendMeshText'],
  throwIfCancelled: () => void,
  ensureConnected: (() => Promise<boolean>) | undefined
): Promise<SegSendOutcome> {
  throwIfCancelled()
  try {
    const r = await sendMeshText(wire, dest)
    return classifySegSendResult(r)
  } catch (e) {
    if (ensureConnected) {
      try {
        await ensureConnected()
      } catch {
        /* optional */
      }
    }
    throw e instanceof Error ? e : normalizeMeshtasticOutboundFailure(e, 'Flüchtig (LoRa)')
  }
}

type PhaseOpts = {
  requirePeerSignal: boolean
  siblingLuma?: FluentLoraPhasePlan
}

async function sendPhaseWithNak(
  phase: FluentLoraPhasePlan,
  p: SendLoraImageViaMorgSegV1Params,
  opts: PhaseOpts
): Promise<void> {
  const label = phase.phase === 'luma' ? 'Luma' : 'Chroma'
  const throwIfCancelled = p.throwIfCancelled
  /** Indizes, die Firmware per Rate-Limit verworfen hat — gezielt nachholen. */
  const rateLimited = new Set<number>()

  const sendIndices = async (
    indices: number[],
    mode: 'burst' | 'repair' | 'rate_limit',
    phasePlan: FluentLoraPhasePlan = phase
  ) => {
    const lbl = phasePlan.phase === 'luma' ? 'Luma' : 'Chroma'
    const unique = [...new Set(indices)].filter((i) => i >= 0 && i < phasePlan.n).sort((a, b) => a - b)
    let k = 0
    for (const seg of unique) {
      throwIfCancelled()
      const wire = phasePlan.wires[seg]
      if (!wire) continue
      k++
      if (mode === 'rate_limit') {
        p.onStatusMsg(
          `Flüchtig (LoRa): ${lbl} Rate-Limit nachholen ${seg + 1}/${phasePlan.n} (${k}/${unique.length})…`
        )
        p.onProgress(`${lbl} RL ${seg + 1}/${phasePlan.n}`)
      } else if (mode === 'repair') {
        p.onStatusMsg(
          `Flüchtig (LoRa): ${lbl} nur Lücke ${seg + 1}/${phasePlan.n} (${k}/${unique.length})…`
        )
        p.onProgress(`${lbl} Lücke ${seg + 1}/${phasePlan.n}`)
      } else {
        p.onStatusMsg(`Flüchtig (LoRa): ${lbl} Segment ${seg + 1}/${phasePlan.n}…`)
        p.onProgress(`${lbl} ${seg + 1}/${phasePlan.n}`)
      }
      await yieldForUiPaint()
      const outcome = await sendWireOnce(
        wire,
        p.dest,
        p.sendMeshText,
        p.throwIfCancelled,
        p.ensureConnected
      )
      if (phasePlan === phase) {
        if (outcome === 'rate_limit') rateLimited.add(seg)
        else rateLimited.delete(seg)
      }
      await sleepCancellable(gapForOutcome(outcome), throwIfCancelled)
    }
  }

  if (opts.siblingLuma) {
    const early = p.drainInboundMeshText()
    const lumaGap = collectMissingFromNaks(
      early,
      opts.siblingLuma.msgId,
      'luma',
      opts.siblingLuma.n
    )
    if (lumaGap.length > 0) {
      p.onStatusMsg(`Flüchtig (LoRa): Luma nur ${lumaGap.length} fehlende nachbessern…`)
      await sendIndices(lumaGap, 'repair', opts.siblingLuma)
    }
  }

  /** 1) Einmaliger Voll-Burst — einziger „alles senden“-Schritt. */
  p.onStatusMsg(`Flüchtig (LoRa): ${label} — ${phase.n} Segmente (1. Durchgang)…`)
  await sendIndices([...Array(phase.n).keys()], 'burst')

  /** 2) Sofort nur Rate-Limit-Opfer (nicht die ganze Phase). */
  for (let pass = 0; pass < MAX_RATE_LIMIT_REPAIR_PASSES && rateLimited.size > 0; pass++) {
    const batch = [...rateLimited].sort((a, b) => a - b)
    p.onStatusMsg(
      `Flüchtig (LoRa): ${label} — ${batch.length} Segmente nach Rate-Limit gezielt…`
    )
    await sendIndices(batch, 'rate_limit')
  }

  /** 3) Peer-NAK: nur Masken-Lücken. */
  for (let round = 0; round < MAX_NAK_ROUNDS; round++) {
    throwIfCancelled()
    p.onStatusMsg(
      `Flüchtig (LoRa): ${label} — warte auf Empfänger (Runde ${round + 1}/${MAX_NAK_ROUNDS})…`
    )
    const deadline = Date.now() + NAK_ROUND_WAIT_MS
    let missing: number[] = []
    let complete = false
    while (Date.now() < deadline) {
      throwIfCancelled()
      const inbound = p.drainInboundMeshText()
      if (peerReportedPhaseComplete(inbound, phase.msgId, phase.phase)) {
        complete = true
        break
      }
      missing = collectMissingFromNaks(inbound, phase.msgId, phase.phase, phase.n)
      if (missing.length > 0) break
      await sleepCancellable(200, throwIfCancelled)
    }
    if (complete) return

    if (missing.length > 0) {
      p.onStatusMsg(
        `Flüchtig (LoRa): ${label} — NAK: nur ${missing.length} fehlende nachsenden…`
      )
      await sendIndices(missing, 'repair')
      const ackDeadline = Date.now() + Math.min(3_000, NAK_ROUND_WAIT_MS)
      let extra = 0
      while (Date.now() < ackDeadline) {
        throwIfCancelled()
        const inbound = p.drainInboundMeshText()
        if (peerReportedPhaseComplete(inbound, phase.msgId, phase.phase)) return
        const more = collectMissingFromNaks(inbound, phase.msgId, phase.phase, phase.n)
        if (more.length > 0 && extra < MAX_NAK_EXTRA_BATCHES) {
          extra++
          p.onStatusMsg(
            `Flüchtig (LoRa): ${label} — NAK nachbessern ${more.length} (Batch ${extra})…`
          )
          await sendIndices(more, 'repair')
          continue
        }
        await sleepCancellable(200, throwIfCancelled)
      }
      if (opts.requirePeerSignal) {
        p.onStatusMsg(
          `Flüchtig (LoRa): ${label} — Peer-ACK unsicher, weiter (nur Lücken wurden gesendet)…`
        )
      }
      return
    }

    /**
     * Luma: nach einer ruhigen Wartezeit soft → Chroma.
     * Chroma: max. 2 stille Fenster auf mask=0 — sonst „Lücke“-Nachsend lange nach
     * sichtbarem Bild (Peer hat oft schon assembliert, ACK ging verloren).
     */
    if (phase.phase === 'luma') {
      p.onStatusMsg(
        `Flüchtig (LoRa): ${label} — kein mask=0, weiter mit Chroma (kein Alles-nochmal)…`
      )
      return
    }
    if (round >= 1) {
      p.onStatusMsg(
        `Flüchtig (LoRa): ${label} — kein Peer-ACK, soft fertig (Empfänger zeigt oft schon Farbe)…`
      )
      return
    }
    p.onStatusMsg(
      `Flüchtig (LoRa): ${label} — noch kein mask=0, kurzes 2. Wartefenster…`
    )
  }
}

export async function sendLoraImageViaMorgSegV1(
  p: SendLoraImageViaMorgSegV1Params
): Promise<SendLoraImageViaMorgSegV1Result> {
  const planned = planFluentLoraImage(p.attached)
  if (!isFluentLoraImagePlan(planned)) {
    return { ok: false, error: planned.message }
  }
  const plan = planned
  const preSendWarning = formatFluentLoraPreSendWarning(plan)

  const throwIfCancelled = p.throwIfCancelled

  try {
    if (p.ensureConnected) {
      const ok = await p.ensureConnected()
      if (!ok && !p.meshtastic.connected) {
        return {
          ok: false,
          error:
            'LoRa (Funk): Heltec nicht verbunden — „USB verbinden“, dann „Nochmals senden“.',
        }
      }
    } else if (!p.meshtastic.connected) {
      return { ok: false, error: 'LoRa (Funk): Heltec/Web Bluetooth nicht verbunden.' }
    }

    p.onProgress('Luma 0/' + plan.luma.n)
    await sendPhaseWithNak(plan.luma, p, { requirePeerSignal: true })
    throwIfCancelled()
    p.onStatusMsg('Flüchtig (LoRa): Pause vor Farbe…')
    await sleepCancellable(PHASE_SETTLE_MS, throwIfCancelled)
    p.onProgress('Chroma 0/' + plan.chroma.n)
    /** Chroma ebenfalls Peer-NAKs abwarten — sonst bleibt Empfänger S/W bei Drop. */
    await sendPhaseWithNak(plan.chroma, p, {
      requirePeerSignal: true,
      siblingLuma: plan.luma,
    })
    p.onProgress(null)
    return { ok: true, plan, preSendWarning }
  } catch (e) {
    p.onProgress(null)
    return { ok: false, error: formatUnknownError(e) }
  }
}
