'use client'

import { useCallback, useState } from 'react'
import { isCapacitorNativePlatform } from '@/frontend/lib/capacitor-platform'
import { scheduleReleaseStuckModalPointerEvents } from '@/frontend/lib/release-modal-pointer-events'

/** Radix modal={false} auf APK + Open-State für natives Overlay (alle Dialoge/Sheets). */
export function useCapacitorRadixOverlayState(p: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const native = isCapacitorNativePlatform()
  const [internalOpen, setInternalOpen] = useState(p.defaultOpen ?? false)
  const controlled = p.open !== undefined
  const isOpen = controlled ? p.open : internalOpen

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!controlled) setInternalOpen(next)
      if (!next && native) scheduleReleaseStuckModalPointerEvents()
      p.onOpenChange?.(next)
    },
    [controlled, native, p.onOpenChange]
  )

  return {
    native,
    isOpen: Boolean(isOpen),
    radixOpen: controlled ? p.open : internalOpen,
    handleOpenChange,
    radixModal: !native,
  }
}
