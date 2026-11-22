/**
 * Fail-closed Messenger-Oberfläche bei Hard-Lock (`apiStatus.locked` / Session locked).
 * Soft-Lock (Privacy) bleibt absichtlich außerhalb — Chat dort lesbar.
 * @see docs/IDEEN-BACKLOG.md „Tresor gesperrt → Messenger-Overlay“
 */

export type VaultFailClosedGateInput = {
  /** Hard-Lock: Backend-/Session-Tresor gesperrt */
  vaultSessionLocked: boolean
  /** Helper-Seed-Dialog ersetzt Unlock */
  suppressForHelperSeed?: boolean
  /** Onboarding-Wizard offen und Unlock unterdrückt */
  suppressForOnboardingWizard?: boolean
}

/** Wann Scrim + pointer-events:none auf die Messenger-Hauptfläche. */
export function shouldApplyVaultFailClosedOverlay(input: VaultFailClosedGateInput): boolean {
  if (!input.vaultSessionLocked) return false
  if (input.suppressForHelperSeed) return false
  if (input.suppressForOnboardingWizard) return false
  return true
}
