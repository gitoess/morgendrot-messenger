'use client'

import { useState } from 'react'
import { Check, ChevronDown, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useAppTranslation } from '@/frontend/lib/i18n/hooks'

export function DashboardHeaderAddress({ address }: { address?: string | null }) {
  const { t } = useAppTranslation('dashboard')
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const addr = (address || '').trim()
  const addrOk = /^0x[a-fA-F0-9]{64}$/i.test(addr)
  const short = addrOk ? maskWalletAddress(addr, 6, 4) : null

  const copy = async () => {
    if (!addrOk) return
    try {
      await navigator.clipboard.writeText(addr)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  if (!addrOk) {
    return <p className="mt-1 text-[10px] text-muted-foreground/70">{t('address.notSet')}</p>
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-1">
      <CollapsibleTrigger className="group flex max-w-full items-center gap-1 rounded-md py-0.5 text-left font-mono text-[10px] text-muted-foreground/90 hover:text-muted-foreground">
        <span className="truncate">{t('address.labelWithShort', { short })}</span>
        <ChevronDown
          className={cn('h-3 w-3 shrink-0 opacity-60 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1.5 rounded-lg border border-border/70 bg-muted/25 px-2 py-2">
        <p className="break-all font-mono text-[10px] leading-relaxed text-foreground/90">{addr}</p>
        <button
          type="button"
          onClick={() => void copy()}
          className="mt-2 inline-flex items-center gap-1 rounded-md border border-border bg-background/80 px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          {copied ? t('address.copied') : t('address.copy')}
        </button>
      </CollapsibleContent>
    </Collapsible>
  )
}
