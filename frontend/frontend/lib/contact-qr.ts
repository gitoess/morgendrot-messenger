/**
 * M4c: Kontakt-QR (kompakt v2) — Wallet + optionale Mailbox-Object-ID.
 * @see docs/QR-CONTACT-SCHEMA-V2.md (`m` = mailboxObjectId)
 */

export type MorgendrotContactQrV2 = {
  v: 2
  k: 'mc'
  a: string
  n?: string
  /** Private Mailbox (legacy). */
  m?: string
  /** M4e: Shared / Team / Puffer */
  ms?: string
  mt?: string
  mb?: string
  /** § H.16: ECDH-Pub (Base64 raw 65 Byte) für Peering im Kontakt-QR. */
  e?: string
}

export function buildContactQrPayload(input: {
  address: string
  displayName?: string
  mailboxObjectId?: string
  mailboxSharedId?: string
  mailboxTeamId?: string
  mailboxBufferId?: string
  ecdhPubB64?: string
}): string {
  const a = input.address.trim()
  if (!/^0x[a-fA-F0-9]{64}$/i.test(a)) {
    throw new Error('Adresse: 0x + 64 Hex.')
  }
  const o: MorgendrotContactQrV2 = { v: 2, k: 'mc', a }
  const n = (input.displayName ?? '').trim()
  if (n) o.n = n.slice(0, 64)
  const m = (input.mailboxObjectId ?? '').trim()
  if (m && /^0x[a-fA-F0-9]{64}$/i.test(m) && m.toLowerCase() !== a.toLowerCase()) o.m = m
  const ms = (input.mailboxSharedId ?? '').trim()
  if (ms && /^0x[a-fA-F0-9]{64}$/i.test(ms)) o.ms = ms
  const mt = (input.mailboxTeamId ?? '').trim()
  if (mt && /^0x[a-fA-F0-9]{64}$/i.test(mt)) o.mt = mt
  const mb = (input.mailboxBufferId ?? '').trim()
  if (mb && /^0x[a-fA-F0-9]{64}$/i.test(mb)) o.mb = mb
  const e = (input.ecdhPubB64 ?? '').trim().replace(/\s+/g, '')
  if (e) o.e = e
  return JSON.stringify(o)
}

export function parseContactQrPayload(raw: string): {
  address: string
  displayName?: string
  mailboxObjectId?: string
  mailboxPrivateId?: string
  mailboxSharedId?: string
  mailboxTeamId?: string
  mailboxBufferId?: string
  ecdhPubB64?: string
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
      const pickMb = (v: unknown) =>
        typeof v === 'string' && /^0x[a-fA-F0-9]{64}$/i.test(v.trim()) ? v.trim().toLowerCase() : undefined
      const mailboxObjectId = pickMb(j.m) ?? pickMb(j.mailboxObjectId)
      const mailboxSharedId = pickMb(j.ms) ?? pickMb(j.mailboxSharedId)
      const mailboxTeamId = pickMb(j.mt) ?? pickMb(j.mailboxTeamId)
      const mailboxBufferId = pickMb(j.mb) ?? pickMb(j.mailboxBufferId)
      const ecdhPubB64 =
        typeof j.e === 'string' ? j.e.trim().replace(/\s+/g, '') : undefined
      return {
        address: addr,
        ...(displayName?.trim() ? { displayName: displayName.trim().slice(0, 64) } : {}),
        ...(mailboxObjectId ? { mailboxObjectId, mailboxPrivateId: mailboxObjectId } : {}),
        ...(mailboxSharedId ? { mailboxSharedId } : {}),
        ...(mailboxTeamId ? { mailboxTeamId } : {}),
        ...(mailboxBufferId ? { mailboxBufferId } : {}),
        ...(ecdhPubB64 ? { ecdhPubB64 } : {}),
      }
    }
  } catch {
    /* fall through */
  }
  if (/^0x[a-fA-F0-9]{64}$/i.test(t)) return { address: t }
  return null
}
