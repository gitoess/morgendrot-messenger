import {
  fetchStandaloneSmartphoneHandoffParts,
  type StandaloneSmartphoneHandoffZipBody,
} from '@/frontend/lib/api/standalone-smartphone-handoff'
import { buildHandoffZipBytes } from '@/frontend/lib/handoff-zip-build'
import {
  buildHandoffExtrasJson,
  HANDOFF_EXTRAS_FILENAME,
  type HandoffExtras,
} from '@/frontend/lib/handoff-extras'

export const HANDOFF_RUNTIME_CONFIG_FILENAME = '.morgendrot-runtime-config.json'
import { enrichHandoffExtrasFromEnvContent } from '@/frontend/lib/handoff-team-broadcast-keys'
import {
  handoffExtrasNeedsZipFile,
  serializeHandoffEncryptedBundle,
} from '@/frontend/lib/handoff-zip-bundle'
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
  options: { password?: string; handoffExtras?: HandoffExtras }
): Promise<HandoffZipPayloadResult> {
  const parts = await fetchStandaloneSmartphoneHandoffParts(body)
  if (!parts.ok) return parts

  const extras = enrichHandoffExtrasFromEnvContent(
    options.handoffExtras ?? parts.handoffExtras,
    parts.envContent
  )

  if (options.password?.length) {
    const plain = serializeHandoffEncryptedBundle(parts.envContent, extras)
    const { meta, ciphertext } = await encryptHandoffEnvUtf8(plain, options.password)
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

  const zipEntries: Record<string, string | Uint8Array> = {
    'morgendrot-standalone-handoff.env': parts.envContent,
    'README-HANDOFF.txt': parts.readme || '',
  }
  if (parts.runtimeConfigContent?.trim()) {
    zipEntries[HANDOFF_RUNTIME_CONFIG_FILENAME] = parts.runtimeConfigContent
  }
  if (handoffExtrasNeedsZipFile(extras)) {
    zipEntries[HANDOFF_EXTRAS_FILENAME] = buildHandoffExtrasJson(extras)
  }
  const zipBytes = buildHandoffZipBytes(zipEntries)
  return {
    ok: true,
    zipBytes,
    filenameBase: parts.filenameBase,
    passwordProtected: false,
  }
}
