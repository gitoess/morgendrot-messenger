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
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                isMainnet
                    ? 'border-sky-500/45 bg-sky-500/15 text-sky-900 dark:text-sky-100'
                    : 'border-amber-500/45 bg-amber-500/15 text-amber-950 dark:text-amber-100',
                p.className
            )}
            title={`Senden über ${networkLabel(active)}`}
            role="status"
        >
            {label} · {networkLabel(active)}
        </span>
    )
}
