'use client'

/**
 * Datei → Vault-Notiz-Anhang (gleiche Typen wie Messenger-Pick).
 */
import {
  CHAT_ATTACHMENT_MAX_RAW_IMAGE_BYTES,
  validateCompactPickFileType,
} from '@/frontend/features/attachments/chat-view-attachment-ingest'
import { uint8ArrayToBase64 } from '@/frontend/lib/emergency-binary-browser'
import type { VaultNoteAttachment } from '@/frontend/lib/api/vault-notes'
import {
  VN_MAX_ATTACHMENTS,
  VN_MAX_ATTACH_BYTES_AUDIO,
  VN_MAX_ATTACH_BYTES_TXT,
} from '@/frontend/lib/vault-note-attachment-limits'

export type VaultNoteAttachmentIngestFailure = { ok: false; message: string }
export type VaultNoteAttachmentIngestSuccess = { ok: true; attachment: VaultNoteAttachment }

function newAttachmentId(): string {
  return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function isTxtFile(file: File): boolean {
  return file.type === 'text/plain' || /\.txt$/i.test(file.name)
}

function isLikelyOpusFile(file: File): boolean {
  return (
    /\.opus$/i.test(file.name) ||
    /\.ogg$/i.test(file.name) ||
    file.type === 'audio/ogg' ||
    file.type === 'audio/opus' ||
    file.type === 'application/ogg' ||
    file.type === 'video/ogg'
  )
}

function isLikelyImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  return /\.(jpe?g|png|gif|webp|bmp)$/i.test(file.name)
}

function mimeForFile(file: File): string {
  if (file.type) return file.type
  if (isTxtFile(file)) return 'text/plain'
  if (isLikelyOpusFile(file)) return 'audio/ogg'
  if (/\.png$/i.test(file.name)) return 'image/png'
  if (/\.jpe?g$/i.test(file.name)) return 'image/jpeg'
  if (/\.webp$/i.test(file.name)) return 'image/webp'
  if (/\.gif$/i.test(file.name)) return 'image/gif'
  return 'application/octet-stream'
}

async function ingestImage(file: File): Promise<VaultNoteAttachmentIngestFailure | VaultNoteAttachmentIngestSuccess> {
  if (file.size > CHAT_ATTACHMENT_MAX_RAW_IMAGE_BYTES) {
    return { ok: false, message: 'Bild zu groß (max. 12 MB).' }
  }
  const buf = await file.arrayBuffer()
  const u8 = new Uint8Array(buf)
  return {
    ok: true,
    attachment: {
      id: newAttachmentId(),
      name: file.name,
      mime: mimeForFile(file),
      kind: 'image',
      dataBase64: uint8ArrayToBase64(u8),
      updatedAt: Date.now(),
    },
  }
}

async function ingestTxt(file: File): Promise<VaultNoteAttachmentIngestFailure | VaultNoteAttachmentIngestSuccess> {
  const text = await file.text()
  const bytes = new TextEncoder().encode(text)
  if (bytes.length > VN_MAX_ATTACH_BYTES_TXT) {
    return { ok: false, message: `Textdatei zu groß (max. ${Math.round(VN_MAX_ATTACH_BYTES_TXT / 1024)} KiB).` }
  }
  return {
    ok: true,
    attachment: {
      id: newAttachmentId(),
      name: file.name,
      mime: 'text/plain',
      kind: 'text',
      dataBase64: uint8ArrayToBase64(bytes),
      textContent: text,
      updatedAt: Date.now(),
    },
  }
}

async function ingestOpus(file: File): Promise<VaultNoteAttachmentIngestFailure | VaultNoteAttachmentIngestSuccess> {
  const buf = await file.arrayBuffer()
  const u8 = new Uint8Array(buf)
  const magic = String.fromCharCode(u8[0] ?? 0, u8[1] ?? 0, u8[2] ?? 0, u8[3] ?? 0)
  if (u8.length < 4 || magic !== 'OggS') {
    return { ok: false, message: 'Erwartet Ogg-Container (Magic „OggS“), typisch für .opus.' }
  }
  if (u8.length > VN_MAX_ATTACH_BYTES_AUDIO) {
    return {
      ok: false,
      message: `Sprachdatei zu groß (max. ${Math.round(VN_MAX_ATTACH_BYTES_AUDIO / 1024)} KiB).`,
    }
  }
  return {
    ok: true,
    attachment: {
      id: newAttachmentId(),
      name: file.name,
      mime: mimeForFile(file),
      kind: 'audio',
      dataBase64: uint8ArrayToBase64(u8),
      updatedAt: Date.now(),
    },
  }
}

export async function ingestVaultNoteAttachment(
  file: File
): Promise<VaultNoteAttachmentIngestFailure | VaultNoteAttachmentIngestSuccess> {
  const typeErr = validateCompactPickFileType(file)
  if (typeErr) return { ok: false, message: typeErr.message }
  if (isTxtFile(file)) return ingestTxt(file)
  if (isLikelyOpusFile(file)) return ingestOpus(file)
  if (isLikelyImageFile(file)) return ingestImage(file)
  return {
    ok: false,
    message:
      'Unterstützt: Bilder (.jpg, .png, .webp, …), Text (.txt) oder Opus/Ogg (.opus, .ogg).',
  }
}

export function vaultNoteAttachmentDataUrl(att: VaultNoteAttachment): string {
  return `data:${att.mime};base64,${att.dataBase64}`
}

export { VN_MAX_ATTACHMENTS }
