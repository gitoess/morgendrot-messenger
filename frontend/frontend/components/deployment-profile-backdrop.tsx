'use client'

import type { ReactNode } from 'react'
import type { ApiStatus } from '@/frontend/lib/api/status'
import { resolveDeploymentProfileTheme } from '@/frontend/lib/deployment-profile-theme'
import { cn } from '@/lib/utils'

type DeploymentProfileBackdropProps = {
  status: Pick<ApiStatus, 'handoffLabel' | 'role' | 'deploymentProfile' | 'transportProfile'> | null | undefined
  children: ReactNode
  className?: string
  /** Boss-Startseite: großes Profil-Wasserzeichen ausblenden. */
  hideWatermark?: boolean
}

/** Dezenter Profil-Hintergrund (Farbverlauf + Wasserzeichen). */
export function DeploymentProfileBackdrop({
  status,
  children,
  className,
  hideWatermark = false,
}: DeploymentProfileBackdropProps) {
  const theme = resolveDeploymentProfileTheme(status)

  return (
    <div className={cn('relative min-h-full', className)}>
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 bg-gradient-to-br',
          theme.backdropClass
        )}
      />
      {!hideWatermark ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden select-none"
        >
          <span className="text-[min(28vw,12rem)] font-black uppercase tracking-widest text-foreground/[0.035]">
            {theme.watermark}
          </span>
        </div>
      ) : null}
      <div className="relative z-[1]">{children}</div>
    </div>
  )
}
