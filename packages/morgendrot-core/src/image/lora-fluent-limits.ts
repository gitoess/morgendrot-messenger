/**
 * § H.25a — Flüchtig (LoRa), segmentiert (`MORG_SEG_V1`).
 * Abgleich `src/morgendrot-image-transport-policy.ts`.
 *
 * Mesh-Text ≤ 200 UTF-8 → ~93 Rohbyte/Segment; NAK-Maske 32 Bit → max. 32 Segmente/Phase
 * → harte Grenze ~3 KB **pro Phase** (nicht beliebig hochskalieren).
 *
 * **Cap 3,6 KB (2026-11-24):** Richtung ~2× Auflösung vs. 180×240@2,8 KB.
 * Echtes 360-Kanten-JPEG „scharf“ braucht oft >3 KB nur Luma → Segment-Deckel.
 */
export const FLUENT_LORA_MAX_SEGMENTS_PER_PHASE = 32

/** Luma-lastig (Schärfe); nahe an ~32×93 B Phase-Deckel. */
export const FLUENT_LORA_LUMA_JPEG_MAX_BYTES = 2800

export const FLUENT_LORA_CHROMA_JPEG_MAX_BYTES = 1000

export const FLUENT_LORA_JPEG_PAIR_TOTAL_MAX_BYTES = 3600
