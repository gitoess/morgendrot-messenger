/**
 * Meshtastic-Knoten-Anzeige `!` + hex (wie `nodeNumToMeshId` in use-meshtastic-ble) → 32-Bit-Zahl
 * für `MeshDevice.sendText` / `sendPacket` (`Destination`).
 */
/** Wie Meshtastic-Knoten in der UI (`!` + hex, 32-Bit). */
export function formatMeshtasticNodeIdFromNum(nodeNum: number): string {
  return `!${(nodeNum >>> 0).toString(16)}`
}

export function parseMeshtasticNodeIdToNumber(raw: string): number | null {
  const t = raw.trim()
  const m = /^!([0-9a-fA-F]{1,8})$/.exec(t)
  if (!m) return null
  return Number.parseInt(m[1], 16) >>> 0
}

export function resolveMeshtasticPlaintextDestination(
  targetNodeEnabled: boolean,
  nodeIdRaw: string
): number | 'broadcast' | null {
  if (!targetNodeEnabled) return 'broadcast'
  const n = parseMeshtasticNodeIdToNumber(nodeIdRaw)
  if (n === null) return null
  return n
}
