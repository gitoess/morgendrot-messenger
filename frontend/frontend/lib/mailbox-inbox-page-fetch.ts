'use client'

/**
 * Posteingangs-Seite: zuerst Direkt-RPC, sonst Backend `/inbox` (ohne Fullnode-URL).
 */

import type { Message } from '@/frontend/lib/types'
import type { InboxApiRow } from '@/frontend/features/inbox/inbox-map-messages'
import { executeCommand } from '@/frontend/lib/api/execute-command'
import { pickInboxRawMessages } from '@/frontend/lib/inbox-pick-raw-messages'
import { tryFetchDirectMailboxInboxViaIota } from '@/frontend/lib/direct-iota-inbox-fetch'
import { shouldSkipMessengerApiRelayFallback } from '@/frontend/lib/messenger-standalone-relay'

export type MailboxInboxPageFetchResult =
  | { ok: true; rows: InboxApiRow[]; source: 'rpc' | 'api' }
  | { ok: false; error: string }

export async function fetchMailboxInboxPage(opts: {
  limit: number
  offset: number
  packageId?: string
}): Promise<MailboxInboxPageFetchResult> {
  const direct = await tryFetchDirectMailboxInboxViaIota({
    limit: opts.limit,
    offset: opts.offset,
    packageIdOverride: opts.packageId,
  })
  if (direct.ok) return { ok: true, rows: direct.rows, source: 'rpc' }

  if (shouldSkipMessengerApiRelayFallback()) {
    return {
      ok: false,
      error: direct.error || 'Standalone: Posteingang nur per Direkt-RPC (Handoff, RPC, Ketten-IDs).',
    }
  }

  const res = await executeCommand<Message[]>(
    '/inbox',
    [String(opts.limit), '', opts.packageId ?? '', '', '', String(opts.offset)],
    { timeoutMs: 45_000 }
  )
  const raw = pickInboxRawMessages(res as { data?: unknown; messages?: unknown })
  if (res.ok && raw != null) {
    return { ok: true, rows: raw as InboxApiRow[], source: 'api' }
  }
  const apiErr =
    (res as { error?: string; message?: string }).error ||
    (res as { message?: string }).message ||
    ''
  const hint = direct.error ? `Direkt-RPC: ${direct.error}` : ''
  const tail = apiErr ? `API: ${apiErr}` : 'API: Posteingang nicht ladbar.'
  return { ok: false, error: [hint, tail].filter(Boolean).join(' — ') }
}
