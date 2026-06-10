/** Seed-QR für Helfer nach Handoff-ZIP — siehe docs/SEED-SETUP-QR-SCHEMA.md */

export const SEED_SETUP_QR_KIND = 'ms' as const
/** Semantische Schema-ID (unabhängig von Payload-Feld `v`). */
export const SEED_SETUP_QR_SCHEMA = 'morgendrot-seed-setup-v1' as const
export const SEED_SETUP_QR_VERSION = 1 as const

export type SeedSetupQrPayload = {
  /** Payload-Version — Parser akzeptiert nur `1`. */
  v: typeof SEED_SETUP_QR_VERSION
  /** Schema-ID für Doku/Migration (redundant zu v, aber explizit). */
  s: typeof SEED_SETUP_QR_SCHEMA
  k: typeof SEED_SETUP_QR_KIND
  /** Mnemonic, Bech32-Secret oder 64-Hex — nie in Handoff-ZIP. */
  w: string
  /** Erwartete IOTA-Adresse (Helfer kann abgleichen). */
  a?: string
}

export function buildSeedSetupQrText(opts: { seedImport: string; address?: string }): string {
  const w = String(opts.seedImport || '').trim()
  const a = String(opts.address || '').trim()
  const payload: SeedSetupQrPayload = {
    v: SEED_SETUP_QR_VERSION,
    s: SEED_SETUP_QR_SCHEMA,
    k: SEED_SETUP_QR_KIND,
    w,
  }
  if (a) payload.a = a
  return JSON.stringify(payload)
}

export function parseSeedSetupFromQrText(raw: string): { seedImport: string; address?: string } | null {
  const text = String(raw || '').trim()
  if (!text) return null
  try {
    const j = JSON.parse(text) as Partial<SeedSetupQrPayload>
    if (j.v !== SEED_SETUP_QR_VERSION || j.k !== SEED_SETUP_QR_KIND) return null
    if (j.s != null && j.s !== SEED_SETUP_QR_SCHEMA) return null
    const seedImport = String(j.w || '').trim()
    if (!seedImport) return null
    const address = String(j.a || '').trim() || undefined
    return { seedImport, address }
  } catch {
    return null
  }
}
