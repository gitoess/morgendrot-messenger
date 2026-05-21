'use client'

import { useEffect, useMemo } from 'react'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import {
  type ContactSendMailboxTarget,
  buildSendMailboxTargetOptions,
  defaultContactSendSlot,
  readContactSendMailboxTarget,
  writeContactSendMailboxTarget,
} from '@/frontend/lib/contact-mailbox-slots'
import { resolveOutboundMailboxObjectId } from '@/frontend/lib/outbound-mailbox-routing'

export type ChatViewContactSendMailboxSelectProps = {
  recipientWallet: string
  contactDirectory: Record<string, ContactMeshEntryClient>
  serverMailboxId?: string
  className?: string
}

export function ChatViewContactSendMailboxSelect(p: ChatViewContactSendMailboxSelectProps) {
  const { recipientWallet, contactDirectory, serverMailboxId, className } = p
  const wallet = recipientWallet.trim().toLowerCase()
  const entry = /^0x[a-f0-9]{64}$/.test(wallet) ? contactDirectory[wallet] : undefined

  const options = useMemo(
    () => buildSendMailboxTargetOptions(entry, serverMailboxId),
    [entry, serverMailboxId]
  )

  const value = useMemo(() => {
    if (!/^0x[a-f0-9]{64}$/.test(wallet)) return 'own' as ContactSendMailboxTarget
    return readContactSendMailboxTarget(wallet) ?? defaultContactSendSlot(entry)
  }, [wallet, entry])

  useEffect(() => {
    if (!/^0x[a-f0-9]{64}$/.test(wallet)) return
    if (readContactSendMailboxTarget(wallet)) return
    writeContactSendMailboxTarget(wallet, defaultContactSendSlot(entry))
  }, [wallet, entry])

  if (!/^0x[a-f0-9]{64}$/.test(wallet) || options.length === 0) return null

  const resolvedMb = resolveOutboundMailboxObjectId(contactDirectory, wallet, value)

  return (
    <div className={className}>
      <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
        Ziel-Postfach (Kontakt)
      </label>
      <select
        value={value}
        onChange={(e) => writeContactSendMailboxTarget(wallet, e.target.value as ContactSendMailboxTarget)}
        className="w-full rounded-lg border border-border bg-input px-2.5 py-2 font-mono text-[11px]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {resolvedMb ? (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Senden an Mailbox{' '}
          <span className="font-mono text-foreground">
            {resolvedMb.slice(0, 10)}…{resolvedMb.slice(-6)}
          </span>
          {' '}
          (Empfänger-Wallet unverändert)
        </p>
      ) : (
        <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">
          Gewähltes Postfach leer — es gilt Fallback (eigene aktive oder Server-Shared).
        </p>
      )}
    </div>
  )
}
