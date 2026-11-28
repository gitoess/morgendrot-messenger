/**
 * Empfänger-Lookahead: Epoch ±W → slot_tags (Spec §4).
 */
import {
  deriveStealthSlotTag,
  lookaheadStealthEpochs,
  stealthEpochHourUtc,
} from '@/frontend/lib/stealth-slot-tag'

/** Default-Fenster: ±2 Stunden (5 Tags). */
export const STEALTH_LOOKAHEAD_WINDOW_DEFAULT = 2

export function deriveStealthLookaheadSlotTags(
  sharedSecret: Uint8Array,
  opts?: { nowMs?: number; windowW?: number }
): Uint8Array[] {
  const center = stealthEpochHourUtc(opts?.nowMs)
  const epochs = lookaheadStealthEpochs(center, opts?.windowW ?? STEALTH_LOOKAHEAD_WINDOW_DEFAULT)
  return epochs.map((e) => deriveStealthSlotTag(sharedSecret, e))
}

export function stealthInboxKey(slotTagHex: string, entryId: bigint | number | string): string {
  return `stealth:${slotTagHex}:${String(entryId)}`
}
