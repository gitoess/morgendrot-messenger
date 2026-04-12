'use client'

/**
 * B2: gleiche Konstanten/Logik wie `src/shared/morg-sos-mesh-retry.ts` (Next/Turbopack lädt kein `../src/shared`).
 */

export const SOS_MESH_RETRY_DEFAULTS = {
  maxAttempts: 5,
  initialDelayMs: 12_000,
  maxDelayMs: 120_000,
  backoffMultiplier: 2,
  jitterRatio: 0.25,
} as const

export type SosMeshRetryConfig = typeof SOS_MESH_RETRY_DEFAULTS

export function sosMeshRetryDelayMs(
  attemptIndex: number,
  cfg: Partial<SosMeshRetryConfig> = {}
): number {
  const initial = cfg.initialDelayMs ?? SOS_MESH_RETRY_DEFAULTS.initialDelayMs
  const maxD = cfg.maxDelayMs ?? SOS_MESH_RETRY_DEFAULTS.maxDelayMs
  const mult = cfg.backoffMultiplier ?? SOS_MESH_RETRY_DEFAULTS.backoffMultiplier
  const jitterR = cfg.jitterRatio ?? SOS_MESH_RETRY_DEFAULTS.jitterRatio

  if (attemptIndex < 0) {
    return initial
  }
  const exp = initial * Math.pow(mult, attemptIndex)
  const capped = Math.min(exp, maxD)
  const jitter = capped * jitterR * (Math.random() * 2 - 1)
  return Math.max(500, Math.round(capped + jitter))
}
