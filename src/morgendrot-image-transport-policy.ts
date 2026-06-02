/**
 * Morgendrot – Bildtransport: IOTA vs LoRa (Produkt- und Wire-Spez, Implementierung teils offen).
 *
 * ## IOTA / Online
 * - **Nur** `MORG_COMPACT_IMG_V1` (VaultImagePipeline: Luma-WebP + Chroma-PNG in **einem** Blob).
 * - Blob-Ziel **≤ 11800 B Netto** (`MESSENGER_COMPACT_IMAGE_BLOB_MAX_BYTES`); Gesamt-Wire ≤ `MESSAGING_MAX_PLAINTEXT_UTF8_BYTES` (Default **16000**).
 * - Kein LoRa-Zweiteiler (`MORG_LUMA_V1` / `MORG_CHROMA_V1`).
 *
 * ## LoRa / Meshtastic – progressive **heuristische** Vorschau
 * - **Kompromiss (ehrlich):** zwei **JPEGs** (S/W-Luma-ähnlich + winziges Farb-JPEG), **keine** echte YCbCr-Rekonstruktion.
 *   In Low-Bandwidth-Szenarien üblich; Ergebnis ist **Vorschau**, keine garantiert farbmetrisch korrekte Rekonstruktion.
 * - **Fusion (Empfänger):** z. B. `sharp(luma).composite([{ input: chroma, blend: 'over' }])` → nur **heuristisch**;
 *   danach einmal **ersetzen**, keine Animation/Übergang.
 *
 * ### Wire (robustes Parsing)
 * Einheitliches Muster pro Teile-Nachricht (ASCII, kein Whitespace im Payload empfohlen):
 *
 * `[[MORG_LUMA_V1:msgId=<id>|len=<n>|<payload>]]`
 * `[[MORG_CHROMA_V1:msgId=<id>|len=<n>|<payload>]]`
 *
 * - **msgId:** z. B. 8 Zeichen **hex** (`[a-f0-9]{8}`), gleiche ID für Luma+Chroma eines Bildes.
 * - **len:** **Dezimalzahl = Zeichenlänge des unmittelbar folgenden Base64-Strings** (ohne Padding-Zeilenumbüche).
 *   So kann der Parser `payload` per Slice extrahieren, **ohne** Regex-Gier oder `|` in Daten.
 *   (Alternative: `len` = Länge der **dekodierten** JPEG-Bytes – dann nach Decode validieren; eine Variante festlegen und einhalten.)
 * - **payload:** Base64(JPEG-Bytes).
 *
 * Zusätzlich muss die **komplette UTF-8-Zeichenkette** je Nachricht unter `MESSAGING_WIRE_UTF8_MAX` / Mesh-Limits bleiben (Marker + Base64 ist lang).
 *
 * ### Sender-Pipeline (Zielgrößen, iterativ erzwingen)
 * - Normalisierung: max. Breite **480 px**, `lanczos3`, Seitenverhältnis.
 * - **Luma-JPEG:** greyscale, Q Start ~48–52, dann **bis** `≤ LORA_PROGRESSIVE_LUMA_JPEG_MAX_BYTES` (Binärsuche/Steps).
 * - **Chroma-JPEG:** festes Raster sinnvoll (z. B. **exakt 42×32** mit `resize({ width: 42, height: 32, fit: 'cover' })` oder `contain` + definierte Letterbox),
 *   leichter Blur, Q ~28–32, ebenfalls **hart gegen** `LORA_PROGRESSIVE_CHROMA_JPEG_MAX_BYTES` regeln.
 * - **Gesamt:** Roh-JPEG-Summe ≤ `LORA_PROGRESSIVE_JPEG_PAIR_TOTAL_MAX_BYTES` (Ziel 5,5–6,3 KB, hart 6,5 KB).
 *
 * ### Empfänger (funktional)
 * - LUMA ankommen → sofort S/W anzeigen, Text „Farbübertragung läuft…“, Export-Button aktiv.
 * - CHROMA ankommen → einmal farbig ersetzen, Hinweis entfernen.
 * - **Timeout** (z. B. 60 s nach erstem LUMA): „Farbübertragung fehlgeschlagen – S/W-Bild angezeigt“; S/W bleibt speicherbar.
 * - Zwei getrennte Mesh-/Chat-Nachrichten: Reihenfolge, Duplikate und **Teilabbrüche** (nur LUMA) im State führen.
 *
 * ### Smart Input (nur LoRa-Vorbereitung)
 * - Extern vs. eingebaute Kamera: siehe frühere Notizen; Normalisierung **nur** für LoRa-Pfad, nicht für IOTA-Zwang.
 */

/** Geplanter Marker: Phase 1 (S/W-JPEG, scharf). */
export const MORG_LUMA_V1_PREFIX = '[[MORG_LUMA_V1:' as const

/** Geplanter Marker: Phase 2 (kleines Farb-JPEG). */
export const MORG_CHROMA_V1_PREFIX = '[[MORG_CHROMA_V1:' as const

/** Harte Obergrenze Summe Luma+Chroma-JPEG (Rohbytes), „6,5 KB“-Politik. */
export const LORA_PROGRESSIVE_JPEG_PAIR_TOTAL_MAX_BYTES = 6656

/** Zielbereich unten – Encoder soll iterativ darunter bleiben (Kommentar/Ziel, nicht automatisch erzwungen). */
export const LORA_PROGRESSIVE_JPEG_PAIR_TARGET_BYTES_LO = 5632

/** Zielbereich oben (~5,5–6,3 KB). */
export const LORA_PROGRESSIVE_JPEG_PAIR_TARGET_BYTES_HI = 6451

/** Max. Größe Luma-JPEG allein (Rohbytes). */
export const LORA_PROGRESSIVE_LUMA_JPEG_MAX_BYTES = 4096

/** Max. Größe Chroma-JPEG allein (Rohbytes). */
export const LORA_PROGRESSIVE_CHROMA_JPEG_MAX_BYTES = 2560

/**
 * Meshtastic `sendText` / LongFast: Firmware meldet oft „Message longer than 512 bytes“.
 * Gesamte UTF-8-Länge **einer** Textnachricht (ein LUMA- bzw. ein CHROMA-Wire) muss darunter bleiben.
 */
export const MESHTASTIC_LORA_TEXT_WIRE_UTF8_MAX_BYTES = 500

/**
 * § H.25a Flüchtig (LoRa): LUMA+CHROMA als Roh-JPEG, Übertragung per `MORG_SEG_V1` (Chunking).
 * Kein Meshtastic-Einzelwire-Limit — nur Gesamtgröße + Segmentanzahl (Frontend max. 32/Phase).
 */
export const FLUENT_LORA_JPEG_PAIR_TOTAL_MAX_BYTES = 12_000

export const FLUENT_LORA_LUMA_JPEG_MAX_BYTES = 9000

export const FLUENT_LORA_CHROMA_JPEG_MAX_BYTES = 4500
