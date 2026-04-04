/**
 * „Wald-Check“: grobe Verbindungslage für den Chat (ohne neue API).
 * - grün: GET /api/status erreichbar (Basis online)
 * - blau: Basis offline, aber Meshtastic/BLE verbunden (Funkpfad)
 * - rot: weder Basis noch Funk
 */
export type WaldConnectionTier = 'green' | 'blue' | 'red'

export function computeWaldConnectionTier(
  basisUnreachable: boolean,
  meshBleConnected: boolean
): WaldConnectionTier {
  if (!basisUnreachable) return 'green'
  if (meshBleConnected) return 'blue'
  return 'red'
}
