'use client'

import { useMemo } from 'react'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import {
  type ContactSendMailboxTarget,
  buildSendMailboxTargetOptions,
  readContactSendMailboxTarget,
  writeContactSendMailboxTarget,
} from '@/frontend/lib/contact-mailbox-slots'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'
import { resolveOutboundMailboxObjectId } from '@/frontend/lib/outbound-mailbox-routing'
import { composerMailboxIdForSendTarget } from '@/frontend/lib/sync-composer-mailbox-from-target'

export type ChatViewContactSendMailboxSelectProps = {
  recipientWallet: string
  contactDirectory: Record<string, ContactMeshEntryClient>
  serverMailboxId?: string
  className?: string
  /** Nach Änderung: neues Ziel + aufgelöste Object-ID (leer = Event). */
  onTargetChange?: (target: ContactSendMailboxTarget, resolvedObjectId: string) => void
}

export function ChatViewContactSendMailboxSelect(p: ChatViewContactSendMailboxSelectProps) {
  const { recipientWallet, contactDirectory, serverMailboxId, className, onTargetChange } = p
  const wallet = recipientWallet.trim().toLowerCase()
  const entry = /^0x[a-f0-9]{64}$/.test(wallet) ? contactDirectory[wallet] : undefined

  const options = useMemo(
    () => buildSendMailboxTargetOptions(entry, serverMailboxId, wallet),
    [entry, serverMailboxId, wallet]
  )

  const value = useMemo(() => {
    if (!/^0x[a-f0-9]{64}$/.test(wallet)) return 'event' as ContactSendMailboxTarget
    return readContactSendMailboxTarget(wallet) ?? 'event'
  }, [wallet])

  if (!/^0x[a-f0-9]{64}$/.test(wallet) || options.length === 0) return null

  const resolvedMb = resolveOutboundMailboxObjectId(contactDirectory, wallet, value)

  const applyTarget = (target: ContactSendMailboxTarget) => {
    writeContactSendMailboxTarget(wallet, target)
    const resolved = composerMailboxIdForSendTarget({
      recipientWallet: wallet,
      target,
      contactDirectory,
      serverMailboxId,
    })
    onTargetChange?.(target, resolved)
  }

  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        Speicher auf der Chain
      </label>
      <select
        value={value}
        onChange={(e) => applyTarget(e.target.value as ContactSendMailboxTarget)}
        className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {value === 'event' ? (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Flüchtig — schneller Event auf der Chain, kein Eintrag im Postfach-Objekt.
        </p>
      ) : resolvedMb ? (
        <p className="mt-1 font-mono text-[10px] text-muted-foreground" title={resolvedMb}>
          Postfach: {maskWalletAddress(resolvedMb, 10, 8)}
        </p>
      ) : (
        <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">
          Gewähltes Postfach noch leer — bitte unter Meine Mailboxen aktiv setzen oder Kontakt-Slot
          im Telefonbuch pflegen.
        </p>
      )}
    </div>
  )
}
