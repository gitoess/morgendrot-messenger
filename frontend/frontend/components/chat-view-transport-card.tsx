'use client'

/**
 * Verschlüsselungs-Umschalter, Chain-Persistenz (Event/Mailbox, unabhängig von E2EE), Sendepfad (IOTA vs. Funk).
 * Funk ist **Klartext** (LongFast / Pfad 4); Verschlüsselung nur über **online** (IOTA).
 */

import { useMemo, useState } from 'react'
import { Lock, Unlock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CHAT_ENCRYPTED_HANDSHAKE_REQUIRED_MSG } from '@/frontend/lib/chat-view-messenger-transport'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import type { SendTransportChoicePort } from '@/frontend/features/messenger-ports'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
import {
  ChatViewEncryptedPartnerPanel,
  type ChatViewEncryptedPartnerPanelProps,
} from '@/frontend/components/chat-view-encrypted-partner-panel'
export type ChatViewTransportCardProps = SendTransportChoicePort & {
  isPrivate: boolean
  apiStatus: ApiStatus | null
  /** Aktuelles Partnerfeld aus Setup (0x…), für Inline-Hinweis bei mehreren verbundenen Partnern. */
  partner?: string
  /** Web Bluetooth / Heltec – für Hinweise unter „funk“. */
  meshBleSupported?: boolean
  meshBleConnected?: boolean
  /** Panel „Kontakt & Verbindung“ öffnen (Meshtastic koppeln steht dort). */
  onOpenPartnerSetup?: () => void
  channelMode?: MessengerChatChannel
  /** 1:1: eigene Mailbox-Object-ID nur bei Persistent (Mailbox). */
  myAddressLine?: string
  contactDirectory?: Record<string, ContactMeshEntryClient>
  onContactsChanged?: () => void
  onMailboxStatus?: (msg: string, kind: 'success' | 'error') => void
  /** Nach Runtime-Config-Änderung (Boss). */
  onRefreshApiStatus?: () => void | Promise<void>
  /** Unter „Verschlüsselt“: Handshake senden / annehmen / Einsatz-Partner (online). */
  encryptedPartner?: ChatViewEncryptedPartnerPanelProps
}

