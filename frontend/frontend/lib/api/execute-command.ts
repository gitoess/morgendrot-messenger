import type { ApiResponse } from '../types'
import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { parseApiJsonEnvelope } from '@/frontend/lib/api-response-guard'
import { API_BASE } from '@/frontend/lib/api/api-base'
import type { MessagingPersistenceMode } from '@/frontend/lib/messaging-persistence-mode'

export type ApiCommandPostBodyOpts = {
  morgPkg?: unknown
  messagingPersistenceMode?: MessagingPersistenceMode
}

/** POST-Body für `/api/command` — für Vitest und einheitliche Serialisierung. */
export function buildApiCommandPostBody(
  command: string,
  args: (string | number)[] = [],
  opts?: ApiCommandPostBodyOpts
): Record<string, unknown> {
  const body: Record<string, unknown> = { cmd: command, args: args.map(String) }
  if (opts?.morgPkg != null && typeof opts.morgPkg === 'object') body.morgPkg = opts.morgPkg
  if (opts?.messagingPersistenceMode != null) body.messagingPersistenceMode = opts.messagingPersistenceMode
  return body
}

export async function executeCommand<T = unknown>(
  command: string,
  args: (string | number)[] = [],
  opts?: { timeoutMs?: number; signal?: AbortSignal; morgPkg?: unknown; messagingPersistenceMode?: MessagingPersistenceMode }
): Promise<ApiResponse<T>> {
  try {
    const signal =
      opts?.signal ?? (opts?.timeoutMs != null ? AbortSignal.timeout(opts.timeoutMs) : undefined)
    const body = buildApiCommandPostBody(command, args, {
      morgPkg: opts?.morgPkg,
      messagingPersistenceMode: opts?.messagingPersistenceMode,
    })
    const fr = await fetchApiText(API_BASE, '/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
    if (!fr.ok) {
      return { ok: false, error: fr.error } as ApiResponse<T>
    }
    const envelope = parseApiJsonEnvelope(fr.text)
    if (!envelope.ok) {
      return {
        ok: false,
        error:
          envelope.error === 'invalid_json'
            ? 'Antwort vom Backend ist kein gültiges JSON.'
            : 'Unerwartetes Antwortformat (API).',
      } as ApiResponse<T>
    }
    const data = envelope.data as ApiResponse<T>
    if (data && typeof data === 'object' && data.ok === false) {
      const msg = data.message
      if (!data.error && typeof msg === 'string' && msg.length > 0) {
        return { ...data, error: msg }
      }
    }
    return data
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e) }
  }
}
