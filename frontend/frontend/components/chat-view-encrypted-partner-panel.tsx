'use client'

/**
 * Handshake senden / annehmen / Einsatz-Partner — unter „Verschlüsselt“ (online).
 */

import { useMemo } from 'react'
import { contactDisplayLabel } from '@/frontend/lib/contact-display'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'

const ADDR_64_HEX = /^0x[a-fA-F0-9]{64}$/

export type ChatViewEncryptedPartnerPanelProps = {
  partner: string
  onPartnerChange: (v: string) => void
  sending: boolean
  onHandshake: () => void
  onConnectAcceptPartner: () => void
  onConnectDeployment: () => void
  directory: Record<string, ContactMeshEntryClient>
  isGroupMode?: boolean
  groupMemberAddresses?: string[]
  connectedAddresses?: string[]
  onHandshakeForAddress?: (address: string) => void | Promise<void>
  onConnectAcceptForAddress?: (address: string) => void | Promise<void>
}

export function ChatViewEncryptedPartnerPanel(p: ChatViewEncryptedPartnerPanelProps) {
  const {
    partner,
    onPartnerChange,
    sending,
    onHandshake,
    directory,
    isGroupMode = false,
    groupMemberAddresses = [],
    connectedAddresses = [],
    onHandshakeForAddress,
    onConnectAcceptForAddress,
  } = p

  const partnerTrim = partner.trim()
  const partnerValid = ADDR_64_HEX.test(partnerTrim)

  const knownPartnerAddresses = Object.keys(directory)
    .map((a) => a.trim())
    .filter((a) => ADDR_64_HEX.test(a))

  const connectedSet = useMemo(
    () => new Set(connectedAddresses.map((a) => a.trim().toLowerCase()).filter(Boolean)),
    [connectedAddresses]
  )

  const groupMembers = useMemo(
    () =>
      groupMemberAddresses
        .map((a) => a.trim().toLowerCase())
        .filter((a) => /^0x[a-f0-9]{64}$/.test(a)),
    [groupMemberAddresses]
  )

  return (
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-3 sm:p-4 dark:bg-amber-950/15">
      {isGroupMode ? (
        <section aria-labelledby="encrypted-group-members">
          <h4 id="encrypted-group-members" className="mb-2 text-sm font-semibold text-foreground">
            Gruppe — Handshake pro Mitglied
          </h4>
          {groupMembers.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Keine Mitglieder in der aktiven Gruppe — im Gruppen-Panel speichern oder aus Liste wählen.
            </p>
          ) : (
            <ul className="space-y-2">
              {groupMembers.map((addr) => {
                const connected = connectedSet.has(addr)
                const label = contactDisplayLabel(directory, addr)
                return (
                  <li
                    key={addr}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background/60 px-2 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{label || `${addr.slice(0, 10)}…`}</p>
                      <code className="block truncate font-mono text-[10px] text-muted-foreground">{addr}</code>
                    </div>
                    <span
                      className={
                        connected
                          ? 'text-[10px] font-medium text-emerald-600 dark:text-emerald-400'
                          : 'text-[10px] text-amber-700 dark:text-amber-300'
                      }
                    >
                      {connected ? 'verbunden' : 'offen'}
                    </span>
                    {onHandshakeForAddress ? (
                      <button
                        type="button"
                        disabled={sending}
                        onClick={() => {
                          onPartnerChange(addr)
                          void onHandshakeForAddress(addr)
                        }}
                        className="shrink-0 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                      >
                        Senden
                      </button>
                    ) : null}
                    {onConnectAcceptForAddress ? (
                      <button
                        type="button"
                        disabled={sending}
                        onClick={() => {
                          onPartnerChange(addr)
                          void onConnectAcceptForAddress(addr)
                        }}
                        className="shrink-0 rounded-md border border-border bg-accent px-2.5 py-1.5 text-xs font-medium disabled:opacity-50"
                      >
                        Annehmen
                      </button>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ) : null}

      {!isGroupMode ? (
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="block text-sm font-medium text-foreground">Wallet-Adresse des Partners</label>
            {!isGroupMode && partnerValid && connectedSet.has(partnerTrim.toLowerCase()) ? (
              <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">verbunden</span>
            ) : null}
          </div>
          <input
            type="text"
            list="chat-partner-addresses-encrypted"
            value={partner}
            onChange={(e) => onPartnerChange(e.target.value)}
            placeholder="0x + 64 Zeichen Hex (IOTA-Wallet des Empfängers)"
            className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <datalist id="chat-partner-addresses-encrypted">
            {knownPartnerAddresses.map((addr) => (
              <option key={addr} value={addr} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={onHandshake}
            disabled={!partnerValid || sending}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending
              ? 'Wird gestartet...'
              : !isGroupMode && partnerValid && connectedSet.has(partnerTrim.toLowerCase())
                ? 'Handshake erneut senden'
                : 'Handshake starten'}
          </button>
        </div>

      </div>
      ) : null}
    </div>
  )
}
