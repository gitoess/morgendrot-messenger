const JSON_WALK_MAX_DEPTH = 8

function collectStringsContainingMorgMarker(v: unknown, depth: number, acc: string[]): void {
  if (depth > JSON_WALK_MAX_DEPTH) return
  if (typeof v === 'string') {
    if (v.includes('[[MORG_')) acc.push(v)
    return
  }
  if (Array.isArray(v)) {
    for (const x of v) collectStringsContainingMorgMarker(x, depth + 1, acc)
    return
  }
  if (v && typeof v === 'object') {
    for (const x of Object.values(v as Record<string, unknown>)) {
      collectStringsContainingMorgMarker(x, depth + 1, acc)
    }
  }
}

/**
 * Vollständiger Klartext ist manchmal ein JSON-Objekt/Array (Logs, Export, Zwischenablage).
 * `[[MORG_…`-Wire steht dann in einem Unterfeld — wir nehmen den **längsten** passenden String (nicht `text ?? content` mit falschem kurzen Feld).
 * Reiner Wire `[[MORG_…` ist kein gültiges JSON → Parse schlägt fehl, Eingabe bleibt.
 */
function unwrapJsonEnvelopeIfPlaintextIsJson(s: string): string {
  const t = s.trim()
  if (!t.startsWith('{') && !t.startsWith('[')) return s
  try {
    const parsed: unknown = JSON.parse(t)
    const acc: string[] = []
    collectStringsContainingMorgMarker(parsed, 0, acc)
    if (acc.length === 0) return s
    acc.sort((a, b) => b.length - a.length)
    return acc[0]!
  } catch {
    return s
  }
}

/** BOM / führende Leerzeichen entfernen – API/Chain können den Wire-String trimmen oder BOM mitschicken.
 *  Volle Breite ［］： und Zero-Width-Zeichen können sonst den Marker „nicht finden“ oder Base64 zerstückeln.
 *  JSON-Wrapper mit eingebettetem MORG-Wire werden entpackt; danach optional äußeres JSON-String-Literal (`"[[MORG_…]]"`). */
export function normalizeMessengerWireContent(s: string): string {
  if (s == null || typeof s !== 'string') return ''
  let t = unwrapJsonEnvelopeIfPlaintextIsJson(s.trim())
  if (t.startsWith('"') && t.endsWith('"')) {
    try {
      const once = JSON.parse(t) as unknown
      if (typeof once === 'string') t = once
    } catch {
      /* ignore */
    }
  }
  t = unwrapJsonEnvelopeIfPlaintextIsJson(t)
  return t
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
    .replace(/\u00AD/g, '')
    .replace(/\uFF3B/g, '[')
    .replace(/\uFF3D/g, ']')
    .replace(/\uFF1A/g, ':')
    .trimStart()
}

/**
 * **IOTA / Online:** `MORG_COMPACT_IMG_V1` – ein Blob (Luma-WebP + Chroma-PNG), lokal via `encodeIotaCompactAutark` (Relay optional).
 * **Funk / LoRa:** `MORG_LUMA_V1` + `MORG_CHROMA_V1` (zwei JPEGs, hart ≤ 12 KB Summe) – Kodierung lokal via `ImageEncodePort` / `@morgendrot/core/image` (Relay optional).
 *
 * Kompaktbild-Netto: `MEDIA_COMPACT_IMAGE_BLOB_MAX_BYTES` (Backend `MESSENGER_COMPACT_IMAGE_BLOB_MAX_BYTES`).
 * Audio: Online `MEDIA_IOTA_AUDIO_RAW_MAX_BYTES`, Funk `MEDIA_LORA_AUDIO_RAW_MAX_BYTES`.
 */
export const COMPACT_IMG_PREFIX = '[[MORG_COMPACT_IMG_V1:'
export const COMPACT_IMG_SUFFIX = ']]'

/** Netto-Bytes im `MORG_COMPACT_IMG_V1`-Blob (vor Base64); mit Backend `MESSENGER_COMPACT_IMAGE_BLOB_MAX_BYTES` abgleichen. */
export const MEDIA_COMPACT_IMAGE_BLOB_MAX_BYTES = 11_800

/** UTF-8-Text (.txt) als Base64(UTF-8-Bytes) im Nachrichten-String (Move-/Messenger-Limit beachten). */
export const COMPACT_TXT_PREFIX = '[[MORG_TXT_V1:'
export const COMPACT_TXT_SUFFIX = ']]'

/** .txt als „Datei“ mit Namen: innen Base64(JSON { n, b }) mit b = Base64(UTF-8-Bytes). */
export const COMPACT_FILE_TXT_PREFIX = '[[MORG_FILE_TXT_V1:'
export const COMPACT_FILE_TXT_SUFFIX = ']]'

