/**
 * Lokale Wire-Diagnostik ohne laufende API: liest .txt und optional .jpg,
 * baut dieselben Wire-Formate wie der Chat (Kompaktbild hier: Roh-Base64 des JPEG —
 * die UI nutzt zusätzlich /api/compact-image-encode).
 *
 *   npx tsx scripts/debug-outgoing-wire.ts "C:\path\file.txt" "C:\path\img.jpg"
 *
 * Browser-Logging im Chat: localStorage morg.debug.send = "1"
 * Backend: MORG_DEBUG_SEND_WIRE=1 MORG_DEBUG_IOTA_CLI=1
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const COMPACT_IMG_PREFIX = '[[MORG_COMPACT_IMG_V1:'
const COMPACT_IMG_SUFFIX = ']]'
const COMPACT_FILE_TXT_PREFIX = '[[MORG_FILE_TXT_V1:'
const COMPACT_FILE_TXT_SUFFIX = ']]'

function utf8Len(s: string): number {
  return Buffer.from(s, 'utf8').length
}

function wrapCompactImagePlaceholder(jpegBase64: string): string {
  return COMPACT_IMG_PREFIX + jpegBase64 + COMPACT_IMG_SUFFIX
}

/** Wie `wrapFileTxtMessage` im Frontend (JSON { n, b } → Base64). */
function wrapFileTxt(name: string, text: string): string {
  const b = Buffer.from(text, 'utf8').toString('base64')
  const inner = JSON.stringify({ n: name.replace(/[/\\]/g, '_'), b })
  const outer = Buffer.from(inner, 'utf8').toString('base64')
  return COMPACT_FILE_TXT_PREFIX + outer + COMPACT_FILE_TXT_SUFFIX
}

async function main() {
  const txtPath = process.argv[2] || String.raw`C:\Users\damast\Desktop\morgendrot-einsatzbericht-kurz-1775124098858.txt`
  const jpgPath = process.argv[3] || String.raw`C:\Users\damast\Desktop\basisssw.jpg`

  console.log('--- Text (.txt) ---')
  try {
    const text = await readFile(txtPath, 'utf8')
    const wire = wrapFileTxt(txtPath.split(/[/\\]/).pop() || 'file.txt', text)
    console.log('path:', resolve(txtPath))
    console.log('wireKind: file_txt utf8Bytes:', utf8Len(wire), 'jsChars:', wire.length)
    console.log('head:', wire.slice(0, 120) + '…')
  } catch (e) {
    console.error('txt:', e instanceof Error ? e.message : e)
  }

  console.log('\n--- JPEG (Roh-Base64, nicht kompakt-kodiert) ---')
  try {
    const buf = await readFile(jpgPath)
    const b64 = buf.toString('base64')
    const wire = wrapCompactImagePlaceholder(b64)
    console.log('path:', resolve(jpgPath))
    console.log('raw file bytes:', buf.length, 'base64 chars:', b64.length)
    console.log('wireKind: compact_img (raw) utf8Bytes:', utf8Len(wire), 'jsChars:', wire.length)
    console.log(
      'Hinweis: echte UI nutzt /api/compact-image-encode — Wire ist kleiner; Roh-JPEG kann >16000 UTF-8 sein.'
    )
  } catch (e) {
    console.error('jpg:', e instanceof Error ? e.message : e)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
