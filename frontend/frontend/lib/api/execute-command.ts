import type { ApiResponse } from '../types'
import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { parseApiJsonEnvelope } from '@/frontend/lib/api-response-guard'
import { API_BASE } from '@/frontend/lib/api/api-base'
import type { MessagingPersistenceMode } from '@/frontend/lib/messaging-persistence-mode'

export type ApiCommandPostBodyOpts = {
  morgPkg?: unknown
  /** Großer Klartext für /morg-pkg-export (statt args[1]). */
  commandPlaintext?: string
  messagingPersistenceMode?: MessagingPersistenceMode
  /** M4b: Ziel-Mailbox-Object-ID (Kontakt-private Mailbox). */
  mailboxObjectId?: string
  /** `/inbox`: kein „Letzte N geladen“ im Server-Log (Auto-Poll). */
  silentFetch?: boolean
  /** `/inbox`: nur Mailbox-Dynamic-Fields (Events vom ersten Union-Fetch). */
  mailboxKeysOnly?: boolean
}

/** POST-Body für `/api/command` — für Vitest und einheitliche Serialisierung. */
export function buildApiCommandPostBody(
  command: string,
  args: (string | number)[] = [],
  opts?: ApiCommandPostBodyOpts
): Record<string, unknown> {
  const body: Record<string, unknown> = { cmd: command, args: args.map(String) }
  if (opts?.morgPkg != null && typeof opts.morgPkg === 'object') body.morgPkg = opts.morgPkg
  if (typeof opts?.commandPlaintext === 'string' && opts.commandPlaintext.length > 0) {
    body.commandPlaintext = opts.commandPlaintext
  }
  if (opts?.messagingPersistenceMode != null) body.messagingPersistenceMode = opts.messagingPersistenceMode
  if (typeof opts?.mailboxObjectId === 'string' && /^0x[a-fA-F0-9]{64}$/i.test(opts.mailboxObjectId.trim())) {
    body.mailboxObjectId = opts.mailboxObjectId.trim()
  }
  if (opts?.silentFetch === true) body.silentFetch = true
  if (opts?.mailboxKeysOnly === true) body.mailboxKeysOnly = true
  return body
}

export async function executeCommand<T = unknown>(
  command: string,
  args: (string | number)[] = [],
  opts?: {
    timeoutMs?: number
    signal?: AbortSignal
    morgPkg?: unknown
    commandPlaintext?: string
    messagingPersistenceMode?: MessagingPersistenceMode
    mailboxObjectId?: string
    silentFetch?: boolean
    mailboxKeysOnly?: boolean
  }
): Promise<ApiResponse<T>> {
  try {
    const signal =
      opts?.signal ?? (opts?.timeoutMs != null ? AbortSignal.timeout(opts.timeoutMs) : undefined)
    const body = buildApiCommandPostBody(command, args, {
      morgPkg: opts?.morgPkg,
      commandPlaintext: opts?.commandPlaintext,
      messagingPersistenceMode: opts?.messagingPersistenceMode,
      mailboxObjectId: opts?.mailboxObjectId,
      silentFetch: opts?.silentFetch,
      mailboxKeysOnly: opts?.mailboxKeysOnly,
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
      const bodySnippet = fr.text.replace(/\s+/g, ' ').trim().slice(0, 120)
      return {
        ok: false,
        error:
          envelope.error === 'invalid_json'
            ? `Antwort vom Backend ist kein gültiges JSON.${bodySnippet ? ` Rohantwort: ${bodySnippet}` : ''}`
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
