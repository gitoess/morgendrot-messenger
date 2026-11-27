/**
 * Visitenkarte teilen — Checkboxen → bestehendes Kontakt-QR (`k:'mc'`) + Klartext.
 * Kein Avatar / keine dritte QR-Welt / kein klassisches Telefon.
 * @see docs/IDEEN-BACKLOG.md
 */

import { buildContactQrPayload } from '@/frontend/lib/contact-qr'

export type VisitenkarteShareFlags = {
  includeDisplayName: boolean
  /** Immer true — Wallet-ID ist Pflicht im Payload. */
  includeWallet: true
  includeTelegram: boolean
  includeEcdh: boolean
  includeMailbox: boolean
  /** Nur Klartext — Mesh-Node-ID ist kein Feld im `mc`-QR. */
  includeMeshNode: boolean
}

export type VisitenkarteShareInput = {
  address: string
  displayName?: string | null
  telegramChatId?: string | null
  meshNodeId?: string | null
  ecdhPubB64?: string | null
  mailboxObjectId?: string | null
  flags: VisitenkarteShareFlags
}

export type VisitenkarteShareResult = {
  qrJson: string
  plainText: string
}

export function defaultVisitenkarteShareFlags(opts?: {
  hasDisplayName?: boolean
  hasTelegram?: boolean
  hasEcdh?: boolean
  hasMailbox?: boolean
  hasMeshNode?: boolean
}): VisitenkarteShareFlags {
  return {
    includeDisplayName: opts?.hasDisplayName !== false,
    includeWallet: true,
    includeTelegram: Boolean(opts?.hasTelegram),
    includeEcdh: Boolean(opts?.hasEcdh),
    includeMailbox: Boolean(opts?.hasMailbox),
    includeMeshNode: Boolean(opts?.hasMeshNode),
  }
}

export function buildVisitenkarteShare(input: VisitenkarteShareInput): VisitenkarteShareResult {
  const address = input.address.trim()
  if (!/^0x[a-fA-F0-9]{64}$/i.test(address)) {
    throw new Error('Adresse: 0x + 64 Hex.')
  }
  const name = (input.displayName ?? '').trim()
  const tg = (input.telegramChatId ?? '').trim()
  const mesh = (input.meshNodeId ?? '').trim()
  const ecdh = (input.ecdhPubB64 ?? '').trim().replace(/\s+/g, '')
  const mb = (input.mailboxObjectId ?? '').trim()

  const qrJson = buildContactQrPayload({
    address,
    displayName: input.flags.includeDisplayName && name ? name : undefined,
    mailboxObjectId: input.flags.includeMailbox && mb ? mb : undefined,
    ecdhPubB64: input.flags.includeEcdh && ecdh ? ecdh : undefined,
  })

  /** Menschenlesbar oben; Maschinen-JSON unten (Parser/CTA) — UI blendet JSON aus. */
  const lines: string[] = ['Morgendrot Visitenkarte']
  if (input.flags.includeDisplayName && name) lines.push(`Name: ${name}`)
  lines.push(`Wallet: ${address}`)
  if (input.flags.includeMailbox && mb && /^0x[a-fA-F0-9]{64}$/i.test(mb)) {
    lines.push(`Mailbox: ${mb}`)
  }
  if (input.flags.includeTelegram && tg) lines.push(`Telegram-Chat-ID: ${tg}`)
  if (input.flags.includeMeshNode && mesh) lines.push(`Funk-Node: ${mesh}`)
  if (input.flags.includeEcdh && ecdh) {
    lines.push('Verschlüsselung: Schlüssel dabei (wird beim Übernehmen gemerkt)')
  }
  lines.push('')
  lines.push(qrJson)

  return { qrJson, plainText: lines.join('\n') }
}
