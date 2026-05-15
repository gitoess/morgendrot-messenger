'use client'

/**
 * Verschlüsselungs-Umschalter, Pinnwand-Hinweis, Sendepfad (IOTA vs. LoRa/Meshtastic).
 * Funk ist **Klartext** (LongFast / Pfad 4); Verschlüsselung nur über **online** (IOTA/Mailbox).
 */

import { useMemo, useState } from 'react'
import { Handshake, Lock, Unlock } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CHAT_ENCRYPTED_HANDSHAKE_REQUIRED_MSG,
  CHAT_ENCRYPTED_MESH_DISABLED_MSG,
  CHAT_PATH4_SELF_ARCHIVE_HINT,
} from '@/frontend/lib/chat-view-messenger-transport'
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
import type { ApiStatus } from '@/frontend/lib/api'
import type { SendTransportChoicePort } from '@/frontend/features/messenger-ports'

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
  /** Detail-Panel ein-/aus (nebeneinander mit Verschlüsselung). */
  partnerSetupOpen?: boolean
  onTogglePartnerSetup?: () => void
}

export function ChatViewTransportCard(p: ChatViewTransportCardProps) {
  const {
    isPrivate,
    encrypted,
    onEncryptedChange,
    forcedTransport,
    onForcedTransportChange,
    messagingPersistenceMode,
    onMessagingPersistenceModeChange,
    apiStatus,
    partner = '',
    meshBleSupported = false,
    meshBleConnected = false,
    onOpenPartnerSetup,
    partnerSetupOpen = false,
    onTogglePartnerSetup,
  } = p

  const [plainWarnOpen, setPlainWarnOpen] = useState(false)

  const plainWarningText =
    forcedTransport === 'internet'
      ? 'Diese Nachricht wird unverschlüsselt auf der öffentlichen Blockchain gespeichert und ist für jeden einsehbar.'
      : 'Diese Nachricht wird unverschlüsselt gesendet und kann von allen in Reichweite mitgehört und gefälscht werden.'

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
            <AlertDialogTitle className="text-orange-100">Unverschlüsselt senden?</AlertDialogTitle>
            <AlertDialogDescription className="text-orange-50/95">{plainWarningText}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 text-white hover:bg-orange-500"
              onClick={() => onEncryptedChange(false)}
            >
              Verstanden, fortfahren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4">
        <span className="text-sm font-medium text-foreground">Verschlüsselung:</span>
        <div className="flex rounded-lg border border-border bg-background p-1">
          <button
            type="button"
            disabled={forcedTransport === 'mesh'}
            title={
              forcedTransport === 'mesh'
                ? 'Verschlüsselung nur über „online“. Bei „funk“ ist LongFast-Klartext aktiv.'
                : undefined
            }
            onClick={() => onEncryptedChange(true)}
            className={cn(
              'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              encrypted ? 'bg-emerald-500/20 text-emerald-400' : 'text-muted-foreground hover:text-foreground',
              forcedTransport === 'mesh' && 'cursor-not-allowed opacity-45 hover:text-muted-foreground'
            )}
          >
            <Lock className="h-4 w-4" />
            Verschlüsselt
          </button>
          <button
            type="button"
            onClick={() => {
              if (encrypted) setPlainWarnOpen(true)
            }}
            className={cn(
              'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              !encrypted ? 'bg-amber-500/20 text-amber-400' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Unlock className="h-4 w-4" />
            Unverschlüsselt
          </button>
        </div>
        {isPrivate && onTogglePartnerSetup ? (
          <button
            type="button"
            onClick={onTogglePartnerSetup}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              partnerSetupOpen
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-muted/50 text-foreground hover:bg-muted'
            )}
          >
            <Handshake className="h-4 w-4 shrink-0" aria-hidden />
            Kontakt &amp; Verbindung
          </button>
        ) : null}
      </div>

      {!encrypted && forcedTransport === 'internet' && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
          <span className="text-sm font-medium text-foreground">Klartext auf IOTA:</span>
          <div className="flex rounded-lg border border-border bg-background p-1">
            <button
              type="button"
              onClick={() => onMessagingPersistenceModeChange('event')}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                messagingPersistenceMode === 'event'
                  ? 'bg-amber-500/20 text-amber-200'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Nur Event
            </button>
            <button
              type="button"
              onClick={() => onMessagingPersistenceModeChange('mailbox')}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                messagingPersistenceMode === 'mailbox'
                  ? 'bg-emerald-500/15 text-emerald-200'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Mailbox
            </button>
          </div>
          <span className="sr-only">
            {messagingPersistenceMode === 'mailbox'
              ? 'Klartext-Mailbox-Speicherung, wenn Backend konfiguriert.'
              : 'Klartext-Event-Pfad send_plaintext_message.'}
          </span>
          {messagingPersistenceMode === 'mailbox' && apiStatus?.mailboxConfigured === false ? (
            <p className="w-full text-xs text-amber-700 dark:text-amber-300">
              Mailbox-Modus gewählt, aber <span className="font-mono">MAILBOX_ID</span> fehlt oder ist ungültig — Senden
              schlägt fehl. Betreiber: Server-.env; oder „Nur Event“ wählen.
            </p>
          ) : null}
        </div>
      )}
      {encrypted && forcedTransport === 'internet' ? (
        <span className="sr-only">Verschlüsselte Online-Nachrichten laufen derzeit über den Mailbox-Pfad.</span>
      ) : null}

      {!isPrivate && !encrypted && (
        <p className="rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2 text-xs text-sky-950 dark:text-sky-100/90">
          <strong className="text-foreground">Pinnwand · Klartext:</strong> Du kannst{' '}
          <strong className="text-foreground">„funk“</strong> wählen und (mit verbundenem Heltec) Meshtastic-Klartext
          senden — ohne 0x-Empfänger bei Broadcast. Verschlüsselt/IOTA: privater Chat.
        </p>
      )}

      {(isPrivate || !encrypted) && !encrypted && forcedTransport !== 'mesh' ? (
        <span className="sr-only">Klartext-Online nutzt den IOTA-Pfad; Funk nutzt Meshtastic-Klartext.</span>
      ) : null}

      {(isPrivate || !encrypted) && forcedTransport === 'mesh' && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <p className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-950 dark:text-amber-100/95">
            <strong>Policy:</strong> {CHAT_ENCRYPTED_MESH_DISABLED_MSG}
          </p>
          <div className="rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2 text-[11px] leading-relaxed text-foreground">
            {meshBleConnected ? (
              <p className="text-emerald-600 dark:text-emerald-400">
                Heltec verbunden — Klartext senden (LoRa-Bild nur mit Pfad 4).
              </p>
            ) : meshBleSupported ? (
              <p>
                Heltec koppeln: <strong className="text-foreground">Kontakt &amp; Verbindung</strong> öffnen, dort{' '}
                <strong className="text-foreground">Web Bluetooth</strong> (Browser zeigt die Geräteliste).
              </p>
            ) : (
              <p>
                Kein Web Bluetooth in diesem Browser — Chrome/Edge; bei Brave ggf.{' '}
                <span className="font-mono">brave://flags</span>.
              </p>
            )}
            {onOpenPartnerSetup ? (
              <button
                type="button"
                onClick={onOpenPartnerSetup}
                className="mt-2 flex min-h-[2.75rem] w-full items-center justify-center rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/15 sm:min-h-0 sm:w-auto sm:justify-start sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:text-inherit sm:font-medium sm:text-primary sm:underline sm:underline-offset-2"
              >
                Kontakt &amp; Verbindung öffnen
              </button>
            ) : null}
          </div>
          {apiStatus?.rpcSocksProxyActive || apiStatus?.rpcHttpProxyActive ? (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400">RPC-Proxy aktiv (SOCKS/HTTP).</p>
          ) : null}
          {isPrivate ? (
            <p className="text-[11px] text-muted-foreground">{CHAT_PATH4_SELF_ARCHIVE_HINT}</p>
          ) : null}
        </div>
      )}

      {isPrivate && encrypted && forcedTransport === 'internet' ? (
        <span className="sr-only">{CHAT_ENCRYPTED_HANDSHAKE_REQUIRED_MSG}</span>
      ) : null}
      {requiresPartnerSelection && !selectedPartner ? (
        <p className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-950 dark:text-amber-100/95">
          Mehrere Partner verbunden. Bitte im Setup bei <strong>Partner (Handshake)</strong> die Zieladresse
          auswählen, sonst wird verschlüsselt nicht gesendet.
        </p>
      ) : null}
      {requiresPartnerSelection && selectedPartner && !selectedPartnerConnected ? (
        <p className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-950 dark:text-amber-100/95">
          Gewählter Partner ist nicht verbunden. Erst <strong>/connect</strong> für diese Adresse durchführen oder
          Partnerfeld korrigieren.
        </p>
      ) : null}

      {(isPrivate || !encrypted) && forcedTransport === 'adhoc' && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] leading-relaxed text-amber-900 dark:text-amber-100/90">
            <strong>Ad-hoc BLE</strong> ist noch <strong>nicht implementiert</strong> (nur Platzhalter). Kontakt-<strong>bleUuid</strong> und
            zukünftiges Advertising siehe Setup unter „Kontakt &amp; Verbindung“. Bitte auf <strong>funk</strong> oder{' '}
            <strong>online</strong> wechseln zum Senden.
            {onOpenPartnerSetup ? (
              <button
                type="button"
                onClick={onOpenPartnerSetup}
                className="ml-2 font-medium text-primary underline-offset-2 hover:underline"
              >
                Setup öffnen
              </button>
            ) : null}
          </div>
        </div>
      )}

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
          Messenger-Credits-Objekt nicht lesbar (RPC oder MESSENGER_CREDITS_OBJECT_ID prüfen).
        </p>
      )}
      {isPrivate && apiStatus?.configHints && apiStatus.configHints.length > 0 && (
        <ul className="list-inside list-disc rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-200/90">
          {apiStatus.configHints.map((h, i) => (
            <li key={`hint-${i}`}>{h}</li>
          ))}
        </ul>
      )}
    </>
  )
}
