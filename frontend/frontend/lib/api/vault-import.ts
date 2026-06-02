import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { parseOkEnvelopePassthrough } from '@/frontend/lib/api-simple-ok-envelope'
import { API_BASE } from '@/frontend/lib/api/api-base'

const MAX_IMPORT_BYTES = 12 * 1024 * 1024

export async function importVaultFileFromDevice(file: File): Promise<{
  ok: boolean
  path?: string
  message?: string
  error?: string
}> {
  if (file.size > MAX_IMPORT_BYTES) {
    return { ok: false, error: 'Datei zu groß (max. 12 MB).' }
  }
  try {
    const buf = await file.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
    const contentBase64 = btoa(binary)
    const fr = await fetchApiText(API_BASE, '/api/vault-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentBase64,
        filename: file.name || '.morgendrot-vault',
      }),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Vault-Import fehlgeschlagen.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    return {
      ok: true,
      path: typeof b.path === 'string' ? b.path : undefined,
      message: typeof b.message === 'string' ? b.message : undefined,
    }
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}
