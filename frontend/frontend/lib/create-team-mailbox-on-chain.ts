'use client'

import { executeCommand } from '@/frontend/lib/api/execute-command'

export type CreateTeamMailboxOnChainResult = {
  ok: boolean
  objectId?: string
  digest?: string
  message?: string
  error?: string
}

/** Team-Shared-Mailbox (`create_team_mailbox`) über `/api/command`. */
export async function createTeamMailboxOnChain(): Promise<CreateTeamMailboxOnChainResult> {
  const r = await executeCommand('/create-team-mailbox', [], { timeoutMs: 120_000 })
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
    return {
      ok: false,
      error: body.error || body.message || r.error || r.message || 'Team-Mailbox konnte nicht erstellt werden.',
      digest: body.digest || body.txDigest || r.txDigest,
      message: body.message || r.message,
    }
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
