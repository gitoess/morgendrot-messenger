import { downloadStandaloneSmartphoneHandoffZip, type StandaloneSmartphoneHandoffZipBody } from '@/frontend/lib/api/standalone-smartphone-handoff'
import { downloadHandoffZipBytes } from '@/frontend/lib/handoff-zip-build'
import { buildHandoffZipPayload } from '@/frontend/lib/handoff-zip-payload'

export async function downloadHandoffZipExport(
  body: StandaloneSmartphoneHandoffZipBody,
  options: { password?: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!options.password?.length) {
    return downloadStandaloneSmartphoneHandoffZip(body)
  }
  const built = await buildHandoffZipPayload(body, { password: options.password })
  if (!built.ok) return built
  downloadHandoffZipBytes(built.zipBytes, `${built.filenameBase}.zip`)
  return { ok: true }
}