/** Wie Backend `MESSAGING_MAX_PLAINTEXT_UTF8_BYTES` (Default **16000**). */
export const MESSAGING_WIRE_UTF8_MAX = 16_000

/**
 * Meshtastic `sendText` / LongFast: Firmware meldet oft „Message longer than 512 bytes“.
 * Muss mit Backend `MESHTASTIC_LORA_TEXT_WIRE_UTF8_MAX_BYTES` übereinstimmen.
 */
export const MESHTASTIC_LORA_TEXT_WIRE_UTF8_MAX_BYTES = 500

/** Opus/Ogg-Rohdaten für IOTA/Mailbox (`MORG_AUDIO_V1`). */
export const MEDIA_IOTA_AUDIO_RAW_MAX_BYTES = 10_752

/** Opus/Ogg-Rohdaten für Funk/Mesh (kurze Sprachclips). */
export const MEDIA_LORA_AUDIO_RAW_MAX_BYTES = 11_264

/**
 * @deprecated Nutze `MEDIA_IOTA_AUDIO_RAW_MAX_BYTES` oder `MEDIA_LORA_AUDIO_RAW_MAX_BYTES` je Transport.
 * Steht auf IOTA-Deckel, damit bestehende Checks/Tooltips Online-Verhalten behalten.
 */
export const MEDIA_BINARY_NET_MAX_BYTES = MEDIA_IOTA_AUDIO_RAW_MAX_BYTES

function uint8ToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin)
}

function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s/g, ''))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function wireUtf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length
}

export function wrapCompactImageMessage(blobBase64: string, caption?: string): string {
  const core = COMPACT_IMG_PREFIX + blobBase64 + COMPACT_IMG_SUFFIX
  return caption?.trim() ? `${core}\n\n${caption.trim()}` : core
}

/** Nur BOM/ZWSP/Vollbreite-Klammern — kein JSON-Unwrap (der kann bei mehreren `[[MORG_`-Strings den falschen „längsten“ Treffer wählen). */
function lightNormalizeMessengerWireContent(s: string): string {
  if (s == null || typeof s !== 'string') return ''
  return s
    .trim()
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
    .replace(/\u00AD/g, '')
    .replace(/\uFF3B/g, '[')
    .replace(/\uFF3D/g, ']')
    .replace(/\uFF1A/g, ':')
    .trimStart()
}

function parseCompactImageCore(normalized: string): { blobBase64: string; caption?: string } | null {
  const P = COMPACT_IMG_PREFIX
  const S = COMPACT_IMG_SUFFIX
  const anchor = normalized.indexOf(P)
  if (anchor === -1) return null
  const head = normalized.slice(anchor)
  const end = head.indexOf(S, P.length)
  if (end === -1) return null
  const blobBase64 = head.slice(P.length, end).replace(/\s/g, '')
  if (!blobBase64.length) return null
  const tail = head.slice(end + S.length).trim()
  return { blobBase64, caption: tail || undefined }
}

function collectMorgWireStringsFromJsonEnvelope(s: string): string[] {
  const t = s.trim()
  if (!t.startsWith('{') && !t.startsWith('[')) return []
  try {
    const parsed: unknown = JSON.parse(t)
    const acc: string[] = []
    collectStringsContainingMorgMarker(parsed, 0, acc)
    return acc
  } catch {
    return []
  }
}

function pushUnique(out: string[], seen: Set<string>, chunk: string): void {
  const t = chunk.trim()
  if (!t.length || seen.has(t)) return
  seen.add(t)
  out.push(t)
}

/** Roh-String + JSON-Unterstrings + optional Slice ab letztem `[[` vor dem Bild-Marker. */
function compactImageWireCandidates(rawInput: string): string[] {
  const raw = String(rawInput ?? '').trim()
  const seen = new Set<string>()
  const out: string[] = []
  pushUnique(out, seen, raw)
  for (const inner of collectMorgWireStringsFromJsonEnvelope(raw)) {
    pushUnique(out, seen, inner)
  }
  const needle = 'MORG_COMPACT_IMG_V1:'
  const ix = raw.indexOf(needle)
  if (ix !== -1) {
    const start = raw.lastIndexOf('[[', ix)
    if (start >= 0) pushUnique(out, seen, raw.slice(start))
  }
  out.sort((a, b) => b.length - a.length)
  return out
}

function tryParseCompactImageFromCandidate(candidate: string): { blobBase64: string; caption?: string } | null {
  const variants = [
    normalizeMessengerWireContent(candidate),
    lightNormalizeMessengerWireContent(candidate),
    candidate.trim(),
  ]
  const tried = new Set<string>()
  for (const v of variants) {
    if (!v.trim() || tried.has(v)) continue
    tried.add(v)
    const r = parseCompactImageCore(v)
    if (r) return r
  }
  return null
}

