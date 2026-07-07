'use client'

import type { ReactNode } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { NativeModalShell } from '@/frontend/components/native-modal-shell'
import { scheduleReleaseStuckModalPointerEvents } from '@/frontend/lib/release-modal-pointer-events'

const PANEL_CLASS =
  'flex max-h-[min(92vh,720px)] w-[calc(100%-1.5rem)] max-w-md flex-col gap-0 overflow-hidden border border-border/80 bg-background p-0 shadow-lg sm:max-w-md'

export { VAULT_OVERLAY_ATTR } from '@/frontend/components/native-modal-shell'

/** APK: festes Overlay (Portal auf body) — kein Radix, kein durchklickbarer Hintergrund. */
export function VaultUnlockShell(p: {
  open: boolean
  nativeOverlay: boolean
  stackedOverModal?: boolean
  onDismiss?: () => void
  children: ReactNode
}) {
  if (!p.open) return null

  if (p.nativeOverlay) {
    return (
      <NativeModalShell open={p.open} enabled panelClassName={PANEL_CLASS}>
        {p.children}
      </NativeModalShell>
    )
  }

  return (
    <Dialog
      open={p.open}
      modal={!p.stackedOverModal}
      onOpenChange={(open) => {
        if (!open) {
          scheduleReleaseStuckModalPointerEvents()
          p.onDismiss?.()
        }
      }}
    >
      <DialogContent
        className={PANEL_CLASS}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => p.open && e.preventDefault()}
      >
        {p.children}
      </DialogContent>
    </Dialog>
  )
}
