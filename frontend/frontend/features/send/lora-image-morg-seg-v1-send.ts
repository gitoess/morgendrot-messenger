'use client'

/**
 * § H.25a — Bild über Pfad 4 via MORG_SEG_V1 + Sender-NAK-Loop.
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
import { buildPath4ImageInitWire } from '@/frontend/lib/path4-image-transfer'

const PACKET_GAP_MS = 140
const NAK_ROUND_WAIT_MS = 18_000
const MAX_NAK_ROUNDS = 3

export type SendLoraImageViaMorgSegV1Params = {
  attached: ChatAttachedLora
  dest: number | 'broadcast'
  meshtastic: MeshtasticBleSendApi
  throwIfCancelled: () => void
  onProgress: (line: string | null) => void
  onStatusMsg: (msg: string) => void
  /** Seit Sendestart gesammelte eingehende Mesh-Texte (NAK). */
  drainInboundMeshText: () => string[]
  sendMeshText: (text: string, dest: number | 'broadcast') => Promise<unknown>
}

export type SendLoraImageViaMorgSegV1Result =
  | { ok: true; plan: FluentLoraImagePlan; preSendWarning: string }
  | { ok: false; error: string }

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
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
    for (const i of missingIndicesFromNakMask(nak.mask, n)) missing.add(i)
  }
  return [...missing].sort((a, b) => a - b)
}

async function sendWireWithRetry(
  wire: string,
  dest: number | 'broadcast',
  sendMeshText: SendLoraImageViaMorgSegV1Params['sendMeshText'],
  throwIfCancelled: () => void,
  maxAttempts = 3
): Promise<void> {
  let lastErr: unknown
  for (let i = 0; i < maxAttempts; i++) {
    try {
      throwIfCancelled()
      await sendMeshText(wire, dest)
      return
    } catch (e) {
      lastErr = e
      if (i + 1 >= maxAttempts) break
      await sleep(350 + i * 450)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

async function sendPhaseWithNak(
  phase: FluentLoraPhasePlan,
  p: SendLoraImageViaMorgSegV1Params
): Promise<void> {
  const label = phase.phase === 'luma' ? 'Luma' : 'Chroma'
  const sent = new Set<number>()
  const throwIfCancelled = p.throwIfCancelled

  const sendIndices = async (indices: number[]) => {
    for (const seg of indices) {
      throwIfCancelled()
      const wire = phase.wires[seg]
      if (!wire) continue
      p.onStatusMsg(`Flüchtig (LoRa): ${label} Segment ${seg + 1}/${phase.n}…`)
      p.onProgress(`${label} ${seg + 1}/${phase.n}`)
      await sendWireWithRetry(wire, p.dest, p.sendMeshText, p.throwIfCancelled)
      sent.add(seg)
      await sleep(PACKET_GAP_MS)
    }
  }

  const initWire = buildPath4ImageInitWire({
    msgId: phase.msgId,
    phase: phase.phase,
    n: phase.n,
    jpeg: phase.jpeg,
  })
  p.onStatusMsg(`Flüchtig (LoRa): ${label} — Start (${phase.n} Segmente)…`)
  await sendWireWithRetry(initWire, p.dest, p.sendMeshText, p.throwIfCancelled)
  await sleep(PACKET_GAP_MS)

  p.onStatusMsg(`Flüchtig (LoRa): ${label} — ${phase.n} Segmente senden…`)
  await sendIndices([...Array(phase.n).keys()])

  for (let round = 0; round < MAX_NAK_ROUNDS; round++) {
    throwIfCancelled()
    p.onStatusMsg(`Flüchtig (LoRa): ${label} — warte auf Empfangsbestätigung (Runde ${round + 1}/${MAX_NAK_ROUNDS})…`)
    const deadline = Date.now() + NAK_ROUND_WAIT_MS
    let missing: number[] = []
    while (Date.now() < deadline) {
      throwIfCancelled()
      const inbound = p.drainInboundMeshText()
      missing = collectMissingFromNaks(inbound, phase.msgId, phase.phase, phase.n)
      if (missing.length > 0) break
      await sleep(250)
    }
    if (missing.length === 0) {
      if (sent.size >= phase.n) return
      if (round + 1 >= MAX_NAK_ROUNDS) {
        throw new Error(
          `${label}: nach ${MAX_NAK_ROUNDS} Runden keine vollständige Bestätigung — Verbindung prüfen oder erneut senden.`
        )
      }
      continue
    }
    p.onStatusMsg(`Flüchtig (LoRa): ${label} — ${missing.length} fehlende Segmente nachsenden…`)
    await sendIndices(missing)
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

  if (!p.meshtastic.connected) {
    return { ok: false, error: 'LoRa (Funk): Heltec/Web Bluetooth nicht verbunden.' }
  }

  const throwIfCancelled = p.throwIfCancelled

  try {
    p.onProgress('Luma 0/' + plan.luma.n)
    await sendPhaseWithNak(plan.luma, p)
    throwIfCancelled()
    p.onProgress('Chroma 0/' + plan.chroma.n)
    await sendPhaseWithNak(plan.chroma, p)
    p.onProgress(null)
    return { ok: true, plan, preSendWarning }
  } catch (e) {
    p.onProgress(null)
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}
