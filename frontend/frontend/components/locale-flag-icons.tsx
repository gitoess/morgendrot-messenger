'use client'

import { cn } from '@/lib/utils'

/** Deutschland — horizontale Streifen (SVG, plattformunabhängig). */
export function FlagDe({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 640 480" className={cn('block h-full w-full', className)} aria-hidden>
      <rect width="640" height="160" y="0" fill="#000" />
      <rect width="640" height="160" y="160" fill="#D00" />
      <rect width="640" height="160" y="320" fill="#FFCE00" />
    </svg>
  )
}

/** Englisch — Union Jack (vereinfacht). */
export function FlagEn({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 640 480" className={cn('block h-full w-full', className)} aria-hidden>
      <rect width="640" height="480" fill="#012169" />
      <path d="M0 0 L640 480 M640 0 L0 480" stroke="#FFF" strokeWidth="96" />
      <path d="M0 0 L640 480 M640 0 L0 480" stroke="#C8102E" strokeWidth="64" />
      <path d="M320 0 V480 M0 240 H640" stroke="#FFF" strokeWidth="160" />
      <path d="M320 0 V480 M0 240 H640" stroke="#C8102E" strokeWidth="96" />
    </svg>
  )
}

export const LOCALE_FLAG_ICONS = {
  de: FlagDe,
  en: FlagEn,
} as const
