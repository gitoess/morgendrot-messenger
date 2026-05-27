import {
  fetchStandaloneSmartphoneHandoffParts,
  type StandaloneSmartphoneHandoffZipBody,
} from '@/frontend/lib/api/standalone-smartphone-handoff'
import { buildHandoffZipBytes } from '@/frontend/lib/handoff-zip-build'
import {
  encryptHandoffEnvUtf8,
  HANDOFF_CRYPTO_JSON_FILENAME,
  HANDOFF_ENCRYPTED_README,
  HANDOFF_ENV_ENC_FILENAME,
} from '@/frontend/lib/handoff-zip-crypto'

export type HandoffZipPayloadResult =
  | { ok: true; zipBytes: Uint8Array; filenameBase: string; passwordProtected: boolean }
  | { ok: false; error: string }

/** Handoff-ZIP-Bytes für Download oder IOTA (immer via `format=parts`, Krypto im Browser). */
export async function buildHandoffZipPayload(
  body: StandaloneSmartphoneHandoffZipBody,
  options: { password?: string }
): Promise<HandoffZipPayloadResult> {
  const parts = await fetchStandaloneSmartphoneHandoffParts(body)
  if (!parts.ok) return parts

  if (options.password?.length) {
    const { meta, ciphertext } = await encryptHandoffEnvUtf8(parts.envContent, options.password)
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

  const zipBytes = buildHandoffZipBytes({
    'morgendrot-standalone-handoff.env': parts.envContent,
    'README-HANDOFF.txt': parts.readme || '',
  })
  return {
    ok: true,
    zipBytes,
    filenameBase: parts.filenameBase,
    passwordProtected: false,
  }
}
