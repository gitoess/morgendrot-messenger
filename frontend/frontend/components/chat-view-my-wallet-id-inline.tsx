'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'
import { LazyPeeringQrActions } from '@/frontend/components/lazy/messenger-scope-b'
import { ChatViewMyTelegramInline } from '@/frontend/components/chat-view-my-telegram-inline'

/** Meine Kontakt-ID + Peering-QR (Sidebar „Meine Daten“). */
export type ChatViewMyWalletIdInlineProps = {
  myAddressLine: string
  displayName?: string
  /** Eigene Telegram Chat-ID (Telefonbuch). */
  myTelegramChatId?: string | null
  onPeeringImported?: (r: {
    address: string
    displayName?: string
    peerPubStored: boolean
    networkApplied?: string[]
  }) => void
  onPeeringStatus?: (msg: string) => void
  variant?: 'compact' | 'panel'
}

export function ChatViewMyWalletIdInline(p: ChatViewMyWalletIdInlineProps) {
  const full = (p.myAddressLine || '').trim()
  const valid = /^0x[a-fA-F0-9]{64}$/i.test(full)
  const [copied, setCopied] = useState(false)
  const panel = p.variant === 'panel'

  if (!valid) return null

  const copy = () => {
    void navigator.clipboard.writeText(full).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div
      className={
        panel
          ? 'flex w-full min-w-0 flex-col gap-3'
          : 'flex w-full min-w-0 flex-col gap-2 border-t border-border/50 pt-1.5 sm:w-auto sm:min-w-[14rem]'
      }
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span className={panel ? 'text-xs font-semibold text-muted-foreground' : 'text-[10px] text-muted-foreground'}>
          Meine Kontakt-ID
        </span>
        <div className="flex min-w-0 items-center gap-2">
          <code
            className={
              panel
                ? 'truncate font-mono text-sm text-foreground'
                : 'truncate font-mono text-[10px] text-foreground/85'
            }
            title={full}
          >
            {maskWalletAddress(full, 8, 6)}
          </code>
          <button
            type="button"
            onClick={copy}
            className={
              panel
                ? 'inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted'
                : 'shrink-0 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground'
            }
            title="Volle 0x-Adresse kopieren"
          >
            {copied ? (
              <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" aria-hidden />
                Kopiert
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5">
                <Copy className="h-3.5 w-3.5" aria-hidden />
                Kopieren
              </span>
            )}
          </button>
        </div>
      </div>
      <LazyPeeringQrActions
        myAddress={full}
        displayName={p.displayName}
        onImported={p.onPeeringImported}
        onStatus={p.onPeeringStatus}
        className={panel ? 'flex flex-col gap-2 [&_button]:min-h-[2.75rem] [&_button]:text-sm [&_button]:font-semibold' : 'flex flex-wrap gap-1.5'}
      />
      <ChatViewMyTelegramInline
        myTelegramChatId={p.myTelegramChatId}
        variant={panel ? 'panel' : 'compact'}
      />
    </div>
  )
}
