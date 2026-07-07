/**
 * Handoff-ZIP im Browser entpacken (fflate) — Klartext-.env oder passwortgeschützt (handoff.morg.enc).
 */
import { unzipSync, strFromU8 } from 'fflate'
import {
  decryptHandoffEnvUtf8,
  HANDOFF_CRYPTO_JSON_FILENAME,
  HANDOFF_ENV_ENC_FILENAME,
  HANDOFF_ENV_ENC_FILENAME_LEGACY,
  parseHandoffCryptoMetaJson,
  type HandoffCryptoMetaJson,
} from '@/frontend/lib/handoff-zip-crypto'
import { HANDOFF_EXTRAS_FILENAME, parseHandoffExtrasJson } from '@/frontend/lib/handoff-extras'
import { parseHandoffEncryptedBundle } from '@/frontend/lib/handoff-zip-bundle'

const ENV_NAMES = [
  'morgendrot-standalone-handoff.env',
  'handoff.env',
  '.env',
]

const ENC_NAMES = [HANDOFF_ENV_ENC_FILENAME, HANDOFF_ENV_ENC_FILENAME_LEGACY]

export type HandoffEncryptedPending = {
  cryptoMeta: HandoffCryptoMetaJson
  ciphertext: Uint8Array
  readmeText?: string
}

export const HANDOFF_RUNTIME_CONFIG_FILENAME = '.morgendrot-runtime-config.json'

export type HandoffZipExtract =
  | {
      ok: true
      envText: string
      envFileName: string
      runtimeConfigText?: string
      extrasText?: string
      readmeText?: string
      encrypted: boolean
    }
  | { ok: false; needsPassword: true; pending: HandoffEncryptedPending }
  | { ok: false; error: string }

function pickEnvEntry(files: Record<string, Uint8Array>): { name: string; data: Uint8Array } | null {
  const paths = Object.keys(files).filter((p) => !p.endsWith('/'))
  for (const preferred of ENV_NAMES) {
    const hit = paths.find((p) => p.toLowerCase().endsWith(preferred.toLowerCase()))
    if (hit && files[hit]) return { name: hit.split('/').pop() || hit, data: files[hit]! }
  }
  const fallback = paths.find((p) => /\.env$/i.test(p) && files[p])
  if (fallback && files[fallback]) {
    return { name: fallback.split('/').pop() || fallback, data: files[fallback]! }
  }
  return null
}

function pickEncryptedBundle(files: Record<string, Uint8Array>): HandoffEncryptedPending | null {
  const paths = Object.keys(files).filter((p) => !p.endsWith('/'))
  const cryptoPath = paths.find((p) => p.toLowerCase().endsWith(HANDOFF_CRYPTO_JSON_FILENAME.toLowerCase()))
  if (!cryptoPath || !files[cryptoPath]) return null
  const meta = parseHandoffCryptoMetaJson(strFromU8(files[cryptoPath]!))
  if (!meta) return null
  let encPath: string | undefined
  for (const name of ENC_NAMES) {
    const hit = paths.find((p) => p.toLowerCase().endsWith(name.toLowerCase()))
    if (hit && files[hit]) {
      encPath = hit
      break
    }
  }
  if (!encPath) return null
  const readmePath = paths.find((p) => /readme-handoff\.txt$/i.test(p))
  return {
    cryptoMeta: meta,
    ciphertext: files[encPath]!,
    readmeText: readmePath ? strFromU8(files[readmePath]!) : undefined,
  }
}

export async function extractHandoffFromZipFile(file: File): Promise<HandoffZipExtract> {
  if (!file.name.toLowerCase().endsWith('.zip')) {
    return { ok: false, error: 'Bitte eine .zip-Datei wählen (Boss-Handoff).' }
  }
  if (file.size > 2 * 1024 * 1024) {
    return { ok: false, error: 'ZIP zu groß (max. 2 MB).' }
  }
  let buf: ArrayBuffer
  try {
    buf = await file.arrayBuffer()
  } catch {
    return { ok: false, error: 'Datei konnte nicht gelesen werden.' }
  }
  return extractHandoffFromZipBytes(new Uint8Array(buf))
}

/** Entpacken aus Rohbytes (Tests / intern). */
export function extractHandoffFromZipBytes(data: Uint8Array): HandoffZipExtract {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(data)
  } catch {
    return { ok: false, error: 'ZIP konnte nicht entpackt werden.' }
  }

  const encrypted = pickEncryptedBundle(files)
  if (encrypted) {
    return { ok: false, needsPassword: true, pending: encrypted }
  }

  const envEntry = pickEnvEntry(files)
  if (!envEntry) {
    return {
      ok: false,
      error: 'Keine Handoff-.env im ZIP (erwartet z. B. morgendrot-standalone-handoff.env oder handoff.morg.enc).',
    }
  }
  const envText = strFromU8(envEntry.data)
  if (!envText.trim()) {
    return { ok: false, error: 'Handoff-.env ist leer.' }
  }
  const readmePath = Object.keys(files).find((p) => /readme-handoff\.txt$/i.test(p))
  const readmeText = readmePath ? strFromU8(files[readmePath]!) : undefined
  const runtimePath = Object.keys(files).find((p) =>
    p.toLowerCase().endsWith(HANDOFF_RUNTIME_CONFIG_FILENAME.toLowerCase())
  )
  const runtimeConfigText = runtimePath ? strFromU8(files[runtimePath]!) : undefined
  const extrasPath = Object.keys(files).find((p) =>
    p.toLowerCase().endsWith(HANDOFF_EXTRAS_FILENAME.toLowerCase())
  )
  const extrasText = extrasPath ? strFromU8(files[extrasPath]!) : undefined
  return { ok: true, envText, envFileName: envEntry.name, runtimeConfigText, extrasText, readmeText, encrypted: false }
}

/** ZIP-Rohbytes → Klartext-.env (inkl. optional Passwort bei verschlüsseltem Paket). */
export async function extractHandoffFromZipBytesAuto(
  data: Uint8Array,
  password?: string
): Promise<HandoffZipExtract> {
  const first = extractHandoffFromZipBytes(data)
  if (first.ok || !('needsPassword' in first) || !first.needsPassword) return first
  if (!password?.trim()) return first
  return decryptHandoffPending(first.pending, password)
}

export async function decryptHandoffPending(
  pending: HandoffEncryptedPending,
  password: string
): Promise<HandoffZipExtract> {
  const dec = await decryptHandoffEnvUtf8(pending.cryptoMeta, pending.ciphertext, password)
  if (!dec.ok) return dec
  const bundle = parseHandoffEncryptedBundle(dec.envText)
  if (!bundle.envText.trim()) {
    return { ok: false, error: 'Entschlüsselte Handoff-.env ist leer.' }
  }
  const extrasText = bundle.extras ? `${JSON.stringify(bundle.extras, null, 2)}\n` : undefined
  return {
    ok: true,
    envText: bundle.envText,
    envFileName: HANDOFF_ENV_ENC_FILENAME,
    readmeText: pending.readmeText,
    extrasText,
    encrypted: true,
  }
}
