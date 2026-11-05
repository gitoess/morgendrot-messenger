import type { IotaClient } from '@iota/iota-sdk/client'
import type { Transaction } from '@iota/iota-sdk/transactions'

const GAS_COIN_PAGE = 100
const MAX_GAS_PAYMENT_OBJECTS = 50
const DEFAULT_GAS_BUDGET = BigInt(10_000_000)

export type GasCoinRef = { objectId: string; version: number; digest: string }

export async function getOwnerIotaBalanceMist(client: IotaClient, owner: string): Promise<bigint> {
  const res = (await client.getBalance({ owner } as Parameters<IotaClient['getBalance']>[0])) as {
    totalBalance?: string | number
  }
  const raw = res?.totalBalance
  if (raw === undefined || raw === null) return 0n
  try {
    return BigInt(String(raw))
  } catch {
    return 0n
  }
}

export async function collectGasCoinRefs(client: IotaClient, owner: string): Promise<GasCoinRef[]> {
  const out: GasCoinRef[] = []
  let cursor: string | undefined
  for (;;) {
    const res = (await client.getCoins({
      owner,
      limit: GAS_COIN_PAGE,
      ...(cursor ? { cursor } : {}),
    } as Parameters<IotaClient['getCoins']>[0])) as {
      data?: Array<{ coinObjectId?: string; version?: string | number; digest?: string }>
      nextCursor?: string | null
    }
    const data = res.data ?? []
    for (const c of data) {
      if (!c.coinObjectId || !c.digest) continue
      const v = c.version
      const version =
        v !== undefined && v !== null ? (typeof v === 'number' ? v : parseInt(String(v), 10) || 0) : 0
      out.push({ objectId: c.coinObjectId, version, digest: c.digest })
      if (out.length >= MAX_GAS_PAYMENT_OBJECTS) break
    }
    if (out.length >= MAX_GAS_PAYMENT_OBJECTS) break
    cursor = res.nextCursor ?? undefined
    if (!cursor) break
  }
  return out
}

export async function attachGasPaymentForOwner(
  client: IotaClient,
  txb: Transaction,
  owner: string,
  gasBudget: bigint = DEFAULT_GAS_BUDGET
): Promise<void> {
  txb.setGasBudget(gasBudget)
  const coins = await collectGasCoinRefs(client, owner)
  if (coins.length === 0) throw new Error('Keine Coin-Objekte für Gas — Wallet mit IOTA (MIST) füllen.')
  const bal = await getOwnerIotaBalanceMist(client, owner)
  if (bal < gasBudget) {
    throw new Error(
      `Wallet-Saldo zu niedrig für Gas-Budget: ${bal} MIST verfügbar, ${gasBudget} MIST nötig. IOTA nachladen.`
    )
  }
  txb.setGasPayment(coins)
}
