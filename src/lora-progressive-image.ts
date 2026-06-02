/**
 * LoRa progressive Bild – **Höhlenrettung / Notfall**: Phase 1 (S/W) zuerst, Phase 2 (Farbe) optional.
 * Kein IOTA: nur für Meshtastic/Mesh-Klartext nach `prepareImageForLoRa`.
 *
 * ## Wire-Format (ein Wire = eine UTF-8-Zeichenkette, ein Paket pro Phase bis Chunking existiert)
 *
 * ```
 * [[MORG_LUMA_V1:msgId=<8 hex>|len=<n>|<base64>]]
 * [[MORG_CHROMA_V1:msgId=<8 hex>|len=<n>|<base64>]]
 * ```
 *
 * - `msgId`: 8 Zeichen `[a-f0-9]{8}` (ein Wert für Luma+Chroma eines Bildes).
 * - `len`: Dezimalzahl = **Anzahl der Base64-Zeichen** des Payloads (ohne Zeilenumbrüche), nicht Byte-Länge.
 * - `<base64>`: Standard-Base64 der JPEG-Rohbytes, exakt `len` Zeichen; danach sofort `]]`.
 *
 * Heuristik Empfänger: zwei JPEGs + Fusion (sharp composite oder Canvas `color`). Chunking/NACK: Firmware/anderes Modul.
 */
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { MESSAGING_MAX_PLAINTEXT_UTF8_BYTES } from './chain-access.js';
import {
    FLUENT_LORA_CHROMA_JPEG_MAX_BYTES,
    FLUENT_LORA_JPEG_PAIR_TOTAL_MAX_BYTES,
    FLUENT_LORA_LUMA_JPEG_MAX_BYTES,
    LORA_PROGRESSIVE_CHROMA_JPEG_MAX_BYTES,
    LORA_PROGRESSIVE_JPEG_PAIR_TOTAL_MAX_BYTES,
    LORA_PROGRESSIVE_LUMA_JPEG_MAX_BYTES,
    MESHTASTIC_LORA_TEXT_WIRE_UTF8_MAX_BYTES,
    MORG_CHROMA_V1_PREFIX,
    MORG_LUMA_V1_PREFIX,
} from './morgendrot-image-transport-policy.js';

export type LoRaProgressivePrepareResult = {
    messageId: string;
    lumaWire: string;
    chromaWire: string;
    lumaJpegBytes: number;
    chromaJpegBytes: number;
    lumaWireUtf8Bytes: number;
    chromaWireUtf8Bytes: number;
};

function utf8Len(s: string): number {
    return Buffer.byteLength(s, 'utf8');
}

function newMessageId(): string {
    return randomBytes(4).toString('hex');
}

export function buildLoraLumaWire(messageId: string, jpeg: Buffer): string {
    const b64 = jpeg.toString('base64');
    return `${MORG_LUMA_V1_PREFIX}msgId=${messageId}|len=${b64.length}|${b64}]]`;
}

export function buildLoraChromaWire(messageId: string, jpeg: Buffer): string {
    const b64 = jpeg.toString('base64');
    return `${MORG_CHROMA_V1_PREFIX}msgId=${messageId}|len=${b64.length}|${b64}]]`;
}

export type ParsedLoraWire =
    | { kind: 'luma'; msgId: string; jpeg: Buffer }
    | { kind: 'chroma'; msgId: string; jpeg: Buffer };

/**
 * `len` = Zeichenlänge des Base64-Payloads (ohne Whitespace), danach exakt `]]`.
 */
export function parseLoraProgressiveWire(wire: string): ParsedLoraWire | null {
    const w = wire.trim();
    const tryOne = (prefix: string, kind: 'luma' | 'chroma'): ParsedLoraWire | null => {
        if (!w.startsWith(prefix)) return null;
        const s = w.slice(prefix.length);
        const re = /^msgId=([a-f0-9]{8})\|len=(\d+)\|/;
        const m = re.exec(s);
        if (!m) return null;
        const msgId = m[1]!;
        const len = parseInt(m[2]!, 10);
        if (!Number.isFinite(len) || len < 1 || len > 20_000_000) return null;
        const payloadStart = m[0].length;
        const payload = s.slice(payloadStart, payloadStart + len);
        if (payload.length !== len) return null;
        const tail = s.slice(payloadStart + len);
        if (tail !== ']]') return null;
        let jpeg: Buffer;
        try {
            jpeg = Buffer.from(payload, 'base64');
        } catch {
            return null;
        }
        if (jpeg.length < 16) return null;
        return { kind, msgId, jpeg };
    };
    return tryOne(MORG_LUMA_V1_PREFIX, 'luma') ?? tryOne(MORG_CHROMA_V1_PREFIX, 'chroma');
}

