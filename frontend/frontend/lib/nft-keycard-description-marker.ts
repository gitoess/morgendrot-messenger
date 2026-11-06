/**
 * H.23 B2 P3: öffentlicher Description-Marker `[morg-keycard]` (keine Secrets).
 * Spec: docs/NFT-SCHLUESSELKARTE-B2.md
 */

export const NFT_KEYCARD_DESC_BLOCK_START = '[morg-keycard]'

export type NftKeycardDescriptionHint = {
  cardObjectId: string
  slotId: string
}

function normOid(objectId: string): string {
  return objectId.trim().toLowerCase()
}

function normSlot(slotId: string): string {
  return (slotId || 'default').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) || 'default'
}

/** Hängt öffentlichen Keycard-Hinweis an die Description (vor Attr-Block ok). */
export function appendNftKeycardDescriptionMarker(
  description: string,
  hint: NftKeycardDescriptionHint,
  maxTotal = 512
): string {
  const card = normOid(hint.cardObjectId)
  if (!/^0x[a-f0-9]{64}$/.test(card)) return description.trim().slice(0, maxTotal)
  const slot = normSlot(hint.slotId)
  const block = `${NFT_KEYCARD_DESC_BLOCK_START}\ncard=${card}\nslot=${slot}`
  const body = description.trim()
  const joined = body ? `${body}\n\n${block}` : block
  return joined.slice(0, maxTotal)
}

export function unpackNftKeycardDescriptionMarker(description: string): NftKeycardDescriptionHint | null {
  const raw = String(description || '')
  const idx = raw.indexOf(NFT_KEYCARD_DESC_BLOCK_START)
  if (idx < 0) return null
  const rest = raw.slice(idx + NFT_KEYCARD_DESC_BLOCK_START.length).replace(/^\r?\n/, '')
  let cardObjectId = ''
  let slotId = 'default'
  for (const line of rest.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('[')) break
    const eq = t.indexOf('=')
    if (eq <= 0) continue
    const k = t.slice(0, eq).trim().toLowerCase()
    const v = t.slice(eq + 1).trim()
    if (k === 'card') cardObjectId = normOid(v)
    if (k === 'slot') slotId = normSlot(v)
  }
  if (!/^0x[a-f0-9]{64}$/.test(cardObjectId)) return null
  return { cardObjectId, slotId }
}
