/**
 * Pure helpers for building the chat inbox row list (messages + slide sequences).
 * Keeps chat-view.tsx slightly smaller; ergänzt um S-ARQ-Segment-Kollaps.
 *
 * Not Meshtastic routing: this only shapes UI rows from already-merged `Message[]` (IOTA mailbox + mesh).
 * Meshtastic stays 1:1 on air; Morgendrot adds MORG_* correlation (e.g. hide chroma when luma exists).
 */
import type { Message } from '@/frontend/lib/types'
import type { CompletedSlideSequence } from '@/frontend/features/inbox/inbox-slideshow'
import { normalizeMessengerWireContent } from '@/frontend/lib/compact-image-wire'
import { parseLoraProgressiveMessage } from '@/frontend/lib/lora-progressive-image-client'
import { parseMorgSegV1Message } from '@/frontend/lib/lora-sarq-parser'
import { path4ImageInitInboxGroupKey } from '@/frontend/lib/path4-image-transfer'
import { isMorgendrotMeshNakWire } from '@/frontend/lib/mesh-control-wire'

export type MeshInboundEntry = {
  hint: string | null
  error: string | null
  sortTs: number
  /** Absender (0x…), für Beschriftung in der Zeile */
  fromAddr?: string
}

export type ChatInboxRow =
  | { kind: 'slide'; key: string; frames: string[]; sortTs: number }
  | { kind: 'msg'; msg: Message; sortTs: number }
  | {
      kind: 'meshInbound'
      id: string
      hint: string | null
      error: string | null
      sortTs: number
      fromAddr?: string
    }

/** Eine sichtbare Inbox-Zeile pro Funk-Bild (`MORG_SEG_V1`: Absender + msgId, Luma+Chroma). */
export function morgSarqSegInboxGroupKey(m: Message): string | null {
  const initKey = path4ImageInitInboxGroupKey(m)
  if (initKey) return initKey
  const p = parseMorgSegV1Message(normalizeMessengerWireContent(m.content ?? ''))
  if (!p) return null
  const f = (m.from ?? '').trim().toLowerCase()
  if (!f) return null
  return `${f}:${p.msgId}`
}

/**
 * React-`key` / DOM-id: S-ARQ-Session stabil halten.
 * Sonst remountet jedes neue Segment die Bubble → Fortschritt erst nach Tab-Wechsel,
 * NAK-Zähler/JPEG-State weg, Freeze nach Idle-NAKs.
 */
export function inboxMessageRowStableKey(m: Message): string {
  return morgSarqSegInboxGroupKey(m) ?? m.id
}

export function buildChatInboxRows(
  messages: Message[],
  slideSequences: CompletedSlideSequence[]
): ChatInboxRow[] {
  const hidden = new Set<string>()
  for (const s of slideSequences) {
    for (const id of s.hiddenMessageIds) hidden.add(id)
  }
  const lumaKeys = new Set<string>()
  for (const m of messages) {
    const p = parseLoraProgressiveMessage(m.content ?? '')
    if (p?.kind === 'luma') lumaKeys.add(`${m.from}:${p.msgId}`)
  }
  const sarqLeaderByKey = new Map<string, Message>()
  for (const m of messages) {
    const k = morgSarqSegInboxGroupKey(m)
    if (!k) continue
    const prev = sarqLeaderByKey.get(k)
    if (!prev || m.timestamp >= prev.timestamp) sarqLeaderByKey.set(k, m)
  }
  const hideSarqSeg = new Set<string>()
  for (const m of messages) {
    const k = morgSarqSegInboxGroupKey(m)
    if (!k) continue
    const leader = sarqLeaderByKey.get(k)
    if (leader && m.id !== leader.id) hideSarqSeg.add(m.id)
  }
  const rows: ChatInboxRow[] = []
  for (const s of slideSequences) {
    rows.push({ kind: 'slide', key: s.key, frames: s.framesBase64, sortTs: s.sortTs })
  }
  for (const m of messages) {
    if (hidden.has(m.id)) continue
    if (hideSarqSeg.has(m.id)) continue
    /** NAK/ACK nie als eigene Zeile (auch Altbestand in RAM). */
    if (isMorgendrotMeshNakWire(m.content ?? '')) continue
    const pl = parseLoraProgressiveMessage(m.content ?? '')
    if (pl?.kind === 'chroma' && lumaKeys.has(`${m.from}:${pl.msgId}`)) continue
    /**
     * Unparsebare MORG_SEG_V1 (CRC/Müll) trotzdem nicht als Klartext-Spam zeigen —
     * nur wenn kein Session-Leader existiert (dann eine Zeile über Sink/Fehler-UI).
     */
    const raw = normalizeMessengerWireContent(m.content ?? '')
    if (raw.includes('MORG_SEG_V1') && !parseMorgSegV1Message(raw) && !morgSarqSegInboxGroupKey(m)) {
      continue
    }
    rows.push({ kind: 'msg', msg: m, sortTs: m.timestamp })
  }
  rows.sort((a, b) => b.sortTs - a.sortTs)
  return rows
}

function addrEq(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false
  return a.toLowerCase() === b.toLowerCase()
}

/**
 * Einfügeposition: direkt unter der **neuesten** Nachricht dieses Absenders (Liste oben = neu),
 * ggf. unter bereits eingefügten Bannern desselben Absenders.
 */
function insertIndexAfterSenderBlock(rows: ChatInboxRow[], fromAddr: string): number {
  const i = rows.findIndex((r) => r.kind === 'msg' && addrEq(r.msg.from, fromAddr))
  if (i < 0) return 0
  let j = i + 1
  while (j < rows.length) {
    const r = rows[j]
    if (r.kind === 'meshInbound' && addrEq(r.fromAddr, fromAddr)) {
      j++
      continue
    }
    break
  }
  return j
}

/**
 * Funk-Empfang: Banner optisch an die betroffene Konversation anbinden (unter letzter Nachricht
 * desselben 0x-Absenders), ohne Session-State in der Bubble.
 */
export function mergeMeshInboundBannerRows(
  baseRows: ChatInboxRow[],
  inbound: Record<string, MeshInboundEntry>
): ChatInboxRow[] {
  const rows: ChatInboxRow[] = [...baseRows]
  const banners: ChatInboxRow[] = []
  for (const [id, v] of Object.entries(inbound)) {
    if (!v.hint && !v.error) continue
    banners.push({
      kind: 'meshInbound',
      id,
      sortTs: v.sortTs,
      hint: v.hint,
      error: v.error,
      fromAddr: v.fromAddr,
    })
  }
  banners.sort((a, b) => b.sortTs - a.sortTs)
  for (const b of banners) {
    if (b.kind !== 'meshInbound') continue
    if (!b.fromAddr) {
      rows.unshift(b)
      continue
    }
    const idx = insertIndexAfterSenderBlock(rows, b.fromAddr)
    rows.splice(idx, 0, b)
  }
  return rows
}
