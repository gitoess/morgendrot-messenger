import {
  parseCompactImageMessage,
  parseFileTxtMessage,
  parseMorgAudioV1Message,
} from '@/frontend/lib/compact-image-wire'
import type { CompactAttachmentMeta } from '@/frontend/features/attachments/chat-view-attachment-ingest'
import type { MorgPkgImportItem } from '@/frontend/lib/morg-pkg-import-store'

export type MorgPkgComposerAttachmentSetters = {
  clearAttachments: () => void
  setMessage: (text: string) => void
  setAttachedBlobBase64: (v: string | null) => void
  setAttachedTxtFile: (v: { name: string; text: string } | null) => void
  setAttachedAudioBase64: (v: string | null) => void
  setAttachedLora: (v: null) => void
  setCompactMeta: (v: CompactAttachmentMeta | null) => void
}

export type ApplyMorgPkgToComposerResult =
  | { ok: true; kind: 'image' | 'text_file' | 'audio' | 'plain_text' }
  | { ok: false; error: string }

/** Wire-Inhalt aus Paket-Archiv als Anhang/Typ im Composer (nicht Roh-JSON). */
export function applyMorgPkgItemToComposer(
  item: MorgPkgImportItem,
  setters: MorgPkgComposerAttachmentSetters
): ApplyMorgPkgToComposerResult {
  setters.clearAttachments()

  const txt = parseFileTxtMessage(item.content)
  if (txt) {
    setters.setAttachedTxtFile({ name: txt.fileName || 'import.txt', text: txt.text })
    if (txt.caption?.trim()) setters.setMessage(txt.caption.trim())
    return { ok: true, kind: 'text_file' }
  }

  const img = parseCompactImageMessage(item.content)
  if (img) {
    setters.setAttachedBlobBase64(img.blobBase64)
    setters.setCompactMeta({ total: 0, luma: 0, chroma: 0, q: 0, mode: 'iota' })
    if (img.caption?.trim()) setters.setMessage(img.caption.trim())
    return { ok: true, kind: 'image' }
  }

  const audio = parseMorgAudioV1Message(item.content)
  if (audio) {
    setters.setAttachedAudioBase64(audio.blobBase64)
    if (audio.caption?.trim()) setters.setMessage(audio.caption.trim())
    return { ok: true, kind: 'audio' }
  }

  if (item.kind === 'text' || !item.content.includes('[[MORG_')) {
    setters.setMessage(item.content)
    return { ok: true, kind: 'plain_text' }
  }

  return {
    ok: false,
    error: 'Format nicht als Bild/Text/Audio erkannt — bitte „Öffnen“ nutzen.',
  }
}
