'use client'

/**
 * Verschlüsselungs-Umschalter, Pinnwand-Hinweis, Sendepfad (IOTA vs. LoRa/Meshtastic).
 * Funk ist **Klartext** (LongFast / Pfad 4); Verschlüsselung nur über **online** (IOTA/Mailbox).
 */

import { useMemo, useState } from 'react'
import { Handshake, Lock, Unlock } from 'lucide-react'
import { cn } from '@/lib/utils'
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
import { MessengerGuideHint } from '@/components/messenger-handbook-link'

export type ChatViewTransportCardProps = SendTransportChoicePort & {
  isPrivate: boolean
  apiStatus: ApiStatus | null
  /** Web Bluetooth / Heltec – für Hinweise unter „funk“. */
  meshBleSupported?: boolean
  meshBleConnected?: boolean
  /** Panel „Partner verbinden“ öffnen (Meshtastic koppeln steht dort). */
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
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {encrypted ? (
            <>
              <span>Ende-zu-Ende mit Partner-Schlüssel (Vault am Node).</span>
              <MessengerGuideHint ariaLabel="Hinweise Verschlüsselung" teaser="Mehr" />
            </>
          ) : forcedTransport === 'internet' ? (
            'Klartext: sichtbar in der Chain (/send-plain).'
          ) : (
            <>
              <span>funk = Klartext (LongFast). Verschlüsselung: „online“.</span>
              <MessengerGuideHint ariaLabel="Hinweise Funk vs. online" teaser="Mehr" />
            </>
          )}
        </span>
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
            Partner verbinden
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
          <span className="max-w-xl text-[11px] leading-relaxed text-muted-foreground">
            {messagingPersistenceMode === 'mailbox'
              ? 'Speicherung in der Mailbox (wenn Backend/Move konfiguriert) — gleiche Quelle wie verschlüsselte Nachrichten.'
              : 'Klassischer Event-Pfad (send_plaintext_message) — wie bisheriger Standard.'}
          </span>
        </div>
      )}

      {!isPrivate && !encrypted && (
        <p className="rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2 text-xs text-sky-950 dark:text-sky-100/90">
          <strong className="text-foreground">Pinnwand · Klartext:</strong> Du kannst{' '}
          <strong className="text-foreground">„funk“</strong> wählen und (mit verbundenem Heltec) Meshtastic-Klartext
          senden — ohne 0x-Empfänger bei Broadcast. Verschlüsselt/IOTA: privater Chat.
        </p>
      )}

      {(isPrivate || !encrypted) && !encrypted && forcedTransport !== 'mesh' && (
        <p className="rounded-md border border-orange-500/35 bg-orange-500/10 px-3 py-2 text-[11px] text-orange-950 dark:text-orange-100/95">
          <strong>Klartext:</strong> mit <strong>online</strong> über IOTA (<span className="font-mono">/send-plain</span>). Für{' '}
          <strong>funk</strong> Meshtastic-Klartext in der Kopfzeile wählen (kein 0x nötig bei Broadcast).
        </p>
      )}

      {(isPrivate || !encrypted) && forcedTransport === 'mesh' && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2 text-[11px] leading-relaxed text-foreground">
            {meshBleConnected ? (
              <p className="text-emerald-600 dark:text-emerald-400">
                Heltec verbunden — Klartext senden (LoRa-Bild nur mit Pfad 4).
              </p>
            ) : meshBleSupported ? (
              <p>
                Heltec koppeln: <strong className="text-foreground">Partner verbinden</strong> öffnen, dort{' '}
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
                Partner verbinden öffnen
              </button>
            ) : null}
          </div>
          {apiStatus?.rpcSocksProxyActive || apiStatus?.rpcHttpProxyActive ? (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
              RPC-Proxy aktiv (SOCKS und/oder HTTP) — Tor/HTTP siehe Handbuch.
            </p>
          ) : null}
        </div>
      )}

      {(isPrivate || !encrypted) && forcedTransport === 'adhoc' && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] leading-relaxed text-amber-900 dark:text-amber-100/90">
            <strong>Ad-hoc BLE</strong> ist noch <strong>nicht implementiert</strong> (nur Platzhalter). Kontakt-<strong>bleUuid</strong> und
            zukünftiges Advertising siehe Setup unter „Partner verbinden“. Bitte auf <strong>funk</strong> oder{' '}
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
