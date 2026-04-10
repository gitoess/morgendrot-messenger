/**
 * Große .txt-Anhänge: in mehrere MORG_FILE_TXT_V1-Nachrichten splitten (Wire ≤ MESSAGING_WIRE_UTF8_MAX).
 */
import {
  MESSAGING_WIRE_UTF8_MAX,
  sanitizeTxtFileName,
  wireUtf8ByteLength,
  wrapFileTxtMessage,
} from '@/frontend/lib/compact-image-wire'

/** Ziel: ~14.000 Zeichen Rohtext pro Teil (unter 16.000 Byte UTF-8-Wire mit Kodierung). */
export const TXT_FILE_PART_MAX_CHARS = 14_000

/**
 * Liefert ein Array fertiger Wire-Strings (je eine ausgehende Nachricht).
 * Passt `maxChars` bei Bedarf runter, bis jeder Teil unter dem Wire-Limit bleibt.
 */
export function buildTxtFileWireParts(fileName: string, text: string, caption: string | undefined): string[] {
  const base = sanitizeTxtFileName(fileName)
  let maxChars = TXT_FILE_PART_MAX_CHARS

  for (let attempt = 0; attempt < 16; attempt++) {
    const chunks: string[] = []
    if (text.length === 0) {
      chunks.push('')
    } else {
      for (let i = 0; i < text.length; i += maxChars) {
        chunks.push(text.slice(i, i + maxChars))
      }
    }
    const total = Math.max(1, chunks.length)
    const wires = chunks.map((chunk, idx) =>
      wrapFileTxtMessage(`${base} – Teil ${idx + 1}/${total}`, chunk, caption)
    )
    const over = wires.find((w) => wireUtf8ByteLength(w) > MESSAGING_WIRE_UTF8_MAX)
    if (!over) return wires
    maxChars = Math.max(256, Math.floor(maxChars / 2))
  }
  throw new Error(
    `.txt-Anhang passt auch nach Aufteilen nicht unter ${MESSAGING_WIRE_UTF8_MAX} Byte UTF-8 (sehr langer Dateiname?).`
  )
}
