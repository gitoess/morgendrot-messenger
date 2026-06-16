/** Phase-2: E2EE-Partner (0x) — getrennt vom Composer-Empfängerfeld. */
export type ComposerPartnerPort = {
  readonly partner: string
}

export function asComposerPartner(partner: string): ComposerPartnerPort {
  return { partner }
}
