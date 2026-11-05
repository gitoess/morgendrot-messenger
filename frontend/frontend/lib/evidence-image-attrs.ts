/**
 * Freie Mint-Attribute ohne Move-Dynamic-Fields:
 * werden in `description` als Block `[morg-attrs]` abgelegt
 * (Contract kennt nur name/description/classification).
 */

export const EVIDENCE_ATTR_BLOCK_START = '[morg-attrs]'
export const EVIDENCE_ATTR_MAX_PAIRS = 6
export const EVIDENCE_ATTR_KEY_MAX = 32
export const EVIDENCE_ATTR_VALUE_MAX = 96

export type EvidenceAttrPair = { key: string; value: string }

const KEY_RE = /^[a-zA-Z][a-zA-Z0-9_-]{0,31}$/

export function normalizeEvidenceAttrKey(raw: string): string {
  return raw.trim().slice(0, EVIDENCE_ATTR_KEY_MAX)
}

export function normalizeEvidenceAttrValue(raw: string): string {
  return raw.trim().replace(/\r?\n/g, ' ').slice(0, EVIDENCE_ATTR_VALUE_MAX)
}

export function sanitizeEvidenceAttrPairs(pairs: readonly EvidenceAttrPair[]): EvidenceAttrPair[] {
  const out: EvidenceAttrPair[] = []
  const seen = new Set<string>()
  for (const p of pairs) {
    if (out.length >= EVIDENCE_ATTR_MAX_PAIRS) break
    const key = normalizeEvidenceAttrKey(p.key)
    const value = normalizeEvidenceAttrValue(p.value)
    if (!key || !value) continue
    if (!KEY_RE.test(key)) continue
    const k = key.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ key, value })
  }
  return out
}

/** description-Text + optionaler Attr-Block (max. 512 Zeichen Move-Limit beachten). */
export function packEvidenceDescription(
  description: string,
  pairs: readonly EvidenceAttrPair[],
  maxTotal = 512
): string {
  const body = description.trim().slice(0, maxTotal)
  const clean = sanitizeEvidenceAttrPairs(pairs)
  if (!clean.length) return body
  const lines = clean.map((p) => `${p.key}=${p.value}`)
  const block = `${EVIDENCE_ATTR_BLOCK_START}\n${lines.join('\n')}`
  const joined = body ? `${body}\n\n${block}` : block
  if (joined.length <= maxTotal) return joined
  /** Attrs kürzen, Body behalten. */
  const budget = Math.max(0, maxTotal - body.length - 2 - EVIDENCE_ATTR_BLOCK_START.length - 1)
  if (budget < 8) return body.slice(0, maxTotal)
  let packed = ''
  for (const line of lines) {
    const next = packed ? `${packed}\n${line}` : line
    if (next.length > budget) break
    packed = next
  }
  if (!packed) return body.slice(0, maxTotal)
  const out = body ? `${body}\n\n${EVIDENCE_ATTR_BLOCK_START}\n${packed}` : `${EVIDENCE_ATTR_BLOCK_START}\n${packed}`
  return out.slice(0, maxTotal)
}

export function unpackEvidenceDescription(description: string): {
  body: string
  attrs: EvidenceAttrPair[]
} {
  const raw = String(description || '')
  const idx = raw.indexOf(EVIDENCE_ATTR_BLOCK_START)
  if (idx < 0) return { body: raw.trim(), attrs: [] }
  const body = raw.slice(0, idx).trim()
  const rest = raw.slice(idx + EVIDENCE_ATTR_BLOCK_START.length).replace(/^\r?\n/, '')
  const attrs: EvidenceAttrPair[] = []
  for (const line of rest.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('[')) break
    const eq = t.indexOf('=')
    if (eq <= 0) continue
    attrs.push({
      key: t.slice(0, eq),
      value: t.slice(eq + 1),
    })
  }
  return { body, attrs: sanitizeEvidenceAttrPairs(attrs) }
}
