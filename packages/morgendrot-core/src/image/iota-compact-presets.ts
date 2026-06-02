/**
 * Auflösungs-/Chroma-Presets für IOTA `MORG_COMPACT_IMG_V1` (spiegelt `VaultImagePipeline.encodeToPlaintextBlobFitChain`).
 */

export type IotaCompactPreset = { dim: number; cw: number; ch: number }

const PRESETS_XL: readonly IotaCompactPreset[] = [
  { dim: 2048, cw: 192, ch: 144 },
  { dim: 2048, cw: 176, ch: 132 },
  { dim: 2048, cw: 160, ch: 120 },
  { dim: 1920, cw: 168, ch: 126 },
  { dim: 1920, cw: 144, ch: 108 },
  { dim: 1792, cw: 152, ch: 114 },
  { dim: 1792, cw: 128, ch: 96 },
  { dim: 1664, cw: 128, ch: 96 },
  { dim: 1664, cw: 112, ch: 84 },
  { dim: 1536, cw: 120, ch: 90 },
  { dim: 1536, cw: 104, ch: 78 },
  { dim: 1408, cw: 112, ch: 84 },
  { dim: 1408, cw: 96, ch: 72 },
  { dim: 1280, cw: 104, ch: 78 },
  { dim: 1280, cw: 88, ch: 66 },
]

const PRESETS_HIGH_COLOR: readonly IotaCompactPreset[] = [
  { dim: 1024, cw: 96, ch: 72 },
  { dim: 1024, cw: 88, ch: 66 },
  { dim: 960, cw: 88, ch: 66 },
  { dim: 960, cw: 80, ch: 60 },
  { dim: 896, cw: 80, ch: 60 },
  { dim: 896, cw: 72, ch: 54 },
  { dim: 840, cw: 72, ch: 54 },
  { dim: 840, cw: 64, ch: 48 },
  { dim: 768, cw: 64, ch: 48 },
  { dim: 768, cw: 56, ch: 42 },
  { dim: 720, cw: 56, ch: 42 },
  { dim: 720, cw: 52, ch: 39 },
]

const PRESETS_BASE: readonly IotaCompactPreset[] = [
  { dim: 720, cw: 48, ch: 36 },
  { dim: 720, cw: 40, ch: 30 },
  { dim: 560, cw: 36, ch: 27 },
  { dim: 560, cw: 32, ch: 24 },
  { dim: 448, cw: 32, ch: 24 },
  { dim: 448, cw: 28, ch: 21 },
  { dim: 384, cw: 28, ch: 21 },
  { dim: 384, cw: 24, ch: 18 },
  { dim: 320, cw: 24, ch: 18 },
  { dim: 320, cw: 20, ch: 15 },
  { dim: 256, cw: 20, ch: 15 },
  { dim: 256, cw: 16, ch: 12 },
  { dim: 200, cw: 16, ch: 12 },
  { dim: 200, cw: 14, ch: 10 },
  { dim: 176, cw: 14, ch: 10 },
  { dim: 176, cw: 12, ch: 9 },
  { dim: 160, cw: 12, ch: 9 },
  { dim: 160, cw: 10, ch: 8 },
]

export function selectIotaCompactPresets(maxPlaintextBytes: number): readonly IotaCompactPreset[] {
  if (maxPlaintextBytes >= 55_000) return [...PRESETS_XL, ...PRESETS_HIGH_COLOR, ...PRESETS_BASE]
  if (maxPlaintextBytes >= 10_400) return [...PRESETS_HIGH_COLOR, ...PRESETS_BASE]
  return PRESETS_BASE
}
