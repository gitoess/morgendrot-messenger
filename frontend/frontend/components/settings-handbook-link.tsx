'use client'

import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

const HANDBOOK_PATH = '/handbook/EINSTELLUNGEN-NUTZER-HANDBUCH.md'

export function SettingsHandbookLink(p: { className?: string; label?: string }) {
  return (
    <Link
      href={`/handbook?doc=EINSTELLUNGEN-NUTZER-HANDBUCH.md`}
      className={cn(
        'inline-flex items-center gap-1.5 text-xs text-primary hover:underline',
        p.className
      )}
    >
      <BookOpen className="h-3.5 w-3.5" aria-hidden />
      {p.label ?? 'Erklärungen im Handbuch'}
    </Link>
  )
}

export const SETTINGS_HANDBOOK_DOC = HANDBOOK_PATH
