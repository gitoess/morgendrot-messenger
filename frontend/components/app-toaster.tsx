'use client'

import { useEffect } from 'react'
import { Toaster } from 'sonner'
import { ensureUiTapFeedbackInstalled } from '@/frontend/lib/ui-tap-feedback'

/** Globale Toasts (z. B. Basis wieder erreichbar) – Theme folgt globals.css. */
export function AppToaster() {
  useEffect(() => {
    ensureUiTapFeedbackInstalled()
  }, [])
  return <Toaster position="top-center" richColors closeButton duration={4_000} />
}
