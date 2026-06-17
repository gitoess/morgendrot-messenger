'use client'

import { useLayoutEffect } from 'react'
import {
  applyMessengerAppearance,
  readMessengerAppearanceId,
} from '@/frontend/lib/messenger-appearance-theme'

/** Wendet gespeichertes Erscheinungsbild auf <html> an (nach SSR, vor Paint wo möglich). */
export function MessengerAppearanceBootstrap() {
  useLayoutEffect(() => {
    applyMessengerAppearance(readMessengerAppearanceId())
  }, [])
  return null
}
