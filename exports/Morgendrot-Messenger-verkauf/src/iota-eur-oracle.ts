/**
 * Euro-Orakel – IOTA/EUR-Kurs für Zahlungs-Trigger und UI (10 € ≈ X IOTA).
 * Siehe docs/INDUSTRY-FEATURES.md. Optional: IOTA_EUR_ORACLE_URL setzen.
 */
import { CFG } from './config.js';

const CACHE_MS = 60_000; // 1 Minute
let cachedRate: number | null = null;
let cachedAt = 0;

/**
 * Liefert den aktuellen Kurs: IOTA pro 1 EUR (z. B. 0.25 = 1 EUR = 0.25 IOTA).
 * Erwartetes API-Format: { "rate": number } oder { "iotaPerEur": number }.
 */
export async function getIotaEurRate(): Promise<number> {
    const url = CFG.IOTA_EUR_ORACLE_URL?.trim();
    if (!url) throw new Error('IOTA_EUR_ORACLE_URL nicht gesetzt');
    const now = Date.now();
    if (cachedRate !== null && now - cachedAt < CACHE_MS) return cachedRate;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Orakel ${res.status}: ${res.statusText}`);
    const data = (await res.json()) as { rate?: number; iotaPerEur?: number };
    const rate = typeof data?.rate === 'number' ? data.rate : typeof data?.iotaPerEur === 'number' ? data.iotaPerEur : null;
    if (rate === null || rate <= 0 || !Number.isFinite(rate)) throw new Error('Ungültiges Orakel-Format (erwarte rate oder iotaPerEur)');
    cachedRate = rate;
    cachedAt = now;
    return rate;
}

/** Rechnet Euro-Betrag in IOTA um (nutzt gecachten Kurs). */
export function eurToIota(eur: number): number {
    if (cachedRate === null || !Number.isFinite(eur) || eur < 0) return 0;
    return eur * cachedRate;
}

/** Gibt den zuletzt gecachten Kurs zurück (oder null). */
export function getCachedIotaEurRate(): number | null {
    return cachedRate;
}
