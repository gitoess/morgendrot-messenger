import type { IotaClient } from '@iota/iota-sdk/client'
import type { Signer } from '@iota/iota-sdk/cryptography'
import type { Transaction } from '@iota/iota-sdk/transactions'

export type DirectSignAndExecuteResult = {
  digest?: string
  status?: string
}

function parseEffectsStatus(resp: unknown): string | undefined {
  const e = (resp as { effects?: { status?: { type?: string } | string } })?.effects?.status
  if (e == null) return undefined
  if (typeof e === 'string') return e
  if (typeof e === 'object' && e !== null && 'type' in e) return String((e as { type?: string }).type)
  return undefined
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
  return { digest, status }
}
