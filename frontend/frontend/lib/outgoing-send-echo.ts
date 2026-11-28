/**
 * Sender-Klartext-Echo für eigene Enc-Sendungen (Double Ratchet / Session).
 * Unabhängig vom Ratchet-Wire: Nonce → Klartext, überlebt F5 (localStorage, TTL).
 */

const LS_KEY = 'morgendrot.outgoingSendEcho.v1'
const MAX = 100
const TTL_MS = 1000 * 60 * 60 * 24 * 7

type EchoEntry = { text: string; at: number; peer?: string }

const mem = new Map<string, EchoEntry>()

function norm(a: string): string {
  return a.trim().toLowerCase()
}

function keyFor(peer: string, nonce: string): string {
  return `${norm(peer)}|${String(nonce).trim()}`
}

function hydrate(): void {
  if (typeof window === 'undefined') return
  if (mem.size > 0) return
  try {
    const raw = window.localStorage.getItem(LS_KEY)?.trim()
    if (!raw) return
    const j = JSON.parse(raw) as Record<string, EchoEntry>
    const cut = Date.now() - TTL_MS
    for (const [k, v] of Object.entries(j)) {
      if (!v || typeof v.text !== 'string' || typeof v.at !== 'number') continue
      if (v.at < cut || !v.text.trim()) continue
      mem.set(k, { text: v.text, at: v.at, peer: v.peer })
    }
  } catch {
    /* ignore */
  }
}

/** Abmelden / hartes Lock: Sender-Klartext-Echo weg. */
export function clearOutgoingSendEchoOnLock(): void {
  mem.clear()
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(LS_KEY)
  } catch {
    /* ignore */
  }
}

/** Vitest-Alias. */
export function clearOutgoingSendEchoForTests(): void {
  clearOutgoingSendEchoOnLock()
}

function persist(): void {
  if (typeof window === 'undefined') return
  try {
    const cut = Date.now() - TTL_MS
    const entries = [...mem.entries()]
      .filter(([, v]) => v.at >= cut && v.text.trim())
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, MAX)
    const obj: Record<string, EchoEntry> = {}
    for (const [k, v] of entries) obj[k] = v
    window.localStorage.setItem(LS_KEY, JSON.stringify(obj))
  } catch {
    /* ignore */
  }
}

/** Nach erfolgreichem Enc-Send: Klartext unter Nonce merken (Sender-Postausgang). */
export function rememberOutgoingSendEcho(opts: {
  peerAddress: string
  nonce: string
  plaintext: string
}): void {
  const nonce = String(opts.nonce).trim()
  const text = opts.plaintext.trim()
  if (!nonce || !text) return
  hydrate()
  const peer = norm(opts.peerAddress)
  mem.set(keyFor(peer, nonce), { text, at: Date.now(), peer })
  /** Nur-Nonce-Fallback wenn Peer in Meta fehlt. */
  mem.set(`*|${nonce}`, { text, at: Date.now(), peer })
  persist()
}

export function lookupOutgoingSendEcho(peerAddress: string, nonce: string): string | null {
  hydrate()
  const n = String(nonce).trim()
  if (!n) return null
  const direct = mem.get(keyFor(peerAddress, n))
  if (direct?.text) return direct.text
  const star = mem.get(`*|${n}`)
  if (star?.text) return star.text
  const suffix = `|${n}`
  for (const [k, v] of mem) {
    if (k.endsWith(suffix)) return v.text
  }
  return null
}
