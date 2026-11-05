/**
 * Compact-Wire-Bilder aus dem lokalen Posteingang (MORG_COMPACT_IMG_V1) —
 * getrennt von on-chain ImageNFT.
 */
import { parseCompactImageMessage, normalizeMessengerWireContent } from '@/frontend/lib/compact-image-wire'
import { reconstructCompactImageToDataUrlWithMeta } from '@/frontend/lib/compact-image-canvas'

export type InboxWireImageCandidate = {
  messageId: string
  ts: number
  sender: string
  recipient: string
  caption?: string
  blobBase64: string
}

export type InboxWireImageRow = InboxWireImageCandidate & {
  dataUrl?: string
  error?: string
}

type MsgLike = {
  id?: string
  content?: string
  text?: string
  ts?: number
  timestamp?: number
  sender?: string
  recipient?: string
}

function messageTs(m: MsgLike): number {
  const n = Number(m.ts ?? m.timestamp ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** Rohkandidaten aus Inbox-Nachrichten (kein Decode). */
export function collectCompactImagesFromInboxMessages(
  messages: readonly MsgLike[] | null | undefined
): InboxWireImageCandidate[] {
  const out: InboxWireImageCandidate[] = []
  if (!messages?.length) return out
  for (const m of messages) {
    const raw = normalizeMessengerWireContent(String(m.content ?? m.text ?? ''))
    if (!raw.includes('MORG_COMPACT_IMG_V1')) continue
    const parsed = parseCompactImageMessage(raw)
    if (!parsed?.blobBase64) continue
    out.push({
      messageId: String(m.id || `${messageTs(m)}-${m.sender || ''}`),
      ts: messageTs(m),
      sender: String(m.sender || ''),
      recipient: String(m.recipient || ''),
      caption: parsed.caption,
      blobBase64: parsed.blobBase64,
    })
  }
  out.sort((a, b) => b.ts - a.ts)
  return out
}

export async function decodeInboxWireImageCandidate(
  c: InboxWireImageCandidate
): Promise<InboxWireImageRow> {
  try {
    const meta = await reconstructCompactImageToDataUrlWithMeta(c.blobBase64)
    if (!meta?.dataUrl) return { ...c, error: 'Rekonstruktion fehlgeschlagen.' }
    return { ...c, dataUrl: meta.dataUrl }
  } catch (e) {
    return { ...c, error: e instanceof Error ? e.message : 'Decode fehlgeschlagen.' }
  }
}

/** Seite von Kandidaten decodieren (UI 10er-Schritte). */
export async function decodeInboxWireImagePage(
  candidates: readonly InboxWireImageCandidate[],
  offset: number,
  limit: number
): Promise<InboxWireImageRow[]> {
  const slice = candidates.slice(offset, offset + limit)
  return Promise.all(slice.map((c) => decodeInboxWireImageCandidate(c)))
}
