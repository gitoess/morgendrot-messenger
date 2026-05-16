/**
 * § H.25a — Flüchtig (LoRa): harte Grenzen (shared für attachments, send, UI).
 * Keine Abhängigkeit zu features/send — siehe MESSENGER-UI-MODULARITY-STRATEGY.
 */

/** Hard-Cap gesamt (Luma-JPEG + Chroma-JPEG Rohbytes). */
export const FLUENT_LORA_IMAGE_MAX_TOTAL_BYTES = 12_000

export const FLUENT_LORA_MAX_SEGMENTS_PER_PHASE = 32
