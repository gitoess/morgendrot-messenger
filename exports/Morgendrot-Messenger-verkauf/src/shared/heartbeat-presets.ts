/**
 * Heartbeat-Intervall: nur diskrete Presets (UI + Server), kein freies ms-Feld –
 * verhindert Akku-/Gas-Fallen durch extrem kurze Intervalle.
 *
 * Kurz (Min): häufiger Puls / Gefahrenlage. Lang (Std): Akku schonen, Basis-Check reicht.
 */
export const HEARTBEAT_INTERVAL_PRESETS_MS = [
    60_000, 300_000, 900_000, 1_800_000, 3_600_000,
    7_200_000, 14_400_000, 21_600_000, 43_200_000, 86_400_000,
] as const

export type HeartbeatPresetMs = (typeof HEARTBEAT_INTERVAL_PRESETS_MS)[number]

const PRESET_SET = new Set<number>(HEARTBEAT_INTERVAL_PRESETS_MS)

export function isAllowedHeartbeatIntervalMs(ms: number): boolean {
    return Number.isFinite(ms) && PRESET_SET.has(ms)
}

/** Mindestens 1 Minute (kleinstes Preset). */
export const HEARTBEAT_INTERVAL_MIN_MS = HEARTBEAT_INTERVAL_PRESETS_MS[0]
