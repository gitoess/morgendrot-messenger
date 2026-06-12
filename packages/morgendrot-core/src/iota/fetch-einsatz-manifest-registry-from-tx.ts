import type { IotaClient } from '@iota/iota-sdk/client'
import { extractEinsatzManifestRegistryIdFromTxJson } from './parse-iota-tx-events'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Nach `create_einsatz_manifest_registry` — Event `registry_id` aus TX-Digest. */
export async function fetchEinsatzManifestRegistryIdFromDigest(
  client: IotaClient,
  digest: string
): Promise<string | null> {
  const d = digest.trim()
  if (!d) return null
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(900)
    try {
      const res = await client.getTransactionBlock({
        digest: d,
        options: { showEvents: true, showEffects: true },
      } as Parameters<IotaClient['getTransactionBlock']>[0])
      const id = extractEinsatzManifestRegistryIdFromTxJson(res)
      if (id) return id
    } catch {
      /* retry */
    }
  }
  return null
}
