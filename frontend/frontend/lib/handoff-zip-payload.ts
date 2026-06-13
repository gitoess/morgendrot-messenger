import {
  fetchStandaloneSmartphoneHandoffParts,
  type StandaloneSmartphoneHandoffZipBody,
} from '@/frontend/lib/api/standalone-smartphone-handoff'
import { buildHandoffZipBytes } from '@/frontend/lib/handoff-zip-build'

export const HANDOFF_RUNTIME_CONFIG_FILENAME = '.morgendrot-runtime-config.json'
import {
  encryptHandoffEnvUtf8,
  HANDOFF_CRYPTO_JSON_FILENAME,
  HANDOFF_ENCRYPTED_README,
  HANDOFF_ENV_ENC_FILENAME,
} from '@/frontend/lib/handoff-zip-crypto'

export type HandoffZipPayloadResult =
  | { ok: true; zipBytes: Uint8Array; filenameBase: string; passwordProtected: boolean }
  | { ok: false; error: string }

/** Handoff-ZIP ohne Passwort nur in Dev (NEXT_PUBLIC_ALLOW_UNPROTECTED_HANDOFF_ZIP=1). */
const ALLOW_UNPROTECTED_HANDOFF_ZIP =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_ALLOW_UNPROTECTED_HANDOFF_ZIP === '1'

/** Handoff-ZIP-Bytes für Download oder IOTA (immer via `format=parts`, Krypto im Browser). */
export async function buildHandoffZipPayload(
  body: StandaloneSmartphoneHandoffZipBody,
  options: { password?: string }
): Promise<HandoffZipPayloadResult> {
  const parts = await fetchStandaloneSmartphoneHandoffParts(body)
  if (!parts.ok) return parts

  const password = options.password?.trim()
  if (!password) {
    if (!ALLOW_UNPROTECTED_HANDOFF_ZIP) {
      return {
        ok: false,
        error: 'Handoff-ZIP erfordert ein Passwort (Verschlüsselung ist Pflicht).',
      }
    }
    const zipEntries: Record<string, string | Uint8Array> = {
      'morgendrot-standalone-handoff.env': parts.envContent,
      'README-HANDOFF.txt': parts.readme || '',
    }
    if (parts.runtimeConfigContent?.trim()) {
      zipEntries[HANDOFF_RUNTIME_CONFIG_FILENAME] = parts.runtimeConfigContent
    }
    const zipBytes = buildHandoffZipBytes(zipEntries)
    return {
      ok: true,
      zipBytes,
      filenameBase: parts.filenameBase,
      passwordProtected: false,
    }
  }

  const { meta, ciphertext } = await encryptHandoffEnvUtf8(parts.envContent, password)
  const zipBytes = buildHandoffZipBytes({
    [HANDOFF_ENV_ENC_FILENAME]: ciphertext,
    [HANDOFF_CRYPTO_JSON_FILENAME]: JSON.stringify(meta, null, 2),
    'README-HANDOFF.txt': HANDOFF_ENCRYPTED_README,
  })
  return {
    ok: true,
    zipBytes,
    filenameBase: `${parts.filenameBase}-protected`,
    passwordProtected: true,
  }
}