/** Eine Mesh-Textnachricht = ein Wire; Meshtastic bricht bei typ. >512 B UTF-8 ab. */
function assertMeshtasticTextWireLimit(wire: string, label: string): void {
    const n = utf8Len(wire);
    if (n > MESHTASTIC_LORA_TEXT_WIRE_UTF8_MAX_BYTES) {
        throw new Error(
            `${label}: Wire ${n} B UTF-8 > Meshtastic-Text-Limit ${MESHTASTIC_LORA_TEXT_WIRE_UTF8_MAX_BYTES} B – Bild verkleinern oder Chunking (Roadmap).`
        );
    }
}

function assertMailboxWireLimit(wire: string, label: string): void {
    const n = utf8Len(wire);
    if (n > MESSAGING_MAX_PLAINTEXT_UTF8_BYTES) {
        throw new Error(
            `${label}: Wire ${n} B UTF-8 > Messenger-Limit ${MESSAGING_MAX_PLAINTEXT_UTF8_BYTES} B – Bild zu komplex oder Encoder anpassen.`
        );
    }
}

/**
 * **Nur Funk / LoRa:** zwei JPEGs (S/W-Luma + kleine Farb-Map), strikt gegen `LORA_PROGRESSIVE_*`-Budgets.
 * Kein `MORG_COMPACT_IMG_V1` – völlig getrennt von der IOTA-Pipeline.
 */
export async function prepareImageForLoRa(originalBuffer: Buffer): Promise<LoRaProgressivePrepareResult> {
    /** Viele Smartphone-JPEGs/PNG: `failOn: 'none'` verhindert unnötige 500er bei leicht korruptem EXIF. */
    const normalized = await sharp(originalBuffer, { failOn: 'none' })
        .rotate()
        .resize({ width: 480, fit: 'inside', withoutEnlargement: true, kernel: sharp.kernel.lanczos3 })
        .toBuffer();

    const layouts: { w: number; h: number; blur: number }[] = [
        { w: 42, h: 32, blur: 1.8 },
        { w: 36, h: 28, blur: 1.6 },
        { w: 32, h: 24, blur: 1.4 },
        { w: 28, h: 21, blur: 1.2 },
        { w: 24, h: 18, blur: 1.0 },
        { w: 20, h: 15, blur: 0.9 },
        { w: 18, h: 14, blur: 0.85 },
        { w: 16, h: 12, blur: 0.8 },
    ];
    /** S/W-Phase: Breite runter, bis Base64+Marker in ein Meshtastic-Textpaket (~512 B) passt. */
    const lumaWidths = [480, 360, 300, 240, 200, 160, 128, 104, 88, 72, 64, 56, 48] as const;
    const lumaQs = [50, 46, 42, 38, 34, 30, 28, 26, 24, 22, 20, 18, 16];
    const chromaQs = [32, 28, 26, 24, 22, 20, 18, 16, 14];

    for (const lumaW of lumaWidths) {
        const lumaSource = await sharp(normalized, { failOn: 'none' })
            .resize({ width: lumaW, fit: 'inside', withoutEnlargement: true })
            .toBuffer();
        for (const { w, h, blur } of layouts) {
            for (const lumaQ of lumaQs) {
                const luma = await sharp(lumaSource, { failOn: 'none' })
                    .greyscale()
                    .jpeg({ quality: lumaQ, mozjpeg: true })
                    .toBuffer();
                if (luma.length > LORA_PROGRESSIVE_LUMA_JPEG_MAX_BYTES) continue;
                for (const chromaQ of chromaQs) {
                    const chroma = await sharp(normalized, { failOn: 'none' })
                        .resize(w, h, { fit: 'cover' })
                        .blur(blur)
                        .jpeg({ quality: chromaQ, mozjpeg: true })
                        .toBuffer();
                    if (chroma.length > LORA_PROGRESSIVE_CHROMA_JPEG_MAX_BYTES) continue;
                    if (luma.length + chroma.length > LORA_PROGRESSIVE_JPEG_PAIR_TOTAL_MAX_BYTES) continue;

                    const messageId = newMessageId();
                    const lumaWire = buildLoraLumaWire(messageId, luma);
                    const chromaWire = buildLoraChromaWire(messageId, chroma);
                    try {
                        assertMeshtasticTextWireLimit(lumaWire, 'LoRa Luma-Wire');
                        assertMeshtasticTextWireLimit(chromaWire, 'LoRa Chroma-Wire');
                        assertMailboxWireLimit(lumaWire, 'LoRa Luma-Wire');
                        assertMailboxWireLimit(chromaWire, 'LoRa Chroma-Wire');
                    } catch {
                        continue;
                    }
                    return {
                        messageId,
                        lumaWire,
                        chromaWire,
                        lumaJpegBytes: luma.length,
                        chromaJpegBytes: chroma.length,
                        lumaWireUtf8Bytes: utf8Len(lumaWire),
                        chromaWireUtf8Bytes: utf8Len(chromaWire),
                    };
                }
            }
        }
    }

    throw new Error(
        'LoRa: Kein JPEG-Paar passt unter Meshtastic-Textlimit (~512 B UTF-8 pro LUMA/CHROMA-Wire). Anderes Motiv wählen oder später Chunking (Roadmap).'
    );
}

