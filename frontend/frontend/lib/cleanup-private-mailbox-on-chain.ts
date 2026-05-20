'use client'

import { executeCommand } from '@/frontend/lib/api/execute-command'

export type CleanupPrivateMailboxOnChainResult = {
  ok: boolean
  digest?: string
  explorerTxLink?: string
  purgedHandshakes?: number
  purgedMessages?: number
  transactions?: number
  message?: string
  error?: string
}

export async function cleanupPrivateMailboxOnChain(objectId: string): Promise<CleanupPrivateMailboxOnChainResult> {
  const id = objectId.trim()
  if (!/^0x[a-fA-F0-9]{64}$/i.test(id)) {
    return { ok: false, error: 'Ungültige Object-ID (0x + 64 Hex).' }
  }
  const r = await executeCommand('/cleanup-private-mailbox', [id], { timeoutMs: 180_000 })
  const body = r as unknown as Record<string, unknown>
  if (body.ok !== true) {
    const err =
      (typeof body.error === 'string' && body.error) ||
      (typeof body.message === 'string' && body.message) ||
      (typeof r.error === 'string' && r.error) ||
      'Aufräumen fehlgeschlagen.'
    return { ok: false, error: err }
  }
  const digest =
    (typeof body.digest === 'string' ? body.digest.trim() : '') ||
    (typeof body.txDigest === 'string' ? body.txDigest.trim() : '') ||
    ''
  return {
    ok: true,
    digest: digest || undefined,
    explorerTxLink:
      typeof body.explorerTxLink === 'string' && body.explorerTxLink.trim()
        ? body.explorerTxLink.trim()
        : undefined,
    purgedHandshakes: typeof body.purgedHandshakes === 'number' ? body.purgedHandshakes : undefined,
    purgedMessages: typeof body.purgedMessages === 'number' ? body.purgedMessages : undefined,
    transactions: typeof body.transactions === 'number' ? body.transactions : undefined,
    message: typeof body.message === 'string' ? body.message : typeof r.message === 'string' ? r.message : undefined,
  }
}
