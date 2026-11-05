'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import {
  type ContactSendMailboxTarget,
  buildSendMailboxTargetOptions,
  firstNonEventSendTarget,
  readContactSendMailboxTarget,
  writeContactSendMailboxTarget,
} from '@/frontend/lib/contact-mailbox-slots'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'
import { resolveOutboundMailboxObjectId } from '@/frontend/lib/outbound-mailbox-routing'
import { composerMailboxIdForSendTarget } from '@/frontend/lib/sync-composer-mailbox-from-target'
import { useInboxBurnOnRead } from '@/frontend/hooks/use-inbox-burn-on-read'

export type ChatViewContactSendMailboxSelectProps = {
  recipientWallet: string
  contactDirectory: Record<string, ContactMeshEntryClient>
  serverMailboxId?: string
  className?: string
  /** Nach Änderung: neues Ziel + aufgelöste Object-ID (leer = Event). */
  onTargetChange?: (target: ContactSendMailboxTarget, resolvedObjectId: string) => void
}

function readInitialTarget(wallet: string): ContactSendMailboxTarget {
  if (!/^0x[a-f0-9]{64}$/.test(wallet)) return 'event'
  return readContactSendMailboxTarget(wallet) ?? 'event'
}

export function ChatViewContactSendMailboxSelect(p: ChatViewContactSendMailboxSelectProps) {
  const { recipientWallet, contactDirectory, serverMailboxId, className, onTargetChange } = p
  const { burnOnReadEnabled } = useInboxBurnOnRead()
  const wallet = recipientWallet.trim().toLowerCase()
  const entry = /^0x[a-f0-9]{64}$/.test(wallet) ? contactDirectory[wallet] : undefined

  const options = useMemo(
    () => buildSendMailboxTargetOptions(entry, serverMailboxId, wallet),
    [entry, serverMailboxId, wallet]
  )

  const [value, setValue] = useState<ContactSendMailboxTarget>(() => readInitialTarget(wallet))

  useEffect(() => {
    setValue(readInitialTarget(wallet))
  }, [wallet])

  const applyTarget = (target: ContactSendMailboxTarget) => {
    if (burnOnReadEnabled && target === 'event') return
    if (!/^0x[a-f0-9]{64}$/.test(wallet)) return
    writeContactSendMailboxTarget(wallet, target)
    setValue(target)
    const resolved = composerMailboxIdForSendTarget({
      recipientWallet: wallet,
      target,
      contactDirectory,
      serverMailboxId,
    })
    onTargetChange?.(target, resolved)
  }

  useEffect(() => {
    if (!burnOnReadEnabled) return
    if (!/^0x[a-f0-9]{64}$/.test(wallet) || options.length === 0) return
    if (value !== 'event') return
    const next = firstNonEventSendTarget(options)
    if (!next) return
    writeContactSendMailboxTarget(wallet, next)
    setValue(next)
    const resolved = composerMailboxIdForSendTarget({
      recipientWallet: wallet,
      target: next,
      contactDirectory,
      serverMailboxId,
    })
    onTargetChange?.(next, resolved)
  }, [
    burnOnReadEnabled,
    wallet,
    value,
    options,
    contactDirectory,
    serverMailboxId,
    onTargetChange,
  ])

  if (!/^0x[a-f0-9]{64}$/.test(wallet) || options.length === 0) return null

  const resolvedMb = resolveOutboundMailboxObjectId(contactDirectory, wallet, value)

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
          <option key={o.value} value={o.value} disabled={burnOnReadEnabled && o.value === 'event'}>
            {o.value === 'event'
              ? burnOnReadEnabled
                ? 'Nur Wallet-Adresse (Event — kein Burn/Purge)'
                : o.label
              : o.label}
          </option>
        ))}
      </select>
      {burnOnReadEnabled ? (
        <p className="mt-1 text-[10px] text-amber-800 dark:text-amber-200">
          Burn-on-read aktiv: Sendung geht in eine Mailbox (purgebar). Events bleiben im Explorer als
          Historie und sind nicht löschbar.
        </p>
      ) : value === 'event' ? (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Flüchtig — schneller Event auf der Chain, kein Eintrag im Postfach-Objekt (kein
          Burn/Purge).
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
