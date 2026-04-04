'use client'

/**
 * Baut Wire-Text für den Chat-Versand aus Composer + Anhängen (ohne React).
 * Delayed Upload / LoRa werden später dieselben Grenzen und Formate treffen.
 */

import {
  wrapCompactImageMessage,
  wrapFileTxtMessage,
  wireUtf8ByteLength,
  wrapMorgAudioV1Message,
} from '@/frontend/lib/compact-image-wire'

/** LUMA/CHROMA inkl. optionaler Bildunterschrift (Composer-Zeile). */
export function buildLoraMeshDualWireTexts(
  lumaWire: string,
  chromaWire: string,
  composerPlainText: string
): { lumaText: string; chromaText: string } {
  const cap = composerPlainText.trim() || undefined
  const lumaText = cap ? `${lumaWire}\n\n${cap}` : lumaWire
  const chromaText = cap ? `${chromaWire}\n\n${cap}` : chromaWire
  return { lumaText, chromaText }
}

export type OutgoingAttachmentState = {
  composerPlainText: string
  attachedAudioBase64: string | null
  attachedBlobBase64: string | null
  attachedTxtFile: { name: string; text: string } | null
}

/** Ergebnis für Mailbox/Mesh (ohne LoRa-Zweiphasen). Leerstring = nichts zu senden. */
export function buildChatOutgoingWireContent(p: OutgoingAttachmentState): string {
  const cap = p.composerPlainText.trim() || undefined
  const trimmed = p.composerPlainText.trim()
  return p.attachedAudioBase64
    ? wrapMorgAudioV1Message(p.attachedAudioBase64, cap)
    : p.attachedBlobBase64
      ? wrapCompactImageMessage(p.attachedBlobBase64, cap)
      : p.attachedTxtFile != null
        ? wrapFileTxtMessage(p.attachedTxtFile.name, p.attachedTxtFile.text, cap)
        : trimmed
}

/** Für Debugging (Browser-Konsole): kein vollständiger Blob, nur Längen und Flags. */
export function describeOutgoingWireForDebug(
  p: OutgoingAttachmentState,
  wire: string
): Record<string, unknown> {
  const w = wire ?? ''
  let wireKind: 'audio' | 'compact_img' | 'file_txt' | 'plain' = 'plain'
  if (p.attachedAudioBase64) wireKind = 'audio'
  else if (p.attachedBlobBase64) wireKind = 'compact_img'
  else if (p.attachedTxtFile != null) wireKind = 'file_txt'
  const head = w.slice(0, 96)
  return {
    wireKind,
    utf8Bytes: wireUtf8ByteLength(w),
    jsChars: w.length,
    flags: {
      blob: p.attachedBlobBase64 != null,
      blobB64Chars: p.attachedBlobBase64?.length ?? 0,
      txt: p.attachedTxtFile != null,
      txtUtf8: p.attachedTxtFile
        ? new TextEncoder().encode(p.attachedTxtFile.text).length
        : 0,
      audio: p.attachedAudioBase64 != null,
      audioB64Chars: p.attachedAudioBase64?.length ?? 0,
    },
    composerChars: p.composerPlainText.length,
    headPreview: head,
  }
}

export function isBrowserSendDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage?.getItem('morg.debug.send') === '1'
  } catch {
    return false
  }
}
