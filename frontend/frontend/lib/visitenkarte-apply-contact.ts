/**
 * Visitenkarte → Telefonbuch (Merge mit Confirm-Hinweis für Aufrufer).
 * Profilbild B: Thumb lokal speichern; vorhandenes lokales Bild gewinnt.
 */

import { saveContactEntry } from '@/frontend/lib/api/contacts'
import {
  getContactAvatarDataUrl,
  setContactAvatarDataUrl,
  sha256HexUtf8,
} from '@/frontend/lib/contact-avatar-local-store'
import { readPersistentContactDirectory } from '@/frontend/lib/contact-directory-local-store'
import { setDirectChatEcdhPeerPubBase64 } from '@/frontend/lib/direct-chat-ecdh-session'
import type { VisitenkarteIngestFields } from '@/frontend/lib/visitenkarte-ingest'

export function contactExistsForVisitenkarte(address: string): boolean {
  const a = address.trim().toLowerCase()
  if (!a) return false
  const dir = readPersistentContactDirectory()
  return Boolean(dir[a])
}

export async function applyVisitenkarteToContact(
  fields: VisitenkarteIngestFields
): Promise<
  | { ok: true; message: string; merged: boolean; avatarApplied?: boolean; avatarSkipped?: boolean }
  | { ok: false; error: string }
> {
  const address = fields.address.trim()
  if (!/^0x[a-fA-F0-9]{64}$/i.test(address)) {
    return { ok: false, error: 'Ungültige Wallet-Adresse.' }
  }
  const merged = contactExistsForVisitenkarte(address)
  const existing = readPersistentContactDirectory()[address.toLowerCase()]

  /** Lokales Override: vorhandener Anzeigename bleibt, wenn Visitenkarte keinen liefert. */
  const label =
    (fields.displayName?.trim() || existing?.label?.trim() || 'Partner').slice(0, 64)

  const r = await saveContactEntry({
    address,
    label,
    ...(fields.mailboxPrivateId
      ? { mailboxPrivateId: fields.mailboxPrivateId, mailboxObjectId: fields.mailboxPrivateId }
      : {}),
    ...(fields.mailboxSharedId ? { mailboxSharedId: fields.mailboxSharedId } : {}),
    ...(fields.mailboxTeamId ? { mailboxTeamId: fields.mailboxTeamId } : {}),
    ...(fields.mailboxBufferId ? { mailboxBufferId: fields.mailboxBufferId } : {}),
    ...(fields.telegramChatId ? { telegramChatId: fields.telegramChatId } : {}),
    ...(fields.meshNodeId ? { meshNodeId: fields.meshNodeId } : {}),
  })
  if (!r.ok) return { ok: false, error: r.error || 'Kontakt speichern fehlgeschlagen.' }

  if (fields.ecdhPubB64?.trim()) {
    setDirectChatEcdhPeerPubBase64(address, fields.ecdhPubB64)
  }

  let avatarApplied = false
  let avatarSkipped = false
  const thumb = fields.avatarThumbDataUrl?.trim()
  if (thumb?.startsWith('data:image/')) {
    if (fields.avatarHashHex) {
      const dig = await sha256HexUtf8(thumb)
      if (dig !== fields.avatarHashHex.toLowerCase()) {
        return { ok: false, error: 'Profilbild-Hash stimmt nicht — Thumb verworfen.' }
      }
    }
    if (getContactAvatarDataUrl(address)) {
      avatarSkipped = true
    } else {
      const av = setContactAvatarDataUrl(address, thumb)
      if (!av.ok) return { ok: false, error: av.error }
      if (av.skippedLocalOverride) avatarSkipped = true
      else avatarApplied = true
    }
  }

  const base = merged
    ? r.message || 'Kontakt aktualisiert (Merge).'
    : r.message || 'Kontakt angelegt.'
  const avatarNote = avatarApplied
    ? ' Profilbild übernommen.'
    : avatarSkipped
      ? ' Eigenes Profilbild behalten.'
      : ''

  return {
    ok: true,
    merged,
    avatarApplied,
    avatarSkipped,
    message: `${base}${avatarNote}`,
  }
}