const LORA_ROBUST_DIMS = [480, 420, 360, 300, 240, 200, 160, 128, 104, 88] as const;

const FLUENT_ROBUST_DIMS = [1280, 1024, 896, 768, 640, 560, 480, 400, 320, 256] as const;

export type PrepareImageForLoRaFluentOpts = {
    maxTotalBytes?: number;
};

/**
 * **Flüchtig (LoRa) / § H.25a:** LUMA+CHROMA bis `maxTotalBytes` (Default 12 KB), **ohne** Monolith-Wire-Limit.
 * Client segmentiert mit `MORG_SEG_V1`; Wires dürfen > 500 B UTF-8 sein.
 */
export async function prepareImageForLoRaFluent(
    originalBuffer: Buffer,
    opts: PrepareImageForLoRaFluentOpts = {}
): Promise<LoRaProgressivePrepareResult> {
    const pairMax = Math.min(
        Math.max(2048, opts.maxTotalBytes ?? FLUENT_LORA_JPEG_PAIR_TOTAL_MAX_BYTES),
        FLUENT_LORA_JPEG_PAIR_TOTAL_MAX_BYTES
    );
    const lumaMax = Math.min(FLUENT_LORA_LUMA_JPEG_MAX_BYTES, Math.floor(pairMax * 0.72));
    const chromaMax = Math.min(FLUENT_LORA_CHROMA_JPEG_MAX_BYTES, pairMax - 512);

    const normalized = await sharp(originalBuffer, { failOn: 'none' })
        .rotate()
        .resize({ width: 640, fit: 'inside', withoutEnlargement: true, kernel: sharp.kernel.lanczos3 })
        .toBuffer();

    const layouts: { w: number; h: number; blur: number }[] = [
        { w: 64, h: 48, blur: 1.4 },
        { w: 56, h: 42, blur: 1.2 },
        { w: 48, h: 36, blur: 1.0 },
        { w: 42, h: 32, blur: 0.9 },
        { w: 36, h: 28, blur: 0.85 },
        { w: 32, h: 24, blur: 0.8 },
    ];
    const lumaWidths = [640, 560, 480, 400, 360, 320, 280, 240, 200, 168, 144, 128] as const;
    const lumaQs = [62, 58, 54, 50, 46, 42, 38, 34, 30, 28, 26, 24, 22, 20, 18];
    const chromaQs = [42, 38, 36, 34, 32, 30, 28, 26, 24, 22, 20, 18];

    for (const lumaW of lumaWidths) {
        const lumaSource = await sharp(normalized, { failOn: 'none' })
            .resize({ width: lumaW, fit: 'inside', withoutEnlargement: true })
            .toBuffer();
        for (const { w, h, blur } of layouts) {
            for (const lumaQ of lumaQs) {
                const luma = await sharp(lumaSource, { failOn: 'none' })
                    .greyscale()
                    .jpeg({ quality: lumaQ, mozjpeg: true })
                    .toBuffer();
                if (luma.length > lumaMax) continue;
                for (const chromaQ of chromaQs) {
                    const chroma = await sharp(normalized, { failOn: 'none' })
                        .resize(w, h, { fit: 'cover' })
                        .blur(blur)
                        .jpeg({ quality: chromaQ, mozjpeg: true })
                        .toBuffer();
                    if (chroma.length > chromaMax) continue;
                    if (luma.length + chroma.length > pairMax) continue;

                    const messageId = newMessageId();
                    const lumaWire = buildLoraLumaWire(messageId, luma);
                    const chromaWire = buildLoraChromaWire(messageId, chroma);
                    return {
                        messageId,
                        lumaWire,
                        chromaWire,
                        lumaJpegBytes: luma.length,
                        chromaJpegBytes: chroma.length,
                        lumaWireUtf8Bytes: utf8Len(lumaWire),
                        chromaWireUtf8Bytes: utf8Len(chromaWire),
                    };
                }
            }
        }
    }

    throw new Error(
        `LoRa (Flüchtig): Kein JPEG-Paar unter ${Math.round(pairMax / 1024)} KB Gesamtgröße — anderes Motiv oder kürzeres Seitenverhältnis.`
    );
}

