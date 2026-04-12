/**
 * B2: Mesh-SOS-Wiederholung — Backoff + Jitter (Duty-Cycle-freundlich).
 * Kanonisch für Tests/Node; Browser-Kopie: `frontend/frontend/lib/morg-sos-mesh-retry.ts`.
 */

export const SOS_MESH_RETRY_DEFAULTS = {
    /** Inkl. erster Versuch (Loop 0..maxAttempts-1). */
    maxAttempts: 5,
    /** Wartezeit vor dem **zweiten** Versuch (ms). */
    initialDelayMs: 12_000,
    maxDelayMs: 120_000,
    backoffMultiplier: 2,
    /** 0–1: Anteil zufälliger Streuung um die Zielverzögerung. */
    jitterRatio: 0.25,
} as const;

export type SosMeshRetryConfig = typeof SOS_MESH_RETRY_DEFAULTS;

/**
 * Verzögerung vor Versuch `attemptIndex + 1` (nach fehlgeschlagenem Versuch `attemptIndex`).
 * `attemptIndex` 0 → erste Wartezeit nach dem ersten Fehlschlag.
 */
export function sosMeshRetryDelayMs(
    attemptIndex: number,
    cfg: Partial<SosMeshRetryConfig> = {}
): number {
    const initial = cfg.initialDelayMs ?? SOS_MESH_RETRY_DEFAULTS.initialDelayMs;
    const maxD = cfg.maxDelayMs ?? SOS_MESH_RETRY_DEFAULTS.maxDelayMs;
    const mult = cfg.backoffMultiplier ?? SOS_MESH_RETRY_DEFAULTS.backoffMultiplier;
    const jitterR = cfg.jitterRatio ?? SOS_MESH_RETRY_DEFAULTS.jitterRatio;

    if (attemptIndex < 0) {
        return initial;
    }
    const exp = initial * Math.pow(mult, attemptIndex);
    const capped = Math.min(exp, maxD);
    const jitter = capped * jitterR * (Math.random() * 2 - 1);
    return Math.max(500, Math.round(capped + jitter));
}
