'use client'

/**
 * Handshake senden / annehmen / Einsatz-Partner — unter „Verschlüsselt“ (online).
 */

import { useMemo } from 'react'
import { CircleHelp } from 'lucide-react'
import { contactDisplayLabel } from '@/frontend/lib/contact-display'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  MessengerGuideHint,
  MESSENGER_HB_ANCHOR_HANDSHAKE,
} from '@/components/messenger-handbook-link'

const ACCEPT_PARTNER_HINT =
  'Wartet auf einen Handshake der 0x-Adresse oben (Einsatz-Mailbox des Servers oder Event auf der Chain), antwortet automatisch mit deinem Schlüssel. Ignoriert .env-Partner — nur die eingetragene Adresse.'

const CONNECT_DEPLOYMENT_HINT =
  'Verbindet mit Adressen aus der Server-.env (PARTNER_ADDRESS, PARTNER_ADDRESSES oder Hierarchie). Typisch: erster Kontakt zum Einsatzleiter/Boss, wenn du seine 0x noch nicht kennst. Das Feld oben kann leer bleiben.'

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

function HintButton({ label, text }: { label: string; text: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={label}
        >
          <CircleHelp className="h-4 w-4 shrink-0" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-xs leading-relaxed" align="start">
        {text}
      </PopoverContent>
    </Popover>
  )
}

export function ChatViewEncryptedPartnerPanel(p: ChatViewEncryptedPartnerPanelProps) {
  const {
    partner,
    onPartnerChange,
    sending,
    onHandshake,
    onConnectAcceptPartner,
    onConnectDeployment,
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

      <div className={isGroupMode ? 'mt-4 space-y-3' : 'space-y-3'}>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">Wallet-Adresse des Partners</label>
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
            {sending ? 'Wird gestartet...' : 'Handshake starten'}
          </button>
        </div>

        <div className="space-y-2 border-t border-amber-500/20 pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-foreground">Verbindung</span>
            <MessengerGuideHint
              ariaLabel="Hilfe Handshake und Connect"
              teaser="Ablauf"
              anchor={MESSENGER_HB_ANCHOR_HANDSHAKE}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-muted-foreground">Handshake annehmen</span>
                <HintButton label="Erklärung Handshake annehmen" text={ACCEPT_PARTNER_HINT} />
              </div>
              <button
                type="button"
                onClick={onConnectAcceptPartner}
                disabled={!partnerValid || sending}
                className="w-full rounded-lg border border-emerald-600/40 bg-emerald-500/10 px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? 'Verbinde...' : 'Handshake annehmen'}
              </button>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-muted-foreground">Einsatz-Partner (.env)</span>
                <HintButton label="Erklärung Einsatz-Partner verbinden" text={CONNECT_DEPLOYMENT_HINT} />
              </div>
              <button
                type="button"
                onClick={onConnectDeployment}
                disabled={sending}
                className="w-full rounded-lg border border-border bg-accent px-3 py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? 'Verbinde...' : 'Mit Einsatz-Partner verbinden'}
              </button>
            </div>
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Annehmen braucht die 0x des Partners. Einsatz-Partner nutzt nur die Server-Konfiguration — unabhängig vom
            Feld oben. Beide warten auf einen Handshake und antworten ggf. automatisch.
          </p>
        </div>
      </div>
    </div>
  )
}