/**
 * Wie `prepareImageForLoRaFluent`, mit schrittweise kleinerem Eingangs-Raster (wie IOTA `encodeToPlaintextBlobFitChain`).
 */
export async function prepareImageForLoRaFluentRobust(
    originalBuffer: Buffer,
    opts: PrepareImageForLoRaFluentOpts = {}
): Promise<LoRaProgressivePrepareResult> {
    let lastErr = new Error(
        `LoRa (Flüchtig): Bild passt nicht unter ${Math.round((opts.maxTotalBytes ?? FLUENT_LORA_JPEG_PAIR_TOTAL_MAX_BYTES) / 1024)} KB nach Kompression.`
    );
    for (const dim of FLUENT_ROBUST_DIMS) {
        try {
            const scaled = await sharp(originalBuffer, { failOn: 'none' })
                .rotate()
                .resize({ width: dim, height: dim, fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 88, mozjpeg: true })
                .toBuffer();
            return await prepareImageForLoRaFluent(scaled, opts);
        } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            if (/JPEG-Paar|passt nicht unter|Flüchtig/i.test(m)) {
                lastErr = e instanceof Error ? e : new Error(m);
                continue;
            }
            throw e instanceof Error ? e : new Error(String(e));
        }
    }
    throw lastErr;
}

/**
 * Wie `prepareImageForLoRa`, aber bei „passt nicht unter Funk-Limits“ oder Wire-Deckel
 * schrittweise kleinere Eingangs-Raster (JPEG), bis ein LUMA+CHROMA-Paar passt (Kompakt-Bild → Funk).
 */
export async function prepareImageForLoRaRobust(originalBuffer: Buffer): Promise<LoRaProgressivePrepareResult> {
    let lastErr = new Error(
        'LoRa: JPEG-Paar passt nicht unter Funk-Limits (Summe ≤ 6,5 KiB, Luma/Chroma je Phase). Anderes Motiv oder kleinere Vorlage.'
    );
    for (const dim of LORA_ROBUST_DIMS) {
        try {
            const scaled = await sharp(originalBuffer, { failOn: 'none' })
                .rotate()
                .resize({ width: dim, height: dim, fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 88, mozjpeg: true })
                .toBuffer();
            return await prepareImageForLoRa(scaled);
        } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            if (/JPEG-Paar|Wire.*Limit|passt nicht unter|Messenger-Limit|Meshtastic-Text-Limit/i.test(m)) {
                lastErr = e instanceof Error ? e : new Error(m);
                continue;
            }
            throw e instanceof Error ? e : new Error(String(e));
        }
    }
    throw lastErr;
}

/** Serverseitige Fusion (heuristisch, sharp `over`) – z. B. Tests oder Preview-API. */
export async function fuseLoraProgressiveJpegsSharp(lumaJpeg: Buffer, chromaJpeg: Buffer): Promise<Buffer> {
    const meta = await sharp(lumaJpeg).metadata();
    const w = meta.width ?? 480;
    const h = meta.height ?? 360;
    const chromaLayer = await sharp(chromaJpeg).resize(w, h, { fit: 'cover' }).ensureAlpha().png().toBuffer();
    return sharp(lumaJpeg).composite([{ input: chromaLayer, blend: 'over' }]).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}
