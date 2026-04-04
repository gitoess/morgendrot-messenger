/**
 * Gemeinsame Typen für Chat-Anhänge (LoRa LUMA/CHROMA, Send-Flow, UI-Balken).
 */

export type ChatAttachedLora = {
  lumaWire: string
  chromaWire: string
  messageId: string
  lumaJpegBytes: number
  chromaJpegBytes: number
}
