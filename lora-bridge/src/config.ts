/**
 * LoRa-Bridge Konfiguration.
 * Alle Werte optional – Simulation läuft ohne Hardware.
 */
import dotenv from 'dotenv';
dotenv.config();

function envInt(key: string, defaultVal: number): number {
    const v = process.env[key];
    if (v === undefined || v === '') return defaultVal;
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? defaultVal : n;
}

function envBool(key: string, defaultVal: boolean): boolean {
    const v = process.env[key];
    if (v === undefined || v === '') return defaultVal;
    return v === 'true' || v === '1' || v === 'yes';
}

export const CFG = {
    /** HTTP-Port der Bridge. Morgendrot setzt STREAMS_BRIDGE_URL=http://localhost:PORT */
    PORT: envInt('LORA_BRIDGE_PORT', 9342),

    /** Simulationsmodus (kein LoRa-Hardware). Default true für Tests. */
    SIMULATION_MODE: envBool('LORA_BRIDGE_SIMULATION', true),

    /** Serial-Port für LoRa (z.B. COM3, /dev/ttyUSB0). Nur wenn SIMULATION_MODE=false */
    LORA_SERIAL_PORT: process.env.LORA_SERIAL_PORT?.trim() || '',

    /** Baudrate für Serial. Default 115200 */
    LORA_BAUD_RATE: envInt('LORA_BAUD_RATE', 115200),

    /** Max. Payload-Größe (Bytes). LoRa typisch 250. Default 240 */
    MAX_PAYLOAD_BYTES: envInt('LORA_MAX_PAYLOAD_BYTES', 240),

    /** CORS: Erlaubte Origins (kommagetrennt). Leer = alle. */
    CORS_ORIGINS: (process.env.LORA_BRIDGE_CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),

    /** Optional: API-Key für POST/GET. Leer = keine Auth. */
    API_KEY: process.env.LORA_BRIDGE_API_KEY?.trim() || '',

    /** Morgendrot-Gateway-URL (z. B. http://192.168.1.10:3342). Wenn gesetzt: empfangene LoRa-Nachrichten werden an POST /api/tiny-message weitergeleitet (HMAC-Prüfung erfolgt im Gateway). */
    MORGENDROT_GATEWAY_URL: process.env.MORGENDROT_GATEWAY_URL?.trim() || '',
};
