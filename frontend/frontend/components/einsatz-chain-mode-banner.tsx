'use client'

import { useEffect, useState } from 'react'
import { describeEinsatzChainModeBanner } from '@morgendrot/shared/einsatz-chain-mode'
import { resolveActiveEinsatzChainMode } from '@/frontend/lib/einsatz-chain-mode-local'
import { cn } from '@/lib/utils'

export function EinsatzChainModeBanner(p: { rpcUrl?: string; className?: string }) {
  const [mode, setMode] = useState(() => resolveActiveEinsatzChainMode())

  useEffect(() => {
    setMode(resolveActiveEinsatzChainMode())
    const refresh = () => setMode(resolveActiveEinsatzChainMode())
    window.addEventListener('morgendrot.standaloneHandoffApplied', refresh)
    window.addEventListener('morgendrot:einsatz-network-profiles-changed', refresh)
    return () => {
      window.removeEventListener('morgendrot.standaloneHandoffApplied', refresh)
      window.removeEventListener('morgendrot:einsatz-network-profiles-changed', refresh)
    }
  }, [])

  const banner = describeEinsatzChainModeBanner(mode, p.rpcUrl)
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2 text-xs',
        banner.tone === 'testnet' && 'border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100',
        banner.tone === 'mainnet' && 'border-sky-500/35 bg-sky-500/10 text-sky-950 dark:text-sky-100',
        banner.tone === 'neutral' && 'border-border bg-muted/30 text-muted-foreground',
        p.className
      )}
      role="status"
    >
      <p className="font-semibold">{banner.title}</p>
      <p className="mt-0.5 opacity-90">{banner.detail}</p>
    </div>
  )
}
