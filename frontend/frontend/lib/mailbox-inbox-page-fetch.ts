'use client'

/**
 * Posteingangs-Seite: zuerst Direkt-RPC, sonst Backend `/inbox` (ohne Fullnode-URL).
 */

import type { InboxApiRow } from '@/frontend/features/inbox/inbox-map-messages'
import { fetchInbox } from '@/frontend/lib/api/inbox'
import { pickInboxRawMessages } from '@/frontend/lib/inbox-pick-raw-messages'
import { tryFetchDirectMailboxInboxViaIota } from '@/frontend/lib/direct-iota-inbox-fetch'

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

  const res = await fetchInbox(opts.limit, undefined, opts.packageId, false, opts.offset)
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
