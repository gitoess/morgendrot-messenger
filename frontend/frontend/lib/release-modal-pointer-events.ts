'use client'

import { VAULT_OVERLAY_ATTR } from '@/frontend/components/native-modal-shell'
import { clearStuckRadixBodyLockAttrs } from '@/frontend/lib/release-modal-pointer-events-attrs'
import { forceReleaseNativeBodyLock } from '@/frontend/lib/native-body-lock'

const MAX_DIALOG_CLOSE_WAIT_MS = 600
const DIALOG_CLOSE_POLL_MS = 50

function countOpenDialogSurfaces(): number {
  if (typeof document === 'undefined') return 0
  const dialogs = document.querySelectorAll('[data-slot="dialog-content"][data-state="open"]').length
  const sheets = document.querySelectorAll('[data-slot="sheet-content"][data-state="open"]').length
  return dialogs + sheets
}

/** Verwaiste Radix-Overlays (APK: Chat wirkt „eingefroren“, obwohl kein Dialog offen ist). */
export function purgeOrphanRadixOverlays(): void {
  if (typeof document === 'undefined') return
  if (isNativeVaultOverlayOpen()) return
  if (countOpenDialogSurfaces() > 0) return
  document.querySelectorAll('[data-slot="dialog-overlay"], [data-slot="sheet-overlay"]').forEach((el) => el.remove())
  document.querySelectorAll('[data-radix-focus-guard]').forEach((el) => el.remove())
  document.querySelectorAll('[data-morgendrot-native-modal-overlay]').forEach((el) => {
    if (!el.querySelector('[data-morgendrot-native-modal-panel]')) el.remove()
  })
}

export function isNativeVaultOverlayOpen(): boolean {
  if (typeof document === 'undefined') return false
  return document.querySelector(`[${VAULT_OVERLAY_ATTR}]`) != null
}

/** Radix body-lock entfernen — auch bei offenem nativen Modal (sonst APK: sichtbar aber passiv). */
export function clearStuckRadixBodyLock(): void {
  forceReleaseNativeBodyLock()
  clearStuckRadixBodyLockAttrs()
}

/** Nach geschachtelten Radix-Dialogen kann body pointer-events hängen bleiben — APK wirkt „eingefroren“. */
export function releaseStuckModalPointerEvents(opts?: { force?: boolean }): void {
  if (typeof document === 'undefined') return
  const vaultOpen = isNativeVaultOverlayOpen()
  if (!opts?.force && !vaultOpen && countOpenDialogSurfaces() > 0) return

  clearStuckRadixBodyLock()

  purgeOrphanRadixOverlays()

  if (!vaultOpen && countOpenDialogSurfaces() === 0) {
    document.querySelectorAll('[data-slot="dialog-overlay"]').forEach((el) => el.remove())
    document.querySelectorAll('[data-slot="sheet-overlay"]').forEach((el) => el.remove())
    document.querySelectorAll('[data-radix-focus-guard]').forEach((el) => el.remove())
  }
}

function releaseAfterDialogsClosed(deadlineMs: number): void {
  if (isNativeVaultOverlayOpen()) {
    clearStuckRadixBodyLock()
    return
  }
  if (countOpenDialogSurfaces() > 0) {
    if (Date.now() < deadlineMs) {
      window.setTimeout(() => releaseAfterDialogsClosed(deadlineMs), DIALOG_CLOSE_POLL_MS)
    }
    return
  }
  releaseStuckModalPointerEvents({ force: true })
}

/** Nach setLocked(false): Dialog-Unmount abwarten, dann Overlays bereinigen. */
export function scheduleReleaseStuckModalPointerEvents(): void {
  if (typeof window === 'undefined') return
  const deadlineMs = Date.now() + MAX_DIALOG_CLOSE_WAIT_MS
  requestAnimationFrame(() => {
    requestAnimationFrame(() => releaseAfterDialogsClosed(deadlineMs))
  })
}
