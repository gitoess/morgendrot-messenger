export const SIGNER_IMPORT_REQUIRED_CODE = 'SIGNER_IMPORT_REQUIRED' as const

export type DashboardUnlockMode = 'vault' | 'import' | 'create'

export function normalizeSignerWords(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
}

export function countSignerWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

/** Genug für POST /api/unlock (Mnemonic ≥12 Wörter oder Hex32 / langes Bech32-Secret). */
export function isPlausibleSdkImport(s: string): boolean {
  const t = s.trim()
  if (!t) return false
  if (countSignerWords(t) >= 12) return true
  const hex = t.replace(/^0x/i, '').replace(/\s+/g, '')
  if (/^[a-fA-F0-9]{64}$/i.test(hex)) return true
  if (!/\s/.test(t) && t.length >= 60 && /^[a-z]{2,30}1[02-9ac-hj-np-z]+$/i.test(t)) return true
  return false
}
