import type { RefObject } from 'react'

/** Datei-Dialog nach Radix-Dropdown: synchroner click() verliert oft das change-Event. */
export function triggerHiddenFileInput(ref: RefObject<HTMLInputElement | null>): void {
  window.setTimeout(() => {
    ref.current?.click()
  }, 0)
}
