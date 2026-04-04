'use client'

import { Toaster } from 'sonner'

/** Globale Toasts (z. B. Basis wieder erreichbar) – Theme folgt globals.css. */
export function AppToaster() {
  return <Toaster position="top-center" richColors closeButton duration={4_000} />
}
