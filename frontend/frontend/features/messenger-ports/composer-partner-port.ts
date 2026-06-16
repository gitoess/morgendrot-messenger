/** Phase-2: E2EE-Partner (0x) — getrennt vom Composer-Empfängerfeld. */
export type ComposerPartnerPort = {
  readonly partner: string
  readonly onPartnerChange: (v: string) => void
}

export function asComposerPartner(partner: string, onPartnerChange: (v: string) => void): ComposerPartnerPort {
  return { partner, onPartnerChange }
}
