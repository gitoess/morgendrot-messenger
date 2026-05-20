'use client'

import { executeCommand } from '@/frontend/lib/api/execute-command'

export type CreatePrivateMailboxOnChainResult = {
  ok: boolean
  objectId?: string
  digest?: string
  message?: string
  error?: string
}

/** M4d: PTB `create_private_mailbox` über `/api/command` (Server-Signer). */
export async function createPrivateMailboxOnChain(): Promise<CreatePrivateMailboxOnChainResult> {
  const r = await executeCommand('/create-private-mailbox', [], { timeoutMs: 120_000 })
  const body = r as {
    ok?: boolean
    objectId?: string
    digest?: string
    txDigest?: string
    message?: string
    error?: string
    createdObjectIds?: string[]
  }

  if (body.ok !== true) {
    return { ok: false, error: body.error || body.message || r.error || r.message || 'Private Mailbox konnte nicht erstellt werden.' }
  }

  const objectId =
    typeof body.objectId === 'string' && body.objectId.trim()
      ? body.objectId.trim()
      : Array.isArray(body.createdObjectIds)
        ? body.createdObjectIds[0]?.trim()
        : undefined

  return {
    ok: true,
    objectId,
    digest: body.digest || body.txDigest || r.txDigest,
    message: body.message || r.message,
  }
}
