/** § H.33e — Boss-Batch-Modus aus Env (Klartext oder verschlüsseltes Self-Archiv). */
export type ForensicBatchArchiveMode = 'plaintext' | 'encrypted'

export function forensicBatchModeFromEnv(): ForensicBatchArchiveMode {
  const v = (process.env.FORENSIC_BATCH_MODE ?? 'plaintext').trim().toLowerCase()
  return v === 'encrypted' ? 'encrypted' : 'plaintext'
}

export function parseForensicBatchModeInput(raw: unknown): ForensicBatchArchiveMode | undefined {
  if (raw === 'encrypted' || raw === 'plaintext') return raw
  return undefined
}
