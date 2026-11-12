'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  emergencyPurge,
  clearLocalHistory,
  vaultDeleteLocal,
  wipeTelegramIntegration,
} from '@/frontend/lib/api'
import { purgeLocalSecretVaults } from '@/frontend/lib/local-secret-vaults'
import {
  EINSATZ_END_CACHE_WIPED_EVENT,
  performEinsatzEndCacheWipe,
  wipeAllInboxCacheKeys,
} from '@/frontend/lib/einsatz-end-cache-wipe'
import { purgeTelegramBrowserPrefs } from '@/frontend/lib/telegram-browser-purge'

type PurgeScope =
  | 'messages'
  | 'browser_secrets'
  | 'telegram'
  | 'device_local'
  | 'full'
  | 'local_vault_file'

function notifyInboxRamCleared(): void {
  try {
    window.dispatchEvent(new CustomEvent(EINSATZ_END_CACHE_WIPED_EVENT))
  } catch {
    /* ignore */
  }
}

export function SettingsEmergencyPurgeSection() {
  const [confirmPurge, setConfirmPurge] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [purgeScope, setPurgeScope] = useState<PurgeScope>('messages')
  const [processing, setProcessing] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  const needsStrongConfirm = purgeScope === 'full' || purgeScope === 'local_vault_file'

  const handlePurge = async () => {
    if (confirmText !== 'LÖSCHEN') return
    setProcessing(true)
    setStatusMsg('')
    try {
      if (purgeScope === 'messages') {
        wipeAllInboxCacheKeys()
        notifyInboxRamCleared()
        const res = await clearLocalHistory({ shred: true })
        setStatusMsg(
          res.ok
            ? `${res.message || 'Lokaler Nachrichten-Cache entfernt.'} Browser-Posteingang geleert. On-Chain-Nachrichten bleiben.`
            : res.error || 'Fehler'
        )
        if (res.ok) {
          setConfirmPurge(false)
          setConfirmText('')
        }
        return
      }

      if (purgeScope === 'browser_secrets') {
        purgeLocalSecretVaults()
        setStatusMsg('Browser-Geheimnisse geleert (Passphrasen, Team-Keys, NFT-Merker). Tresor-Datei unverändert.')
        setConfirmPurge(false)
        setConfirmText('')
        return
      }

      if (purgeScope === 'telegram') {
        const browserN = purgeTelegramBrowserPrefs()
        const res = await wipeTelegramIntegration()
        setStatusMsg(
          res.ok
            ? `${res.message || 'Telegram-Runtime geleert.'} Browser-Prefs: ${browserN} Keys. .env-Token bleibt ggf. — manuell prüfen.`
            : res.error || 'Fehler'
        )
        if (res.ok) {
          setConfirmPurge(false)
          setConfirmText('')
        }
        return
      }

      if (purgeScope === 'device_local') {
        const wipe = await performEinsatzEndCacheWipe({ clearServerInbox: true, clearTransportQueues: true })
        setStatusMsg(
          wipe.ok
            ? `Gerät lokal aufgeräumt (Nachrichten-Cache, Browser-Spuren, Geheimnisse). Tresor-Datei und Chain unverändert.${
                wipe.serverInboxCleared ? '' : wipe.serverError ? ` Server: ${wipe.serverError}` : ''
              }`
            : wipe.serverError || 'Fehler beim Aufräumen'
        )
        if (wipe.ok || wipe.removedLocalStorageKeys > 0) {
          setConfirmPurge(false)
          setConfirmText('')
        }
        return
      }

      if (purgeScope === 'full') {
        const res = await emergencyPurge()
        if (res.ok) {
          wipeAllInboxCacheKeys()
          notifyInboxRamCleared()
          purgeLocalSecretVaults()
        }
        setStatusMsg(
          res.ok
            ? `${res.message || 'On-Chain-Tresor gelöscht.'} Browser-Nachrichten/Geheimnisse geleert. Lokale Datei .morgendrot-vault bleibt — ggf. „Lokale Tresor-Datei“ wählen.`
            : res.error || 'Fehler'
        )
        if (res.ok) {
          setConfirmPurge(false)
          setConfirmText('')
        }
        return
      }

      if (purgeScope === 'local_vault_file') {
        const res = await vaultDeleteLocal()
        setStatusMsg(
          res.ok
            ? res.message || 'Lokale Tresor-Datei gelöscht (nur wenn Chain-Backup vorhanden).'
            : res.error || res.message || 'Fehler'
        )
        if (res.ok) {
          setConfirmPurge(false)
          setConfirmText('')
        }
      }
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-red-500/25 bg-red-500/5 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-6 w-6 shrink-0 text-red-400" />
        <div>
          <h4 className="font-semibold text-red-400">Notfall-Löschung</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Scope wählen — jeder Schalter löscht etwas anderes. On-Chain-Purge und Tresor-Datei sind unwiderruflich.
            Bestätigung: <span className="font-mono text-red-400">LÖSCHEN</span>.
          </p>
        </div>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Nur sperren: Badge im Chat = weich; unter Passwort → <strong className="text-foreground">Sitzung beenden</strong>{' '}
        = voll (inkl. Inbox-Schnellcache). Das hier löscht gezielt mehr.
      </p>
      <div className="space-y-2 text-sm">
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="radio"
            name="purge-scope-settings"
            checked={purgeScope === 'messages'}
            onChange={() => setPurgeScope('messages')}
            className="mt-1"
          />
          <span>
            <strong className="text-foreground">Nur Nachrichten lokal</strong>
            <span className="block text-muted-foreground">
              Server-Cache (.inbox.enc) + Browser-Posteingang. Chain-Nachrichten und Medien-NFTs bleiben.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="radio"
            name="purge-scope-settings"
            checked={purgeScope === 'browser_secrets'}
            onChange={() => setPurgeScope('browser_secrets')}
            className="mt-1"
          />
          <span>
            <strong className="text-foreground">Nur Browser-Geheimnisse</strong>
            <span className="block text-muted-foreground">
              Passphrasen-/Team-/NFT-Merker in diesem Browser — nicht die Tresor-Datei.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="radio"
            name="purge-scope-settings"
            checked={purgeScope === 'telegram'}
            onChange={() => setPurgeScope('telegram')}
            className="mt-1"
          />
          <span>
            <strong className="text-foreground">Telegram lokal löschen</strong>
            <span className="block text-muted-foreground">
              Bot-Token/Chat-IDs aus Runtime, Journal-Datei, Browser-Alarm-Prefs. Nicht: Chats in Telegram selbst,
              nicht zwingend Werte nur in .env.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="radio"
            name="purge-scope-settings"
            checked={purgeScope === 'device_local'}
            onChange={() => setPurgeScope('device_local')}
            className="mt-1"
          />
          <span>
            <strong className="text-foreground">Gerät lokal aufräumen</strong>
            <span className="block text-muted-foreground">
              Nachrichten-Cache + Browser-Spuren + Geheimnisse (wie Einsatz beenden). Kein Chain-Purge, Tresor-Datei bleibt.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="radio"
            name="purge-scope-settings"
            checked={purgeScope === 'full'}
            onChange={() => setPurgeScope('full')}
            className="mt-1"
          />
          <span>
            <strong className="text-foreground">Tresor on-chain löschen</strong>
            <span className="block text-muted-foreground">
              Unwiderruflich: Chain-Backup weg + lokale Nachrichten/Geheimnisse. Datei .morgendrot-vault bleibt erhalten.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="radio"
            name="purge-scope-settings"
            checked={purgeScope === 'local_vault_file'}
            onChange={() => setPurgeScope('local_vault_file')}
            className="mt-1"
          />
          <span>
            <strong className="text-foreground">Lokale Tresor-Datei löschen</strong>
            <span className="block text-muted-foreground">
              Nur wenn On-Chain-Backup existiert (Sicherheit). Keys/Notizen/Passwörter auf dem Datenträger weg.
            </span>
          </span>
        </label>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Nur Medien?</span> Gibt es nicht als eigenen Schalter —
        Bilder stecken in Nachrichten bzw. als NFT (Posteingang → On-Chain / NFT → dort brennen). Einzelne
        Chat-Nachrichten on-chain: Posteingang → Auswahl → Burn.
      </p>
      {!confirmPurge ? (
        <button
          type="button"
          onClick={() => setConfirmPurge(true)}
          className="w-full rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center text-sm font-semibold text-red-400 hover:bg-red-500/20"
        >
          {needsStrongConfirm ? 'Unwiderrufliche Löschung starten' : 'Löschung starten'}
        </button>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm">
            Tippe <span className="font-mono text-red-400">LÖSCHEN</span> zum Bestätigen
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="LÖSCHEN"
              className="mt-1 w-full rounded-lg border border-red-500/30 bg-input px-3 py-2"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirmPurge(false)
                setConfirmText('')
              }}
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={() => void handlePurge()}
              disabled={processing || confirmText !== 'LÖSCHEN'}
              className="flex-1 rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
            >
              {processing ? 'Lösche…' : 'Endgültig löschen'}
            </button>
          </div>
        </div>
      )}
      {statusMsg ? <p className="text-sm text-muted-foreground" role="status">{statusMsg}</p> : null}
    </div>
  )
}
