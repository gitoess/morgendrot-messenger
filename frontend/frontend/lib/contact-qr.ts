/**
 * M4c: Kontakt-QR (kompakt v2) — Wallet + optionale Mailbox-Object-ID.
 * @see docs/QR-CONTACT-SCHEMA-V2.md (`m` = mailboxObjectId)
 */

export type MorgendrotContactQrV2 = {
  v: 2
  k: 'mc'
  a: string
  n?: string
  m?: string
}

export function buildContactQrPayload(input: {
  address: string
  displayName?: string
  mailboxObjectId?: string
}): string {
  const a = input.address.trim()
  if (!/^0x[a-fA-F0-9]{64}$/i.test(a)) {
    throw new Error('Adresse: 0x + 64 Hex.')
  }
  const o: MorgendrotContactQrV2 = { v: 2, k: 'mc', a }
  const n = (input.displayName ?? '').trim()
  if (n) o.n = n.slice(0, 64)
  const m = (input.mailboxObjectId ?? '').trim()
  if (m && /^0x[a-fA-F0-9]{64}$/i.test(m)) o.m = m
  return JSON.stringify(o)
}

export function parseContactQrPayload(raw: string): {
  address: string
  displayName?: string
  mailboxObjectId?: string
} | null {
  const t = raw.trim()
  if (!t) return null
  try {
    const j = JSON.parse(t) as Record<string, unknown>
    const v = j.v
    const k = j.k
    const a = typeof j.a === 'string' ? j.a : typeof j.address === 'string' ? j.address : ''
    if ((v === 2 && k === 'mc') || v === 1 || j.kind === 'morgendrot-contact') {
      const addr = a.trim()
      if (!/^0x[a-fA-F0-9]{64}$/i.test(addr)) return null
      const displayName =
        typeof j.n === 'string'
          ? j.n
          : typeof j.displayName === 'string'
            ? j.displayName
            : undefined
      const mailboxObjectId =
        typeof j.m === 'string'
          ? j.m
          : typeof j.mailboxObjectId === 'string'
            ? j.mailboxObjectId
            : undefined
      return {
        address: addr,
        ...(displayName?.trim() ? { displayName: displayName.trim().slice(0, 64) } : {}),
        ...(mailboxObjectId?.trim() && /^0x[a-fA-F0-9]{64}$/i.test(mailboxObjectId.trim())
          ? { mailboxObjectId: mailboxObjectId.trim() }
          : {}),
      }
    }
  } catch {
    /* fall through */
  }
  if (/^0x[a-fA-F0-9]{64}$/i.test(t)) return { address: t }
  return null
}
