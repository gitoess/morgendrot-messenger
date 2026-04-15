import type { IotaClient } from '@iota/iota-sdk/client'

/** Cheap RPC check — same idea as `isChainReachable` on the Node stack, ohne Env. */
export async function probeDirectIotaRpc(client: IotaClient): Promise<boolean> {
  try {
    await client.getRpcApiVersion()
    return true
  } catch {
    return false
  }
}
