import type { ContactMeshEntryClient } from '@/frontend/lib/api'

const WALLET = /^0x[a-f0-9]{64}$/i

/** Vorschau für Funk-Export — entspricht `meshSubsetForExport` auf dem Server. */
export function countMeshExportCandidates(directory: Record<string, ContactMeshEntryClient>): {
  walletContacts: number
  withMeshData: number
} {
  let walletContacts = 0
  let withMeshData = 0
  for (const [addr, entry] of Object.entries(directory)) {
    const a = addr.trim()
    if (!WALLET.test(a)) continue
    walletContacts += 1
    if (
      entry.meshNodeId?.trim() ||
      entry.meshPublicKeyHex?.trim() ||
      entry.bleUuid?.trim()
    ) {
      withMeshData += 1
    }
  }
  return { walletContacts, withMeshData }
}

export function meshExportSummaryLine(stats: {
  walletContacts: number
  withMeshData: number
}): string {
  if (stats.walletContacts === 0) {
    return 'Keine IOTA-Kontakte im Telefonbuch — nichts zu exportieren.'
  }
  if (stats.withMeshData === 0) {
    return `${stats.walletContacts} IOTA-Kontakt(e), aber keine Funk-Daten (Node-ID) hinterlegt.`
  }
  return `Alle IOTA-Kontakte mit Funk-Daten: ${stats.withMeshData} von ${stats.walletContacts} Eintrag/Einträgen (Name + Node-ID, verschlüsselt). Telegram und Mailbox-IDs sind nicht enthalten.`
}
