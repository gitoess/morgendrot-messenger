/**
 * Fail-closed Messenger-Oberfläche:
 * - Hard-Lock (`apiStatus.locked`) → Unlock-Dialog
 * - Soft-Pause (Badge) → Scrim; Weitersprechen nach Passwort (RAM bleibt)
 * @see docs/IDEEN-BACKLOG.md „Tresor gesperrt → Messenger-Overlay“
 */

export type VaultFailClosedGateInput = {
  /** Hard-Lock: Backend-/Session-Tresor gesperrt */
  vaultSessionLocked: boolean
  /** Weich: UI gesperrt, Secrets im RAM */
  privacySoftLocked?: boolean
  /** Helper-Seed-Dialog ersetzt Unlock */
  suppressForHelperSeed?: boolean
  /** Onboarding-Wizard offen und Unlock unterdrückt */
  suppressForOnboardingWizard?: boolean
}

/** Wann Scrim + pointer-events:none auf die Messenger-Hauptfläche. */
export function shouldApplyVaultFailClosedOverlay(input: VaultFailClosedGateInput): boolean {
  const locked = Boolean(input.vaultSessionLocked || input.privacySoftLocked)
  if (!locked) return false
  if (input.suppressForHelperSeed) return false
  if (input.suppressForOnboardingWizard) return false
  return true
}
