#!/usr/bin/env node
/**
 * No-AI Audio-Pipeline für MORG_AUDIO_V1 (Radxa/PC mit FFmpeg im PATH).
 *
 * - silenceremove nur mit MORG_OPUS_USE_SILENCE_REMOVE=1 (sonst aus – weniger „alles weg-VAD“)
 * - 8 kHz Mono, libopus; Standard 8 kbit/s (Wire-sparsam; 6k–8k sinnvoll, 12k bei Bedarf per Env)
 *
 * Nutzung:
 *   node scripts/encode-opus-messenger.mjs eingang.wav [ausgang.opus]
 *
 * Env:
 *   MORG_OPUS_BITRATE=6k|8k|12k|4.5k  (ffmpeg -b:a; Default 8k)
 *   MORG_OPUS_USE_SILENCE_REMOVE=1  (ffmpeg silenceremove – aggressiv, nur wenn gewollt)
 *
 * Anschließend Base64 des .opus in den Messenger-Wire packen; Rohgröße ≤ MEDIA_IOTA_AUDIO_RAW_MAX_BYTES
 * (compact-image-wire.ts, z. B. 10752) und UTF-8-Gesamt ≤ MESSAGING_WIRE_UTF8_MAX prüfen.
 * Für Funk kürzeres Opus (≈11 KiB) — siehe MEDIA_LORA_AUDIO_RAW_MAX_BYTES.
 */

import { spawnSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { resolveFfmpegExecutable } from './ffmpeg-resolve.mjs'

const MORG_PREFIX = '[[MORG_AUDIO_V1:'
const MORG_SUFFIX = ']]'
const NET_MAX = 10_752
const WIRE_UTF8_MAX = 16_000

const bitrate = process.env.MORG_OPUS_BITRATE ?? '8k'
const useSilenceRemove =
  process.env.MORG_OPUS_USE_SILENCE_REMOVE === '1' || String(process.env.MORG_OPUS_USE_SILENCE_REMOVE || '').toLowerCase() === 'true'
const inPath = process.argv[2]
const outPath = process.argv[3] ?? inPath.replace(/\.[^.]+$/, '') + '.opus'

if (!inPath) {
  console.error('Usage: node scripts/encode-opus-messenger.mjs <input.wav|mp3|…> [output.opus]')
  console.error('Env: MORG_OPUS_BITRATE=6k|8k|12k|4.5k · MORG_OPUS_USE_SILENCE_REMOVE=1 für silenceremove')
  process.exit(1)
}

const silenceremove =
  'silenceremove=start_periods=-1:start_duration=0.4:start_threshold=-35dB:stop_periods=-1:stop_duration=0.5:stop_threshold=-35dB'

const args = ['-hide_banner', '-y', '-i', resolve(inPath)]
if (useSilenceRemove) {
  args.push('-af', silenceremove)
}
args.push(
  '-ar',
  '8000',
  '-ac',
  '1',
  '-c:a',
  'libopus',
  '-b:a',
  bitrate,
  '-application',
  'voip',
  '-vn',
  resolve(outPath)
)

const { executable: ffmpegExe } = resolveFfmpegExecutable()
const r = spawnSync(ffmpegExe, args, { stdio: 'inherit', shell: false })
if (r.error) {
  console.error(r.error.message)
  console.error('Siehe tools/ffmpeg/README.md (gebündeltes ffmpeg) oder MORG_FFMPEG_PATH / System-PATH.')
  process.exit(1)
}
if (r.status !== 0) process.exit(r.status ?? 1)

const st = statSync(outPath)
const buf = readFileSync(outPath)
if (buf.length > NET_MAX) {
  console.warn(
    `WARNUNG: ${basename(outPath)} = ${buf.length} B > ${NET_MAX} B Netto-Limit. Kürzeres Audio oder niedrigere Bitrate (${bitrate}).`
  )
}

const b64 = buf.toString('base64')
const wire = MORG_PREFIX + b64 + MORG_SUFFIX
const wireUtf8 = Buffer.from(wire, 'utf8').length
console.log(`OK: ${basename(outPath)} · ${buf.length} B Roh · Base64 ${b64.length} Zeichen`)
console.log(`Probe-Wire UTF-8: ${wireUtf8} / ${WIRE_UTF8_MAX} (ohne Caption)`)
if (wireUtf8 > WIRE_UTF8_MAX) {
  console.warn(`WARNUNG: Wire über ${WIRE_UTF8_MAX} Byte UTF-8 – ggf. MESSENGER_MAX_PLAINTEXT_UTF8_BYTES anheben oder Audio kürzen.`)
}
process.exit(buf.length > NET_MAX || wireUtf8 > WIRE_UTF8_MAX ? 2 : 0)
