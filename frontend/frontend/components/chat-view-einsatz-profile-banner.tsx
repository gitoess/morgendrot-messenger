'use client'

/**
 * § H.24b P2/P3 Adoption — dauerhaft sichtbarer Einsatz-Hinweis (Spec §3.4).
 */

import { Building2 } from 'lucide-react'
import { useActiveEinsatzProfile } from '@/frontend/hooks/use-active-einsatz-profile'
import { shortPackageId } from '@/frontend/lib/package-profile-registry'

export function ChatViewEinsatzProfileBanner() {
  const profile = useActiveEinsatzProfile()
  if (!profile) return null

  const accent = profile.color || '#b45309'

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm"
      style={{
        borderColor: `${accent}66`,
        backgroundColor: `${accent}14`,
      }}
    >
      <Building2 className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
      <p className="min-w-0 text-foreground">
        <span className="text-muted-foreground">Einsatz:</span>{' '}
        <span className="font-semibold">{profile.label}</span>
        {profile.resolved ? (
          <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
            ({shortPackageId(profile.packageId)})
          </span>
        ) : (
          <span className="ml-1.5 text-xs text-amber-700 dark:text-amber-300">— nicht konfiguriert</span>
        )}
      </p>
    </div>
  )
}