export function ChatViewTransportCard(p: ChatViewTransportCardProps) {
  const {
    isPrivate,
    encrypted,
    onEncryptedChange,
    forcedTransport,
    onForcedTransportChange,
    messagingPersistenceMode,
    apiStatus,
    partner = '',
    meshBleSupported = false,
    meshBleConnected = false,
    onOpenPartnerSetup,
    channelMode,
    myAddressLine,
    encryptedPartner,
  } = p

  const [plainWarnOpen, setPlainWarnOpen] = useState(false)

  const plainWarningText =
    forcedTransport === 'internet'
      ? 'This message will be stored unencrypted on the public blockchain and visible to everyone.'
      : 'This message will be sent unencrypted and can be overheard and forged by anyone in range.'

  const creditsPercent = useMemo(() => {
    const mc = apiStatus?.messengerCredits
    if (!mc) return 0
    try {
      const b = Number(mc.balance)
      const m = Number(mc.maxBalance)
      if (!Number.isFinite(b) || !Number.isFinite(m) || m <= 0) return 0
      return Math.min(100, Math.max(0, Math.round((b / m) * 100)))
    } catch {
      return 0
    }
  }, [apiStatus?.messengerCredits])

  const connectedAddresses = useMemo(
    () => (apiStatus?.connectedAddresses ?? []).map((a) => a.trim().toLowerCase()).filter(Boolean),
    [apiStatus?.connectedAddresses]
  )

  const selectedPartner = partner.trim().toLowerCase()
  const requiresPartnerSelection =
    isPrivate && encrypted && forcedTransport === 'internet' && connectedAddresses.length > 1
  const selectedPartnerConnected =
    selectedPartner.length > 0 && connectedAddresses.includes(selectedPartner)

  return (
    <>
      <AlertDialog open={plainWarnOpen} onOpenChange={setPlainWarnOpen}>
        <AlertDialogContent className="border-orange-500/40 bg-orange-950/20 sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-orange-100">Send without encryption?</AlertDialogTitle>
            <AlertDialogDescription className="text-orange-50/95">{plainWarningText}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 text-white hover:bg-orange-500"
              onClick={() => onEncryptedChange(false)}
            >
              Understood, continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-medium text-foreground">Encryption &amp; partner</p>
        <div
          className={cn(
            'flex w-full min-w-0 flex-wrap rounded-lg border border-border bg-background p-1',
            encrypted && 'ring-1 ring-emerald-500/30'
          )}
        >
          <button
            type="button"
            disabled={forcedTransport === 'mesh'}
            title={
              forcedTransport === 'mesh'
                ? 'Encryption only via "online". With "radio", LongFast plaintext is active.'
                : undefined
            }
            onClick={() => onEncryptedChange(true)}
            className={cn(
              'flex flex-1 min-w-[7.5rem] items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              encrypted ? 'bg-emerald-500/20 text-emerald-400' : 'text-muted-foreground hover:text-foreground',
              forcedTransport === 'mesh' && 'cursor-not-allowed opacity-45 hover:text-muted-foreground'
            )}
          >
            <Lock className="h-4 w-4 shrink-0" />
            Encrypted
          </button>
          <button
            type="button"
            onClick={() => {
              if (encrypted) setPlainWarnOpen(true)
            }}
            className={cn(
              'flex flex-1 min-w-[7.5rem] items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              !encrypted ? 'bg-amber-500/20 text-amber-400' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Unlock className="h-4 w-4 shrink-0" />
            Plaintext
          </button>
        </div>
        {encryptedPartner ? <ChatViewEncryptedPartnerPanel {...encryptedPartner} /> : null}
      </div>

      {(isPrivate || !encrypted) && !encrypted && forcedTransport !== 'mesh' ? (
        <span className="sr-only">Plaintext online uses the IOTA path; radio uses Meshtastic plaintext.</span>
      ) : null}

      {(isPrivate || !encrypted) && forcedTransport === 'mesh' && !meshBleConnected && onOpenPartnerSetup ? (
        <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={onOpenPartnerSetup}
            className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 font-medium text-primary hover:bg-primary/15"
          >
            Radio &amp; devices
          </button>
        </div>
      ) : null}

      {isPrivate && encrypted && forcedTransport === 'internet' ? (
        <span className="sr-only">{CHAT_ENCRYPTED_HANDSHAKE_REQUIRED_MSG}</span>
      ) : null}
      {requiresPartnerSelection && !selectedPartner ? (
        <p className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-950 dark:text-amber-100/95">
          Mehrere Partner verbunden. Bitte unter <strong>Verschlüsselt</strong> die Zieladresse
          auswählen, sonst wird verschlüsselt nicht gesendet.
        </p>
      ) : null}
      {requiresPartnerSelection && selectedPartner && !selectedPartnerConnected ? (
        <p className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-950 dark:text-amber-100/95">
          Gewählter Partner ist nicht verbunden. Erst <strong>/connect</strong> für diese Adresse durchführen oder
          Partnerfeld korrigieren.
        </p>
      ) : null}

      {(isPrivate || !encrypted) && forcedTransport === 'adhoc' ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[11px] font-medium text-amber-900 dark:text-amber-100">Ad-hoc: not available</p>
          {onOpenPartnerSetup ? (
            <button
              type="button"
              onClick={onOpenPartnerSetup}
              className="mt-2 text-[11px] font-medium text-primary underline-offset-2 hover:underline"
            >
              Setup
            </button>
          ) : null}
        </div>
      ) : null}

      {isPrivate && apiStatus?.messengerCreditsConfigured && apiStatus.messengerCredits && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">Messenger-Credits</span>
            <span className="font-mono text-xs text-muted-foreground">
              {apiStatus.messengerCredits.balance} / {apiStatus.messengerCredits.maxBalance}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500/90 transition-all duration-300"
              style={{ width: `${creditsPercent}%` }}
            />
          </div>
        </div>
      )}
      {isPrivate && apiStatus?.messengerCreditsFetchFailed && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Messenger credits object not readable (check RPC or MESSENGER_CREDITS_OBJECT_ID).
        </p>
      )}
      {(() => {
        const hints =
          apiStatus?.configHints?.filter((h) => !/^Posteingang-Event-Union:/i.test(h)) ?? []
        if (!isPrivate || hints.length === 0) return null
        return (
          <ul className="list-inside list-disc rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-200/90">
            {hints.map((h, i) => (
              <li key={`hint-${i}`}>{h}</li>
            ))}
          </ul>
        )
      })()}
    </>
  )
}
