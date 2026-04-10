'use client'

import { toast } from 'sonner'
import { toAppError, type AppError } from '@/frontend/lib/app-error'

export function toastFromAppError(err: AppError): void {
  toast.error(err.message)
}

/** Normalisiert `unknown` → `AppError` und zeigt eine Sonner-Meldung (Client-only). */
export function toastFromUnknown(e: unknown, fallbackCode = 'UNKNOWN'): AppError {
  const a = toAppError(e, fallbackCode)
  toast.error(a.message)
  return a
}
