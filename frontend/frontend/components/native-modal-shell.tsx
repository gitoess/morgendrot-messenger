'use client'

import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { acquireNativeBodyLock, releaseNativeBodyLock } from '@/frontend/lib/native-body-lock'

export const NATIVE_MODAL_OVERLAY_ATTR = 'data-morgendrot-native-modal-overlay' as const
export const NATIVE_MODAL_PANEL_ATTR = 'data-morgendrot-native-modal-panel' as const

/** Tresor nutzt dasselbe Attribut — einheitliche Erkennung für Pointer-Event-Cleanup. */
export const VAULT_OVERLAY_ATTR = NATIVE_MODAL_OVERLAY_ATTR

export const NativeOverlayOpenContext = createContext(false)

export { forceReleaseNativeBodyLock } from '@/frontend/lib/native-body-lock'

function useNativeModalBodyLock(open: boolean, enabled: boolean) {
  useEffect(() => {
    if (!open || !enabled) return
    acquireNativeBodyLock()
    return () => releaseNativeBodyLock()
  }, [open, enabled])
}

/** APK: festes Overlay auf body — kein Radix body-lock. */
export function NativeModalShell(p: {
  open: boolean
  enabled: boolean
  panelClassName: string
  placement?: 'center' | 'bottom'
  children: ReactNode
}) {
  useNativeModalBodyLock(p.open, p.enabled)

  if (!p.open || !p.enabled) return null

  const bottom = p.placement === 'bottom'

  const overlay = (
    <div
      className={cn(
        'fixed inset-0 z-[9999] flex p-3 sm:p-4',
        bottom ? 'items-end justify-stretch p-0 sm:p-0' : 'items-center justify-center'
      )}
      data-morgendrot-native-modal-overlay=""
      role="dialog"
      aria-modal="true"
      style={{ pointerEvents: 'auto', touchAction: 'none' }}
    >
      <div
        className="absolute inset-0 bg-black/60"
        style={{ pointerEvents: 'auto' }}
        aria-hidden
      />
      <div
        data-morgendrot-native-modal-panel=""
        className={cn(
          p.panelClassName,
          bottom && 'w-full max-w-none rounded-b-none rounded-t-xl border-b-0'
        )}
        style={{ pointerEvents: 'auto', position: 'relative', zIndex: 1, touchAction: 'auto' }}
      >
        {p.children}
      </div>
    </div>
  )

  if (typeof document === 'undefined') return overlay
  return createPortal(overlay, document.body)
}

export function useNativeOverlayOpen(): boolean {
  return useContext(NativeOverlayOpenContext)
}
