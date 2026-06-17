'use client'

import { useEffect, useState } from 'react'
import {
    EINSATZ_NETWORK_PROFILES_CHANGED,
    networkLabel,
    readNetworkProfilesState,
    type EinsatzNetworkId,
} from '@/frontend/lib/einsatz-network-profiles'
import { cn } from '@/lib/utils'

export function ChatNetworkBadge(p: { className?: string }) {
    const [active, setActive] = useState<EinsatzNetworkId>(() => readNetworkProfilesState().active)

    useEffect(() => {
        const refresh = () => setActive(readNetworkProfilesState().active)
        refresh()
        window.addEventListener(EINSATZ_NETWORK_PROFILES_CHANGED, refresh)
        return () => window.removeEventListener(EINSATZ_NETWORK_PROFILES_CHANGED, refresh)
    }, [])

    const isMainnet = active === 'mainnet'
    const label = isMainnet ? 'Produktion' : 'Übung'

    return (
        <span
            className={cn(
                'inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-bold tracking-wide',
                isMainnet
                    ? 'border-sky-600/55 bg-sky-100 text-sky-950 dark:border-sky-400/50 dark:bg-sky-950/90 dark:text-sky-50'
                    : 'border-amber-600/55 bg-amber-100 text-amber-950 dark:border-amber-400/50 dark:bg-amber-950/90 dark:text-amber-50',
                p.className
            )}
            title={`Senden über ${networkLabel(active)}`}
            role="status"
        >
            {label} · {networkLabel(active)}
        </span>
    )
}
