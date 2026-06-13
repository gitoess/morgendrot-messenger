import { downloadStandaloneSmartphoneHandoffZip, type StandaloneSmartphoneHandoffZipBody } from '@/frontend/lib/api/standalone-smartphone-handoff'
import { downloadHandoffZipBytes } from '@/frontend/lib/handoff-zip-build'
import { buildHandoffZipPayload } from '@/frontend/lib/handoff-zip-payload'
import { validateHandoffExportPassword } from '@/frontend/lib/handoff-zip-crypto'

export async function downloadHandoffZipExport(
  body: StandaloneSmartphoneHandoffZipBody,
  options: { password?: string; passwordConfirm?: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const password = options.password?.trim()
  if (!password) {
    return { ok: false, error: 'Handoff-ZIP erfordert ein Passwort (Verschlüsselung ist Pflicht).' }
  }
  const pwErr = validateHandoffExportPassword(password, options.passwordConfirm ?? password)
  if (pwErr) return { ok: false, error: pwErr }

  const built = await buildHandoffZipPayload(body, { password })
  if (!built.ok) return built
  downloadHandoffZipBytes(built.zipBytes, `${built.filenameBase}.zip`)
  return { ok: true }
}
