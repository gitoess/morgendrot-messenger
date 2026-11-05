'use client'

/**
 * § H.24b P1b-Rest — aktives Profil **anwenden** (Client, kein Server-Hot-Swap §7.5).
 *
 * Aktuell: `apiBaseUrl` des Profils als Override setzen (Ebene B, §3.1 / §7.6-Risiko
 * „Helfer wählt KS, API zeigt noch Feuerwehr-Backend“). Der Override ist der reale
 * Mechanismus auf **Native/APK**; auf PC mit Next-Rewrites bewusst überspringbar.
 */

import { applyInstallQrApiBase } from '@/frontend/lib/install-qr'
import type { PackageProfile } from '@/frontend/lib/package-profile'

export type ProfileApplicationPlan = {
  apiBaseUrl?: string
  warnings: string[]
}

/** Rein: was ein Profilwechsel anfassen würde (ohne Seiteneffekt). */
export function planProfileApplication(profile: PackageProfile): ProfileApplicationPlan {
  const warnings: string[] = []
  const plan: ProfileApplicationPlan = { warnings }
  if (profile.apiBaseUrl) {
    plan.apiBaseUrl = profile.apiBaseUrl
  } else {
    warnings.push('Kein API-Base im Profil — Basis-URL bleibt unverändert.')
  }
  if (!profile.resolved) {
    warnings.push('Profil hat keine gültigen Chain-IDs (Package/Mailbox) — nur Anzeige, kein einsatzbereiter Wechsel.')
  }
  return plan
}

export type ProfileApplicationResult = {
  apiBaseApplied?: string
  apiBaseError?: string
  /** true, wenn ein `apiBaseUrl` da war, aber bewusst nicht gesetzt wurde (PC/Rewrites). */
  apiBaseSkipped?: boolean
  warnings: string[]
}

/** Profil anwenden. `applyApiBase` (Default true) steuert den `API_BASE`-Override. */
export function applyPackageProfile(
  profile: PackageProfile,
  opts?: { applyApiBase?: boolean }
): ProfileApplicationResult {
  const plan = planProfileApplication(profile)
  const result: ProfileApplicationResult = { warnings: [...plan.warnings] }
  const applyApiBase = opts?.applyApiBase !== false
  if (plan.apiBaseUrl) {
    if (!applyApiBase) {
      result.apiBaseSkipped = true
    } else {
      const r = applyInstallQrApiBase(plan.apiBaseUrl)
      if (r.ok) result.apiBaseApplied = plan.apiBaseUrl
      else result.apiBaseError = r.error
    }
  }
  return result
}
