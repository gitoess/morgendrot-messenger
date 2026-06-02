'use client'

import { useMemo } from 'react'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import {
  type ContactSendMailboxTarget,
  buildSendMailboxTargetOptions,
  readContactSendMailboxTarget,
  writeContactSendMailboxTarget,
} from '@/frontend/lib/contact-mailbox-slots'
import { resolveOutboundMailboxObjectId } from '@/frontend/lib/outbound-mailbox-routing'

export type ChatViewContactSendMailboxSelectProps = {
  recipientWallet: string
  contactDirectory: Record<string, ContactMeshEntryClient>
  serverMailboxId?: string
  className?: string
  onTargetChange?: () => void
}

export function ChatViewContactSendMailboxSelect(p: ChatViewContactSendMailboxSelectProps) {
  const { recipientWallet, contactDirectory, serverMailboxId, className, onTargetChange } = p
  const wallet = recipientWallet.trim().toLowerCase()
  const entry = /^0x[a-f0-9]{64}$/.test(wallet) ? contactDirectory[wallet] : undefined

  const options = useMemo(
    () => buildSendMailboxTargetOptions(entry, serverMailboxId),
    [entry, serverMailboxId]
  )

  const value = useMemo(() => {
    if (!/^0x[a-f0-9]{64}$/.test(wallet)) return 'event' as ContactSendMailboxTarget
    return readContactSendMailboxTarget(wallet) ?? 'event'
  }, [wallet])

  if (!/^0x[a-f0-9]{64}$/.test(wallet) || options.length === 0) return null

  const resolvedMb = resolveOutboundMailboxObjectId(contactDirectory, wallet, value)

  return (
    <div className={className}>
      <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
        Speicher auf der Chain
      </label>
      <select
        value={value}
        onChange={(e) => {
          writeContactSendMailboxTarget(wallet, e.target.value as ContactSendMailboxTarget)
          onTargetChange?.()
        }}
        className="w-full rounded-lg border border-border bg-input px-2.5 py-2 font-mono text-[11px]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {!resolvedMb ? (
        <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">
          Gewähltes Postfach leer — es gilt Fallback (eigene aktive oder Server-Shared).
        </p>
      ) : null}
    </div>
  )
}