export function parseCompactImageMessage(content: string): { blobBase64: string; caption?: string } | null {
  for (const cand of compactImageWireCandidates(content)) {
    const r = tryParseCompactImageFromCandidate(cand)
    if (r) return r
  }
  return null
}

export function wrapCompactTextMessage(utf8Text: string, caption?: string): string {
  const b64 = uint8ToBase64(new TextEncoder().encode(utf8Text))
  const core = COMPACT_TXT_PREFIX + b64 + COMPACT_TXT_SUFFIX
  return caption?.trim() ? `${core}\n\n${caption.trim()}` : core
}

export function parseCompactTextMessage(content: string): { text: string; caption?: string } | null {
  const normalized = normalizeMessengerWireContent(content)
  const anchor = normalized.indexOf(COMPACT_TXT_PREFIX)
  if (anchor === -1) return null
  const tail = normalized.slice(anchor)
  const end = tail.indexOf(COMPACT_TXT_SUFFIX, COMPACT_TXT_PREFIX.length)
  if (end === -1) return null
  const b64 = tail.slice(COMPACT_TXT_PREFIX.length, end).replace(/\s/g, '')
  const tailCap = tail.slice(end + COMPACT_TXT_SUFFIX.length).trim()
  try {
    const text = new TextDecoder().decode(base64ToUint8(b64))
    return { text, caption: tailCap || undefined }
  } catch {
    return null
  }
}

const MAX_FILE_NAME_LEN = 200

export function sanitizeTxtFileName(name: string): string {
  const base = String(name || 'datei.txt').replace(/[/\\]/g, '_').replace(/[\x00-\x1f\x7f]/g, '').trim()
  const n = base || 'datei.txt'
  return n.length > MAX_FILE_NAME_LEN ? n.slice(0, MAX_FILE_NAME_LEN) : n
}

/** .txt-Anhang mit Dateiname (Empfänger: Download statt Volltext in der Blase). */
export function wrapFileTxtMessage(fileName: string, utf8Text: string, caption?: string): string {
  const n = sanitizeTxtFileName(fileName)
  const b = uint8ToBase64(new TextEncoder().encode(utf8Text))
  const inner = JSON.stringify({ n, b })
  const outer = uint8ToBase64(new TextEncoder().encode(inner))
  const core = COMPACT_FILE_TXT_PREFIX + outer + COMPACT_FILE_TXT_SUFFIX
  const cap = caption?.trim()
  return cap ? `${core}\n\n${cap}` : core
}

export function parseFileTxtMessage(content: string): { fileName: string; text: string; caption?: string } | null {
  const normalized = normalizeMessengerWireContent(content)
  const anchor = normalized.indexOf(COMPACT_FILE_TXT_PREFIX)
  if (anchor === -1) return null
  const tail = normalized.slice(anchor)
  const end = tail.indexOf(COMPACT_FILE_TXT_SUFFIX, COMPACT_FILE_TXT_PREFIX.length)
  if (end === -1) return null
  const outerB64 = tail.slice(COMPACT_FILE_TXT_PREFIX.length, end).replace(/\s/g, '')
  const tailCap = tail.slice(end + COMPACT_FILE_TXT_SUFFIX.length).trim()
  try {
    const innerJson = new TextDecoder().decode(base64ToUint8(outerB64))
    const o = JSON.parse(innerJson) as { n?: string; b?: string }
    if (typeof o?.b !== 'string' || typeof o?.n !== 'string') return null
    const text = new TextDecoder().decode(base64ToUint8(o.b))
    return { fileName: sanitizeTxtFileName(o.n), text, caption: tailCap || undefined }
  } catch {
    return null
  }
}

/** Opus (typisch Ogg-Container) als Base64 im Klartext-Wire – Browser: Decoding per HTMLMediaElement, nur nach Nutzerklick. */
export const MORG_AUDIO_V1_PREFIX = '[[MORG_AUDIO_V1:'
export const MORG_AUDIO_V1_SUFFIX = ']]'

/**
 * Opus-Wire: Base64 wächst ~4/3; Gesamt UTF-8 ≤ `MESSAGING_WIRE_UTF8_MAX`.
 * Theoretische Dauer ≈ `maxRawBytes / (bitrate_bps/8)` — Online z. B. `MEDIA_IOTA_AUDIO_RAW_MAX_BYTES`, Funk `MEDIA_LORA_AUDIO_RAW_MAX_BYTES`.
 */
/** Empfohlene Opus-Zielbitrate (Bit/s) für L1-Wire: 8 kHz Mono, Encoder-Skript-Default. */
export const MEDIA_OPUS_BITRATE_BPS_RECOMMENDED = 8000

