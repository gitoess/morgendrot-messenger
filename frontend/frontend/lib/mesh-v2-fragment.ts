/**
 * MF1-Fragmente für Mesh v2 (PRIVATE_APP) – Reassembly nach Decrypt.
 * Split-Logik (Sender): `src/mesh-v2-fragment.ts` – Konstanten synchron halten.
 */
export const MESH_V2_MAX_PLAINTEXT_UTF8 = 175

const MF1_RE =
  /^\[\[MF1:mid=([0-9a-f]{8}):i=(\d{6}):t=(\d{6}):\]\]/

export type ParsedMeshFrag =
  | { kind: 'fragment'; mid: string; index: number; total: number; payload: string }
  | { kind: 'plain'; text: string }

export function parseMeshFragPlaintext(plain: string): ParsedMeshFrag {
  const m = plain.match(MF1_RE)
  if (!m) return { kind: 'plain', text: plain }
  const mid = m[1]!
  const index = parseInt(m[2]!, 10)
  const total = parseInt(m[3]!, 10)
  const payload = plain.slice(m[0]!.length)
  return { kind: 'fragment', mid, index, total, payload }
}

type Buf = {
  total: number
  parts: Map<number, string>
  timer: ReturnType<typeof setTimeout> | null
}

const INCOMPLETE_TTL_MS = 10 * 60_000
const MAX_FRAG_TOTAL = 4000

export type MeshFragMergeResult =
  | { status: 'complete'; text: string; mf1Mid?: string }
  | { status: 'pending' }

/** Sammelt MF1-Fragmente zu einem Klartext-String (Reihenfolge egal). */
export class MeshFragReassembler {
  private readonly byKey = new Map<string, Buf>()

  /**
   * `pending` = noch nicht alle Teile; `complete` = Klartext (oder Fehlertext bei kaputtem MF1).
   */
  tryMerge(senderKey: string, plain: string): MeshFragMergeResult {
    const p = parseMeshFragPlaintext(plain)
    if (p.kind === 'plain') return { status: 'complete', text: p.text }

    const { mid, index, total, payload } = p
    if (!Number.isFinite(total) || total < 1 || total > MAX_FRAG_TOTAL || index < 0 || index >= total) {
      return {
        status: 'complete',
        text: `[MF1 ungültig: mid=${mid} i=${index} t=${total}]`,
      }
    }

    const key = `${senderKey}:${mid}`
    let b = this.byKey.get(key)
    if (b && b.parts.size > 0 && b.total !== total) {
      if (b.timer) clearTimeout(b.timer)
      this.byKey.delete(key)
      b = undefined
    }
    if (!b) {
      b = { total, parts: new Map(), timer: null }
      this.byKey.set(key, b)
    }
    if (!b.parts.has(index)) {
      b.parts.set(index, payload)
    }

    if (b.timer) clearTimeout(b.timer)
    b.timer = setTimeout(() => {
      this.byKey.delete(key)
    }, INCOMPLETE_TTL_MS)

    if (b.parts.size < total) return { status: 'pending' }

    const chunks: string[] = []
    for (let i = 0; i < total; i++) {
      const part = b.parts.get(i)
      if (part === undefined) return { status: 'pending' }
      chunks.push(part)
    }
    if (b.timer) clearTimeout(b.timer)
    this.byKey.delete(key)
    const text = chunks.join('')
    return { status: 'complete', text, mf1Mid: mid }
  }
}
