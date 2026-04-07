/**
 * Medien-Limits (Klartext-Wire). IOTA/Online vs. Funk/LoRa getrennt.
 * Globale UTF-8-Obergrenze: `MESSAGING_MAX_PLAINTEXT_UTF8_BYTES` in `chain-access.ts` (Default **16000**).
 */

import { extractCompactImageBase64FromWire } from './compact-image-wire-extract.js';

/**
 * `MORG_COMPACT_IMG_V1` Netto-Blob (IOTA / Online).
 * Hart **11800** B — mit UTF-8-Wire ~16 KiB und Move-Pure-Arg kompatibel (Backup-Stand).
 */
export const MESSENGER_COMPACT_IMAGE_BLOB_MAX_BYTES = 11_800;

/** `MORG_AUDIO_V1` Roh-Ogg/Opus bei Versand über IOTA/Mailbox (Wire inkl. Base64 muss unter 16 KiB UTF-8 bleiben). */
export const MESSENGER_IOTA_AUDIO_RAW_MAX_BYTES = 10_752;

/**
 * Roh-Ogg/Opus für Funk/Mesh (eine Nutzlast; Airtime ~8–12 s bei ~6–8 kbit/s).
 * Nicht mit IOTA-Limit verwechseln.
 */
export const MESSENGER_LORA_AUDIO_RAW_MAX_BYTES = 11_264;

/** @deprecated Alias: früher einheitlich ~10 KiB — entspricht jetzt dem IOTA-Audio-Deckel. */
export const MESSENGER_AUDIO_RAW_MAX_BYTES = MESSENGER_IOTA_AUDIO_RAW_MAX_BYTES;

/** @deprecated Nutze MESSENGER_IOTA_AUDIO_RAW_MAX_BYTES oder MESSENGER_LORA_AUDIO_RAW_MAX_BYTES. */
export const MESSENGER_NET_BLOB_MAX_BYTES = MESSENGER_IOTA_AUDIO_RAW_MAX_BYTES;

const MORG_AUDIO_PREFIX = '[[MORG_AUDIO_V1:';
const MORG_AUDIO_SUFFIX = ']]';

function decodedBase64BinaryLength(b64: string): number {
    const s = b64.replace(/\s/g, '');
    if (!s.length) return 0;
    const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((s.length * 3) / 4) - pad);
}

/**
 * Verhindert IOTA-Größenfehler: Kompakt-Bild- und Audio-Blobs dürfen das Netto-Budget nicht sprengen.
 *
 * Kompakt-Bild: nicht nur `startsWith([[MORG_…` — BOM, JSON-Hülle und eingebetteter Wire wie in der UI
 * würden die naive Prüfung umgehen; `extractCompactImageBase64FromWire` spiegelt den Parser.
 */
export function assertMessengerMediaNetBlobWithinLimit(plaintext: string): void {
    const compactB64 = extractCompactImageBase64FromWire(plaintext);
    if (compactB64) {
        const n = decodedBase64BinaryLength(compactB64);
        if (n > MESSENGER_COMPACT_IMAGE_BLOB_MAX_BYTES) {
            throw new Error(
                `Kompakt-Bild-Blob zu groß (${n} B Netto, max. ${MESSENGER_COMPACT_IMAGE_BLOB_MAX_BYTES} B). Bild erneut mit „Bild anhängen“ kodieren.`
            );
        }
    }
    if (plaintext.startsWith(MORG_AUDIO_PREFIX)) {
        const end = plaintext.indexOf(MORG_AUDIO_SUFFIX, MORG_AUDIO_PREFIX.length);
        if (end === -1) return;
        const b64 = plaintext.slice(MORG_AUDIO_PREFIX.length, end);
        const n = decodedBase64BinaryLength(b64);
        if (n > MESSENGER_IOTA_AUDIO_RAW_MAX_BYTES) {
            throw new Error(
                `Audio-Blob zu groß (${n} B Netto, max. ${MESSENGER_IOTA_AUDIO_RAW_MAX_BYTES} B für Online). Für Funk kürzeres Opus (≈≤${MESSENGER_LORA_AUDIO_RAW_MAX_BYTES} B).`
            );
        }
    }
}