/** Alternative etwas sparsamer (längere max. Dauer bei gleichem Netto-Deckel). */
export const MEDIA_OPUS_BITRATE_BPS_ALT = 6000

/** Obere Grenze für nutzbare Sprachdauer bei gegebener Bitrate und vollem Netto-Budget (Theorie). */
export function estimateMaxOpusSecondsAtBitrateBps(
  bitrateBps: number,
  maxRawBytes: number = MEDIA_IOTA_AUDIO_RAW_MAX_BYTES
): number {
  if (!(bitrateBps > 0)) return 0
  const bytesPerSec = bitrateBps / 8
  return maxRawBytes / bytesPerSec
}

export function decodedBase64BinaryLength(b64: string): number {
  const s = b64.replace(/\s/g, '')
  if (!s.length) return 0
  const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((s.length * 3) / 4) - pad)
}

export function wrapMorgAudioV1Message(blobBase64: string, caption?: string): string {
  const core = MORG_AUDIO_V1_PREFIX + blobBase64.replace(/\s/g, '') + MORG_AUDIO_V1_SUFFIX
  const cap = caption?.trim()
  return cap ? `${core}\n\n${cap}` : core
}

function parseMorgAudioCore(normalized: string): { blobBase64: string; caption?: string } | null {
  const P = MORG_AUDIO_V1_PREFIX
  const S = MORG_AUDIO_V1_SUFFIX
  const anchor = normalized.indexOf(P)
  if (anchor === -1) return null
  const head = normalized.slice(anchor)
  const end = head.indexOf(S, P.length)
  if (end === -1) return null
  const blobBase64 = head.slice(P.length, end).replace(/\s/g, '')
  if (!blobBase64.length) return null
  const tail = head.slice(end + S.length).trim()
  return { blobBase64, caption: tail || undefined }
}

function morgAudioWireCandidates(rawInput: string): string[] {
  const raw = String(rawInput ?? '').trim()
  const seen = new Set<string>()
  const out: string[] = []
  pushUnique(out, seen, raw)
  for (const inner of collectMorgWireStringsFromJsonEnvelope(raw)) {
    pushUnique(out, seen, inner)
  }
  const needle = 'MORG_AUDIO_V1:'
  const ix = raw.indexOf(needle)
  if (ix !== -1) {
    const start = raw.lastIndexOf('[[', ix)
    if (start >= 0) pushUnique(out, seen, raw.slice(start))
  }
  out.sort((a, b) => b.length - a.length)
  return out
}

function tryParseMorgAudioFromCandidate(candidate: string): { blobBase64: string; caption?: string } | null {
  const variants = [
    normalizeMessengerWireContent(candidate),
    lightNormalizeMessengerWireContent(candidate),
    candidate.trim(),
  ]
  const tried = new Set<string>()
  for (const v of variants) {
    if (!v.trim() || tried.has(v)) continue
    tried.add(v)
    const r = parseMorgAudioCore(v)
    if (r) return r
  }
  return null
}

export function parseMorgAudioV1Message(content: string): { blobBase64: string; caption?: string } | null {
  for (const cand of morgAudioWireCandidates(content)) {
    const r = tryParseMorgAudioFromCandidate(cand)
    if (r) return r
  }
  return null
}

export type MorgAudioWireLimitsOpts = {
  maxRawBinaryBytes?: number
  maxWireUtf8Bytes?: number
}

/** Prüft Netto-Bytes (dekodiertes Blob) und UTF-8-Länge des gesamten Wire-Strings. */
export function morgAudioWirePassesLimits(
  wire: string,
  opts?: MorgAudioWireLimitsOpts
): { ok: true } | { ok: false; reason: string } {
  const maxRaw = opts?.maxRawBinaryBytes ?? MEDIA_IOTA_AUDIO_RAW_MAX_BYTES
  const maxUtf8 = opts?.maxWireUtf8Bytes ?? MESSAGING_WIRE_UTF8_MAX
  const p = parseMorgAudioV1Message(wire)
  if (!p) return { ok: false, reason: 'Kein gültiges MORG_AUDIO_V1-Wire.' }
  const n = decodedBase64BinaryLength(p.blobBase64)
  if (n > maxRaw) {
    return {
      ok: false,
      reason: `Opus/Ogg-Rohdaten zu groß (${n} B, max. ${maxRaw} B für diesen Sendepfad).`,
    }
  }
  if (wireUtf8ByteLength(wire) > maxUtf8) {
    return { ok: false, reason: `Gesamt-Wire zu lang (>${maxUtf8} Byte UTF-8).` }
  }
  return { ok: true }
}
