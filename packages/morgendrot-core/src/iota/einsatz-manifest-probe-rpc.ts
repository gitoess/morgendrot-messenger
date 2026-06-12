import type { IotaClient } from '@iota/iota-sdk/client'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

function messagingStructType(packageId: string, struct: string): string {
  return `${packageId.trim()}::messaging::${struct}`
}

export type ProbeEinsatzManifestAnchorInput = {
  packageId: string
  registryObjectId: string
  einsatzIdMoveAddress: string
  sequence: bigint
}

/** § H.33 — Prüft per RPC, ob `EinsatzManifestKey` unter der Registry existiert. */
export async function probeEinsatzManifestAnchorOnChain(
  client: IotaClient,
  input: ProbeEinsatzManifestAnchorInput
): Promise<boolean> {
  const pkg = input.packageId.trim()
  const reg = input.registryObjectId.trim()
  const einsatz = input.einsatzIdMoveAddress.trim()
  if (!HEX64.test(reg) || !HEX64.test(einsatz)) return false
  try {
    const resp = await client.getDynamicFieldObject({
      parentObjectId: reg,
      name: {
        type: messagingStructType(pkg, 'EinsatzManifestKey'),
        value: { einsatz_id: einsatz, sequence: input.sequence.toString() },
      },
      options: { showContent: true },
    } as Parameters<IotaClient['getDynamicFieldObject']>[0])
    const content = (resp as { data?: { content?: unknown } })?.data?.content
    return content != null
  } catch {
    return false
  }
}
