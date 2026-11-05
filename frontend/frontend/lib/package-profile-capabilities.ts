/**
 * § H.24a / H.24b P4 — Capabilities pro Einsatzprofil.
 *
 * Das aktive Profil kann die (aus ROLE_ID + Handoff abgeleitete) Basis-Matrix per
 * `capabilities`-Override verfeinern (z. B. „Training“ nur lesen, „Katastrophenschutz“
 * voller Transport). Reiner Merge über die vorhandene Matrix-Logik — **keine** neue
 * Rechte-Quelle, nur profilabhängige Sichtbarkeit/Transport.
 *
 * SSOT Matrix: `src/shared/messenger-capabilities-matrix.ts`, `docs/CAPABILITIES-MATRIX-ZIELBILD.md`.
 */

import {
  mergeCapabilitiesOverride,
  type MessengerCapabilitiesMatrix,
} from '@morgendrot/shared/messenger-capabilities-matrix'
import type { PackageProfile } from '@/frontend/lib/package-profile'

/** Basis-Matrix mit dem Override des aktiven Profils verfeinern (kein Profil/Override → Basis unverändert). */
export function resolveProfileCapabilities(
  base: MessengerCapabilitiesMatrix,
  profile?: PackageProfile | null
): MessengerCapabilitiesMatrix {
  return mergeCapabilitiesOverride(base, profile?.capabilities ?? null)
}

/** true, wenn das Profil überhaupt einen Capability-Override trägt. */
export function profileHasCapabilityOverride(profile?: PackageProfile | null): boolean {
  return Boolean(profile?.capabilities)
}
