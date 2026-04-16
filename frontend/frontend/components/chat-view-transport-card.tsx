'use client'

/**
 * Verschlüsselungs-Umschalter, Pinnwand-Hinweis, Sendepfad (IOTA vs. LoRa/Meshtastic).
 * Meshtastic-First: Funk nutzt den Standard-Meshtastic-/PRIVATE_APP-Pfad; getrennt vom IOTA-Mailbox-Klick in dieser UI.
 */

import { useMemo, useState } from 'react'
import { Lock, Unlock } from 'lucide-react'
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

export type ChatViewTransportCardProps = SendTransportChoicePort & {
  isPrivate: boolean
  apiStatus: ApiStatus | null
  /** Web Bluetooth / Heltec – für Hinweise unter „funk“. */
  meshBleSupported?: boolean
  meshBleConnected?: boolean
  /** Panel „Partner verbinden“ öffnen (Meshtastic koppeln steht dort). */
  onOpenPartnerSetup?: () => void
}

const INTERNET_OPTS = [
  {
    id: 'internet' as const,
    icon: '🌍',
    short: 'online',
    label:
      'IOTA/Mailbox über Backend (Timeout ca. 120 s); bei Fehler optional ein Funk-Versuch wenn Heltec verbunden',
  },
] as const

const MESH_OPTS = [
  {
    id: 'mesh' as const,
    icon: '📡',
    short: 'funk',
    label: 'Nur Funk (Mesh v2) – Heltec muss verbunden sein',
  },
  {
    id: 'adhoc' as const,
    icon: '📱',
    short: 'adhoc',
    label: 'Ad-hoc BLE (noch nicht implementiert)',
  },
] as const

