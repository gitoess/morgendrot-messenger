'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'

/** Dezente Kontakt-ID unter online / funk / adhoc. */
export function ChatViewMyWalletIdInline(p: { myAddressLine: string }) {
  const full = (p.myAddressLine || '').trim()
  const valid = /^0x[a-fA-F0-9]{64}$/i.test(full)
  const [copied, setCopied] = useState(false)

  if (!valid) return null

  const copy = () => {
    void navigator.clipboard.writeText(full).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-0.5 border-t border-border/50 pt-1.5 sm:w-auto sm:min-w-[14rem]">
      <span className="text-[10px] text-muted-foreground">Meine Kontakt-ID</span>
      <div className="flex min-w-0 items-center gap-1.5">
        <code className="truncate font-mono text-[10px] text-foreground/85" title={full}>
          {maskWalletAddress(full, 8, 6)}
        </code>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Volle 0x-Adresse kopieren"
        >
          {copied ? (
            <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3" aria-hidden />
              OK
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5">
              <Copy className="h-3 w-3" aria-hidden />
              Kopieren
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
