import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { parseOkEnvelopePassthrough } from '@/frontend/lib/api-simple-ok-envelope'
import { API_BASE } from '@/frontend/lib/api/api-base'
import { executeCommand } from '@/frontend/lib/api/execute-command'

function triggerBrowserDownload(b64: string, filename: string): void {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

type ExportPayload = {
  contentBase64?: string
  filename?: string
  path?: string
  message?: string
  error?: string
}

function finishExport(b: ExportPayload): {
  ok: boolean
  path?: string
  filename?: string
  message?: string
  error?: string
} {
  const b64 = typeof b.contentBase64 === 'string' ? b.contentBase64 : ''
  const filename = (typeof b.filename === 'string' && b.filename.trim()) || '.morgendrot-vault'
  if (!b64) return { ok: false, error: 'Antwort ohne Dateiinhalt.' }
  triggerBrowserDownload(b64, filename)
  return {
    ok: true,
    path: typeof b.path === 'string' ? b.path : undefined,
    filename,
    message: `Download gestartet: ${filename}`,
  }
}

/**
 * Vault-Datei vom API-Server → Browser-Downloads.
 * 1) GET /api/vault-export
 * 2) Fallback: /api/command → /vault-export (wenn API noch ohne HTTP-Route läuft)
 */
export async function downloadVaultFileFromServer(): Promise<{
  ok: boolean
  path?: string
  filename?: string
  message?: string
  error?: string
}> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/vault-export', { method: 'GET' })
    if (fr.ok) {
      if (fr.response.status !== 404 && !/Route nicht gefunden/i.test(fr.text)) {
        const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Vault-Download fehlgeschlagen.' })
        if (!r.ok) return { ok: false, error: r.error }
        return finishExport(r.body)
      }
    } else if (fr.error && !/Route nicht gefunden|404/i.test(fr.error)) {
      /** Echter Netzwerk-/Auth-Fehler — nicht als fehlende Route maskieren. */
      return { ok: false, error: fr.error }
    }

    const cmd = await executeCommand<ExportPayload>('/vault-export', [])
    if (!cmd.ok) {
      return {
        ok: false,
        error:
          cmd.error ||
          (cmd as { message?: string }).message ||
          'Vault-Download fehlgeschlagen. API neu starten (npm run dev), dann erneut versuchen.',
      }
    }
    return finishExport(cmd as ExportPayload)
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}