export function ChatViewTransportCard(p: ChatViewTransportCardProps) {
  const {
    isPrivate,
    encrypted,
    onEncryptedChange,
    forcedTransport,
    onForcedTransportChange,
    apiStatus,
    meshBleSupported = false,
    meshBleConnected = false,
    onOpenPartnerSetup,
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
            onClick={() => onEncryptedChange(true)}
            className={cn(
              'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              encrypted ? 'bg-emerald-500/20 text-emerald-400' : 'text-muted-foreground hover:text-foreground'
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
        <span className="min-w-[12rem] text-xs text-muted-foreground">
          {encrypted
            ? 'Lesbar nur mit Partner-Key; Entschlüsselung auf diesem Node bei entsperrtem Vault (kein Signal-PFS).'
            : forcedTransport === 'internet'
              ? 'Klartext: sichtbar in der Chain (/send-plain).'
              : 'Klartext + funk: Standard-Meshtastic-Text (LongFast), kein /connect. Verschlüsselt + funk = Mesh v2 (Handshake nötig).'}
        </span>
      </div>

      {!isPrivate && !encrypted && (
        <p className="rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2 text-xs text-sky-950 dark:text-sky-100/90">
          <strong className="text-foreground">Pinnwand · Klartext:</strong> Du kannst{' '}
          <strong className="text-foreground">„funk“</strong> wählen und (mit verbundenem Heltec) Meshtastic-Klartext
          senden — ohne 0x-Empfänger bei Broadcast. Verschlüsselt/IOTA: privater Chat.
        </p>
      )}

      {(isPrivate || !encrypted) && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <p className="text-sm font-medium text-foreground">Sendepfad</p>
          {!encrypted && forcedTransport !== 'mesh' && (
            <p className="rounded-md border border-orange-500/35 bg-orange-500/10 px-3 py-2 text-[11px] text-orange-950 dark:text-orange-100/95">
              <strong>Klartext:</strong> mit <strong>online</strong> über IOTA (<span className="font-mono">/send-plain</span>).
              Für <strong>funk</strong> Meshtastic-Klartext wählen (kein 0x nötig bei Broadcast).
            </p>
          )}
          <p className="text-[11px] leading-relaxed text-muted-foreground border-b border-border pb-3">
            <strong className="text-foreground">Strikt getrennt:</strong>{' '}
            <span className="text-emerald-600/90 dark:text-emerald-400/90">IOTA/Mailbox</span> läuft nur über das
            Backend und die Chain.{' '}
            <span className="text-sky-600/90 dark:text-sky-400/90">LoRa/Meshtastic</span> ist ein eigener Kanal
            (Heltec, <span className="font-mono">PRIVATE_APP</span> v2) –{' '}
            <strong className="text-foreground">ohne</strong> IOTA-Transaktion für denselben Klick.
          </p>
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700/90 dark:text-emerald-400/80">
              Blockchain · IOTA / Mailbox
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {INTERNET_OPTS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  title={opt.label}
                  onClick={() => onForcedTransportChange(opt.id)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1.5 text-sm transition-colors',
                    forcedTransport === opt.id
                      ? 'border-emerald-600/50 bg-emerald-500/10 text-foreground'
                      : 'border-border bg-background text-muted-foreground hover:bg-accent'
                  )}
                >
                  <span className="mr-1">{opt.icon}</span>
                  <span className="text-xs font-medium">{opt.short}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700/90 dark:text-sky-400/80">
              LoRa-Funk + Bluetooth (Web-BT) · kein IOTA
            </p>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              <strong className="text-foreground">Visuell getrennt:</strong> oben{' '}
              <span className="text-emerald-600/90 dark:text-emerald-400/90">🌍 Online</span> = Wallet/Chain/Tor; hier{' '}
              <span className="text-sky-600/90 dark:text-sky-400/90">📡📱</span> = nur Heltec über{' '}
              <strong className="text-foreground">Bluetooth</strong> im Browser (kein „WLAN-Funk“).
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {MESH_OPTS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  title={opt.label}
                  onClick={() => onForcedTransportChange(opt.id)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1.5 text-sm transition-colors',
                    forcedTransport === opt.id
                      ? 'border-sky-600/50 bg-sky-500/10 text-foreground'
                      : 'border-border bg-background text-muted-foreground hover:bg-accent'
                  )}
                >
                  <span className="mr-1">{opt.icon}</span>
                  <span className="text-xs font-medium">{opt.short}</span>
                </button>
              ))}
            </div>
          </div>
          {forcedTransport === 'mesh' && (
            <div className="rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2 text-[11px] leading-relaxed text-foreground">
              <strong>Nächste Schritte (Funk):</strong>{' '}
              {meshBleConnected ? (
                <span className="text-emerald-600 dark:text-emerald-400">Heltec/Web-BT verbunden – du kannst senden (LoRa-Pipeline / LUMA+CHROMA).</span>
              ) : meshBleSupported ? (
                <span>
                  Heltec noch nicht gekoppelt: <strong className="text-foreground">Partner-Setup</strong> öffnen
                  (erscheint <strong className="text-foreground">zwischen</strong> dieser Karte und dem Nachrichtenfeld),
                  dort <strong className="text-foreground">Heltec (Web Bluetooth) verbinden</strong> — der Browser
                  (Chrome/Edge; bei Brave ggf. <span className="font-mono">brave://flags</span>) öffnet die Geräteliste zum Koppeln.
                </span>
              ) : (
                <span>
                  Dieser Browser unterstützt kein Web Bluetooth – Chrome/Edge auf Android oder Desktop; bei Brave Web
                  Bluetooth oft deaktiviert (<span className="font-mono">brave://flags</span>).
                </span>
              )}
              {onOpenPartnerSetup ? (
                <button
                  type="button"
                  onClick={onOpenPartnerSetup}
                  className="mt-2 flex min-h-[2.75rem] w-full items-center justify-center rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/15 sm:min-h-0 sm:w-auto sm:justify-start sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:text-inherit sm:font-medium sm:text-primary sm:underline sm:underline-offset-2"
                >
                  Partner-Setup öffnen (Handshake + Mesh)
                </button>
              ) : null}
            </div>
          )}
          {forcedTransport === 'adhoc' && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] leading-relaxed text-amber-900 dark:text-amber-100/90">
              <strong>Ad-hoc BLE</strong> ist noch <strong>nicht implementiert</strong> (nur Platzhalter). Kontakt-<strong>bleUuid</strong> und
              zukünftiges Advertising siehe Setup unter „Partner verbinden“. Senden wechselt auf{' '}
              <strong>funk</strong> oder <strong>online</strong>.
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
          )}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <strong className="text-foreground">online:</strong> zuerst IOTA/Mailbox (Timeout ca. 120 s). Schlägt das
            fehl und Heltec ist verbunden → automatisch <strong className="text-foreground">ein</strong> Versuch per
            Funk. Ohne Funk nur Fehlermeldung (dann <strong className="text-foreground">funk</strong> wählen).{' '}
            <strong className="text-foreground">funk:</strong> nur <span className="font-mono">PRIVATE_APP</span> v2 per
            Mesh, nie IOTA.
          </p>
          <p className="text-[11px] text-muted-foreground">
            Tor/SOCKS: wird vom <strong className="text-foreground">Backend</strong> genutzt, wenn{' '}
            <span className="font-mono">RPC_SOCKS_PROXY</span> in der Server-<span className="font-mono">.env</span>{' '}
            steht (oder über die Konfigurationsoberfläche geschrieben wurde).{' '}
            {apiStatus?.rpcSocksProxyActive || apiStatus?.rpcHttpProxyActive ? (
              <span className="text-emerald-600 dark:text-emerald-400">
                Aktuell ist ein RPC-Proxy aktiv (SOCKS und/oder HTTP).
              </span>
            ) : (
              <span>Ohne Proxy sieht der IOTA-Knoten die IP deines Servers/Rechners.</span>
            )}
          </p>
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
