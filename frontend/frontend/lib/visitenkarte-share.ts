/**
 * Visitenkarte teilen — Checkboxen → bestehendes Kontakt-QR (`k:'mc'`) + Klartext.
 * Profilbild B: Thumb + Hash nur im Klartext (nicht im QR).
 * @see docs/IDEEN-BACKLOG.md
 */

import { buildContactQrPayload } from '@/frontend/lib/contact-qr'

/** Klartext-Marker Stufe B — außerhalb QR. */
export const VISITENKARTE_AVATAR_HASH_PREFIX = 'Profilbild-Hash:'
export const VISITENKARTE_AVATAR_THUMB_PREFIX = 'Profilbild-Thumb:'

export type VisitenkarteShareFlags = {
  includeDisplayName: boolean
  /** Immer true — Wallet-ID ist Pflicht im Payload. */
  includeWallet: true
  includeTelegram: boolean
  includeEcdh: boolean
  includeMailbox: boolean
  /** Nur Klartext — Mesh-Node-ID ist kein Feld im `mc`-QR. */
  includeMeshNode: boolean
  /** Stufe B: lokales Profilbild als Thumb+Hash im Klartext (nicht im QR). */
  includeAvatarThumb: boolean
}

export type VisitenkarteShareInput = {
  address: string
  displayName?: string | null
  telegramChatId?: string | null
  meshNodeId?: string | null
  ecdhPubB64?: string | null
  mailboxObjectId?: string | null
  /** data:image/… — nur wenn flags.includeAvatarThumb. */
  avatarThumbDataUrl?: string | null
  /** SHA-256 Hex des Thumb-Data-URL. */
  avatarHashHex?: string | null
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
  hasAvatar?: boolean
}): VisitenkarteShareFlags {
  return {
    includeDisplayName: opts?.hasDisplayName !== false,
    includeWallet: true,
    includeTelegram: Boolean(opts?.hasTelegram),
    includeEcdh: Boolean(opts?.hasEcdh),
    includeMailbox: Boolean(opts?.hasMailbox),
    includeMeshNode: Boolean(opts?.hasMeshNode),
    /** Default aus — Opt-in Privacy. */
    includeAvatarThumb: false,
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
  const thumb = (input.avatarThumbDataUrl ?? '').trim()
  const hash = (input.avatarHashHex ?? '').trim().toLowerCase()

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
  if (input.flags.includeAvatarThumb && thumb.startsWith('data:image/') && /^[a-f0-9]{64}$/.test(hash)) {
    lines.push(`${VISITENKARTE_AVATAR_HASH_PREFIX} ${hash}`)
    lines.push(`${VISITENKARTE_AVATAR_THUMB_PREFIX} ${thumb}`)
  }
  lines.push('')
  lines.push(qrJson)

  return { qrJson, plainText: lines.join('\n') }
}
