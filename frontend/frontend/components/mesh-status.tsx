'use client'

import { Globe, Radio, Smartphone, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppTranslation } from '@/frontend/lib/i18n/hooks'

/** Transport-/Privacy-Indikator: Tor/VPN wenn Backend SOCKS/HTTP-Proxy aktiv oder NEXT_PUBLIC_PRIVACY_TOR=1. */
export type MeshPathMode = 'internet' | 'tor' | 'lora' | 'ble' | 'offline'

const modeStyles: Record<
  MeshPathMode,
  { Icon: typeof Globe; className: string; labelKey: `mesh.${MeshPathMode}` }
> = {
  internet: {
    Icon: Globe,
    className: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
    labelKey: 'mesh.internet',
  },
  tor: {
    Icon: Globe,
    className: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-400',
    labelKey: 'mesh.tor',
  },
  lora: {
    Icon: Radio,
    className: 'bg-amber-500/15 text-amber-800 dark:text-amber-400',
    labelKey: 'mesh.lora',
  },
  ble: {
    Icon: Smartphone,
    className: 'bg-violet-500/15 text-violet-800 dark:text-violet-400',
    labelKey: 'mesh.ble',
  },
  offline: {
    Icon: WifiOff,
    className: 'bg-red-500/15 text-red-700 dark:text-red-400',
    labelKey: 'mesh.offline',
  },
}

export function MeshStatus({ mode, subtitle }: { mode: MeshPathMode; subtitle?: string }) {
  const { t } = useAppTranslation('dashboard')
  const { Icon, className, labelKey } = modeStyles[mode]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        className
      )}
      title={subtitle}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {t(labelKey)}
    </span>
  )
}
