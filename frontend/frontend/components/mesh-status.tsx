'use client'

import { Globe, Radio, Smartphone, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Transport-/Privacy-Indikator: Tor/VPN wenn Backend SOCKS/HTTP-Proxy aktiv oder NEXT_PUBLIC_PRIVACY_TOR=1. */
export type MeshPathMode = 'internet' | 'tor' | 'lora' | 'ble' | 'offline'

const styles: Record<
  MeshPathMode,
  { Icon: typeof Globe; label: string; className: string }
> = {
  internet: {
    Icon: Globe,
    label: 'Internet',
    className: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  },
  tor: {
    Icon: Globe,
    label: 'Tor/VPN',
    className: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-400',
  },
  lora: {
    Icon: Radio,
    label: 'LoRa',
    className: 'bg-amber-500/15 text-amber-800 dark:text-amber-400',
  },
  ble: {
    Icon: Smartphone,
    label: 'BLE',
    className: 'bg-violet-500/15 text-violet-800 dark:text-violet-400',
  },
  offline: {
    Icon: WifiOff,
    label: 'Offline',
    className: 'bg-red-500/15 text-red-700 dark:text-red-400',
  },
}

export function MeshStatus({ mode, subtitle }: { mode: MeshPathMode; subtitle?: string }) {
  const { Icon, label, className } = styles[mode]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        className
      )}
      title={subtitle}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  )
}
