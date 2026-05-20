import type { IotaClient } from '@iota/iota-sdk/client'
import type { Signer } from '@iota/iota-sdk/cryptography'
import type { Transaction } from '@iota/iota-sdk/transactions'

export type DirectSignAndExecuteResult = {
  digest?: string
  status?: string
}

function parseEffectsStatus(resp: unknown): string | undefined {
  const e = (resp as { effects?: { status?: unknown } })?.effects?.status
  if (e == null) return undefined
  if (typeof e === 'string') return e.trim().toLowerCase()
  if (typeof e === 'object' && e !== null) {
    const o = e as Record<string, unknown>
    if (typeof o.status === 'string') return o.status.trim().toLowerCase()
    if (typeof o.type === 'string') return o.type.trim().toLowerCase()
  }
  return undefined
}

/** Erfolg wenn Digest da und Status fehlt, success oder submitted (IOTA-SDK-Varianten). */
export function isDirectChainExecutionSuccess(digest: string | undefined, status: string | undefined): boolean {
  const d = (digest ?? '').trim()
  if (!d) return false
  const st = (status ?? '').trim().toLowerCase()
  if (!st) return true
  return st === 'success' || st === 'submitted'
}

export async function signAndExecuteTransactionWithSigner(opts: {
  client: IotaClient
  transaction: Transaction
  signer: Signer
}): Promise<DirectSignAndExecuteResult> {
  const resp = await opts.client.signAndExecuteTransaction({
    transaction: opts.transaction,
    signer: opts.signer,
    options: { showEffects: true as const },
  })
  const digest = (resp as { digest?: string })?.digest
  const status = parseEffectsStatus(resp)
  return { digest, status: status || (digest ? 'success' : undefined) }
}
