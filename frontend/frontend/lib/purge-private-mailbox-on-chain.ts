'use client'

import { executeCommand } from '@/frontend/lib/api/execute-command'

export type PurgePrivateMailboxOnChainResult = {
  ok: boolean
  digest?: string
  explorerTxLink?: string
  message?: string
  error?: string
}

function parseCommandOk(r: Record<string, unknown>): boolean {
  if (r.ok === false) return false
  if (r.ok !== true) return false
  const digest =
    (typeof r.digest === 'string' && r.digest.trim()) ||
    (typeof r.txDigest === 'string' && r.txDigest.trim()) ||
    ''
  return digest.length > 0
}

export async function purgePrivateMailboxOnChain(objectId: string): Promise<PurgePrivateMailboxOnChainResult> {
  const id = objectId.trim()
  if (!/^0x[a-fA-F0-9]{64}$/i.test(id)) {
    return { ok: false, error: 'Ungültige Object-ID (0x + 64 Hex).' }
  }
  const r = await executeCommand('/purge-private-mailbox', [id], { timeoutMs: 120_000 })
  const body = r as unknown as Record<string, unknown>

  if (!parseCommandOk(body)) {
    const err =
      (typeof body.error === 'string' && body.error) ||
      (typeof body.message === 'string' && body.message) ||
      (typeof r.error === 'string' && r.error) ||
      (typeof r.message === 'string' && r.message) ||
      ''
    if (/purge_private_mailbox|function not found|Could not resolve/i.test(err)) {
      return {
        ok: false,
        error:
          'Rebate on-chain noch nicht im Paket (npm run deploy:move-package). Bis dahin: „Aus Liste“ oder Mailbox leer halten.',
      }
    }
    if (/entsperr|locked|passwort|wallet/i.test(err)) {
      return { ok: false, error: 'Tresor entsperren, dann Rebate erneut versuchen.' }
    }
    return { ok: false, error: err || 'Rebate fehlgeschlagen.' }
  }
  const digest =
    (typeof body.digest === 'string' ? body.digest.trim() : '') ||
    (typeof body.txDigest === 'string' ? body.txDigest.trim() : '') ||
    (typeof r.txDigest === 'string' ? r.txDigest.trim() : '') ||
    ''
  const explorerTxLink =
    typeof body.explorerTxLink === 'string' && body.explorerTxLink.trim()
      ? body.explorerTxLink.trim()
      : undefined
  return {
    ok: true,
    digest: digest || undefined,
    explorerTxLink,
    message: typeof body.message === 'string' ? body.message : typeof r.message === 'string' ? r.message : undefined,
  }
}
