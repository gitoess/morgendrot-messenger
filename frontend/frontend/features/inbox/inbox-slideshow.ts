import type { Message } from '@/frontend/lib/types'
import { parseSlideFragmentMessage } from '@/frontend/lib/slide-wire'

export type CompletedSlideSequence = {
  key: string
  framesBase64: string[]
  hiddenMessageIds: string[]
  sortTs: number
}

/** Vollständige MORG_SLIDE_V1-Sequenzen (alle Indizes 0..total-1), chronologisch aus dem Posteingang rekonstruiert. */
export function extractCompletedSlideSequences(messages: Message[]): CompletedSlideSequence[] {
  const chronological = [...messages].sort((a, b) => a.timestamp - b.timestamp)
  const bySeq = new Map<
    string,
    Array<{ id: string; ts: number; f: NonNullable<ReturnType<typeof parseSlideFragmentMessage>> }>
  >()
  for (const m of chronological) {
    const p = parseSlideFragmentMessage(m.content)
    if (!p) continue
    if (!bySeq.has(p.sequenceId)) bySeq.set(p.sequenceId, [])
    bySeq.get(p.sequenceId)!.push({ id: m.id, ts: m.timestamp, f: p })
  }
  const out: CompletedSlideSequence[] = []
  for (const [sequenceId, arr] of bySeq) {
    if (arr.length === 0) continue
    const total = arr[0]!.f.total
    if (!arr.every((x) => x.f.total === total)) continue
    const byI = new Map<number, (typeof arr)[0]>()
    for (const x of arr) byI.set(x.f.index, x)
    let ok = true
    for (let i = 0; i < total; i++) {
      if (!byI.has(i)) ok = false
    }
    if (!ok) continue
    const framesBase64 = Array.from({ length: total }, (_, i) => byI.get(i)!.f.payloadBase64)
    const hiddenMessageIds = Array.from({ length: total }, (_, i) => byI.get(i)!.id)
    const sortTs = Math.max(...arr.map((x) => x.ts))
    out.push({ key: sequenceId, framesBase64, hiddenMessageIds, sortTs })
  }
  out.sort((a, b) => b.sortTs - a.sortTs)
  return out
}
