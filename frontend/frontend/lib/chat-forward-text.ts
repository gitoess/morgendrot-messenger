/**
 * Text für „Nachricht weiterleiten“ aus Posteingangs-`Message.content` (MORG-Wire oder Klartext).
 */
import type { Message } from './types'
import {
  COMPACT_IMG_PREFIX,
  MORG_AUDIO_V1_PREFIX,
  normalizeMessengerWireContent,
  parseCompactTextMessage,
  parseFileTxtMessage,
} from './compact-image-wire'

export function extractForwardablePlainText(content: string | undefined): { text: string; isMediaHint: boolean } {
  const raw = normalizeMessengerWireContent(content ?? '')
  if (!raw.trim()) return { text: '(leer)', isMediaHint: false }

  const compactTxt = parseCompactTextMessage(raw)
  if (compactTxt) {
    const body = [compactTxt.text, compactTxt.caption].filter(Boolean).join('\n\n')
    return { text: body, isMediaHint: false }
  }
  const fileTxt = parseFileTxtMessage(raw)
  if (fileTxt) {
    return {
      text: `[Datei: ${fileTxt.fileName}]\n${fileTxt.text}${fileTxt.caption ? `\n\n${fileTxt.caption}` : ''}`,
      isMediaHint: false,
    }
  }
  if (raw.includes(COMPACT_IMG_PREFIX) || raw.includes('MORG_LUMA_V1') || raw.includes('MORG_SLIDE_V1')) {
    return {
      text: '[Medieninhalt (Bild/Slideshow) – nicht als Klartext weitergebbar; ggf. Screenshot oder manuell beschreiben.]',
      isMediaHint: true,
    }
  }
  if (raw.includes(MORG_AUDIO_V1_PREFIX)) {
    return {
      text: '[Sprachnachricht – Wire nicht als Text weitergebbar.]',
      isMediaHint: true,
    }
  }
  if (!raw.includes('[[MORG_')) {
    return { text: raw, isMediaHint: false }
  }
  return {
    text:
      '[Strukturierter Wire-Inhalt – Auszug]\n' +
      raw.slice(0, Math.min(800, raw.length)) +
      (raw.length > 800 ? '…' : ''),
    isMediaHint: true,
  }
}

/** Block für das Composer-Feld; Nutzer wählt Empfänger und sendet manuell. */
export function buildForwardComposerPayload(msg: Message, includeSender: boolean): string {
  const { text } = extractForwardablePlainText(msg.content)
  const ts = new Date(msg.timestamp).toLocaleString('de-DE')
  const header = includeSender
    ? `--- Weitergeleitet · Von ${msg.from}${msg.recipient ? ` · An ${msg.recipient}` : ''} · ${ts} ---`
    : `--- Weitergeleitet · ${ts} ---`
  return `${header}\n\n${text}`
}
