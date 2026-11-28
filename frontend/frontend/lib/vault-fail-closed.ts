/**
 * Fail-closed Messenger-Oberfläche — Produktregel: nur zwei sichtbare Zustände:
 * - bereit = UI nutzbar
 * - gesperrt = Scrim + Passwort (Hard-Lock, Soft-Pause, oder Browser-PW fehlt nach F5)
 * @see docs/IDEEN-BACKLOG.md „Tresor gesperrt → Messenger-Overlay“
 */

export type VaultFailClosedGateInput = {
  /** Hard-Lock: Backend-/Session-Tresor gesperrt */
  vaultSessionLocked: boolean
  /** Weich: UI gesperrt, Secrets im RAM */
  privacySoftLocked?: boolean
  /**
   * Badge zeigt „gesperrt“, API oft noch offen (z. B. nach F5 ohne Browser-PW-Sitzung).
   * Muss Scrim auslösen — sonst „gesperrt“-Label bei voll bedienbarer UI.
   */
  browserVaultPasswordMissing?: boolean
  /** Helper-Seed-Dialog ersetzt Unlock */
  suppressForHelperSeed?: boolean
  /** Onboarding-Wizard offen und Unlock unterdrückt */
  suppressForOnboardingWizard?: boolean
}

/** Wann Scrim + pointer-events:none auf die Messenger-Hauptfläche. */
export function shouldApplyVaultFailClosedOverlay(input: VaultFailClosedGateInput): boolean {
  const locked = Boolean(
    input.vaultSessionLocked ||
      input.privacySoftLocked ||
      input.browserVaultPasswordMissing
  )
  if (!locked) return false
  if (input.suppressForHelperSeed) return false
  if (input.suppressForOnboardingWizard) return false
  return true
}
