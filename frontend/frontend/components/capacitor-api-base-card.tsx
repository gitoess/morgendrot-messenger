'use client'

import { useCallback, useEffect, useState } from 'react'
import { API_BASE_OVERRIDE_KEY, getApiBase } from '@/frontend/lib/api/api-base'
import { getNativeLoopbackApiBaseWarning } from '@/frontend/lib/api-base-native-hints'
import { isStandaloneDeviceMode, shouldPreferStandaloneHandoffStatus } from '@/frontend/lib/capacitor-standalone-bootstrap'
import { shouldShowCapacitorApiBaseSettings } from '@/frontend/lib/capacitor-platform'
import {
  canUseAndroidForegroundSync,
  getAndroidForegroundSyncRunning,
  isAndroidFgSyncEnabled,
  setAndroidFgSyncEnabled,
  startAndroidForegroundSyncIfEnabled,
  stopAndroidForegroundSync,
} from '@/frontend/lib/capacitor-foreground-sync'
import { getDirectChainIdsReadiness } from '@/frontend/lib/direct-iota-chain-context'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import { isAutarkyModeEnabled } from '@/frontend/lib/autarky-status-line'
import { fetchStatus } from '@/frontend/lib/api/status'
import { applyInstallQrApiBase, parseInstallQrPayload } from '@/frontend/lib/install-qr'
import { useMeshQrCameraScan } from '@/frontend/hooks/use-mesh-qr-camera-scan'

export function CapacitorApiBaseCard() {
  const [visible, setVisible] = useState(false)
  const [draft, setDraft] = useState('')
  const [saved, setSaved] = useState('')
  const [testMsg, setTestMsg] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [fgEnabled, setFgEnabled] = useState(false)
  const [fgRunning, setFgRunning] = useState(false)
  const [fgBusy, setFgBusy] = useState(false)
  const { startScan, cameraDialog } = useMeshQrCameraScan({ title: 'Install-QR scannen' })

  useEffect(() => {
    setVisible(shouldShowCapacitorApiBaseSettings())
    if (canUseAndroidForegroundSync()) {
      setFgEnabled(isAndroidFgSyncEnabled())
      void getAndroidForegroundSyncRunning().then(setFgRunning)
    }
    try {
      const v = window.localStorage.getItem(API_BASE_OVERRIDE_KEY)?.trim() ?? ''
      setDraft(v)
      setSaved(v)
    } catch {
      setDraft('')
      setSaved('')
    }
  }, [])

  const persist = useCallback(() => {
    const normalized = draft.trim().replace(/\/$/, '')
    try {
      if (normalized) {
        window.localStorage.setItem(API_BASE_OVERRIDE_KEY, normalized)
      } else {
        window.localStorage.removeItem(API_BASE_OVERRIDE_KEY)
      }
      setSaved(normalized)
      window.dispatchEvent(new CustomEvent('morgendrot.apiBaseChanged'))
    } catch {
      // optional
    }
  }, [draft])

  const loopbackWarn = getNativeLoopbackApiBaseWarning()

  const toggleFgSync = async () => {
    if (!canUseAndroidForegroundSync()) return
    setFgBusy(true)
    try {
      const next = !fgEnabled
      setAndroidFgSyncEnabled(next)
      setFgEnabled(next)
      if (next) {
        const res = await startAndroidForegroundSyncIfEnabled()
        setFgRunning(res.running)
      } else {
        await stopAndroidForegroundSync()
        setFgRunning(false)
      }
    } finally {
      setFgBusy(false)
    }
  }

  const applyFromBossQr = async () => {
    setTestMsg(null)
    try {
      const scanned = await startScan()
      if ('error' in scanned) {
        if (scanned.error !== 'Scan abgebrochen.') setTestMsg(scanned.error)
        return
      }
      const parsed = parseInstallQrPayload(scanned.bundleJson)
      if (!parsed?.apiBaseUrl) {
        setTestMsg('QR enthält keine API-Basis-URL.')
        return
      }
      const r = applyInstallQrApiBase(parsed.apiBaseUrl)
      if (!r.ok) {
        setTestMsg(r.error)
        return
      }
      const normalized = parsed.apiBaseUrl.trim().replace(/\/$/, '')
      setDraft(normalized)
      setSaved(normalized)
      setTestMsg(`Basis-URL aus QR: ${normalized}`)
      window.dispatchEvent(new CustomEvent('morgendrot.apiBaseChanged'))
    } catch (e) {
      setTestMsg(e instanceof Error ? e.message : String(e))
    }
  }

  const testConnection = async () => {
    setTesting(true)
    setTestMsg(null)
    const warn = getNativeLoopbackApiBaseWarning()
    if (warn) {
      setTestMsg(warn)
      setTesting(false)
      return
    }
    const base = getApiBase()
    if (!base) {
      if (isStandaloneDeviceMode() && getConfiguredDirectIotaRpcUrl()) {
        const res = await fetchStatus()
        if (res.fromLocalHandoff || res.fromCache) {
          setTestMsg('Standalone aktiv — keine Basis-URL nötig (Direkt-RPC + lokales Handoff).')
          setTesting(false)
          return
        }
      }
      setTestMsg('Zuerst URL speichern — oder Handoff importieren für Standalone.')
      setTesting(false)
      return
    }
    try {
      const res = await fetchStatus()
      if ('pollClockHint' in res && res.backendRunning !== false) {
        setTestMsg(`OK — Basis erreichbar unter ${base}`)
        window.dispatchEvent(new CustomEvent('morgendrot.apiBaseChanged'))
      } else {
        setTestMsg(
          `Keine gültige Antwort. Boss-PC läuft? Firewall TCP 3341/3342, gleiches WLAN. Ziel: ${base}`
        )
      }
    } catch (e) {
      setTestMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setTesting(false)
    }
  }

  if (!visible) return null

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h4 className="font-semibold text-foreground">Basis-URL (APK / Gerät)</h4>
      {shouldPreferStandaloneHandoffStatus() ? (
        <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-100">
          <strong>Standalone mit Handoff:</strong> Feld leer lassen — kein PC-Server nötig. IOTA läuft über die
          Fullnode aus dem Handoff (Direkt-RPC).
        </p>
      ) : null}
      {isStandaloneDeviceMode() && getConfiguredDirectIotaRpcUrl() ? (
        <p className="mt-1 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2 py-1.5 text-xs text-foreground">
          <strong>Standalone-Modus:</strong> Handoff + Direkt-RPC reichen für IOTA und Chat-Kern — diese URL ist{' '}
          <strong>optional</strong> (Relay, Telegram, ffmpeg-Sprachmemo, serverseitiger Handoff-Apply).
          {isAutarkyModeEnabled() ? ' Autarkie-Modus ist aktiv.' : ''}
          {getDirectChainIdsReadiness().ready
            ? ' Ketten-IDs lokal vollständig.'
            : ' Ketten-IDs oder Signer in Puls ergänzen.'}
        </p>
      ) : null}
      <p className="mt-1 text-sm text-muted-foreground">
        <strong className="text-foreground">Nicht</strong> <span className="font-mono text-xs">127.0.0.1</span> — das
        ist auf dem Handy das Gerät selbst. Trage die <strong>LAN-IPv4 deines PCs</strong> ein, z. B.{' '}
        <span className="font-mono text-xs">http://192.168.0.10:3342</span> (Boss normal starten, gleiches WLAN).
      </p>
      {loopbackWarn ? (
        <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-1.5 text-xs text-amber-950 dark:text-amber-50">
          {loopbackWarn}
        </p>
      ) : null}
      <label className="mt-3 block text-xs font-medium text-muted-foreground" htmlFor="cap-api-base">
        API-Basis (ohne abschließenden Schrägstrich)
      </label>
      <input
        id="cap-api-base"
        type="url"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="http://192.168.0.10:3342"
        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
        autoComplete="off"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={persist}
          className="rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Speichern
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft('')
            setSaved('')
            setTestMsg(null)
            try {
              window.localStorage.removeItem(API_BASE_OVERRIDE_KEY)
              window.dispatchEvent(new CustomEvent('morgendrot.apiBaseChanged'))
            } catch {
              // ignore
            }
          }}
          className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
        >
          Zurücksetzen
        </button>
        <button
          type="button"
          disabled={testing}
          onClick={() => void testConnection()}
          className="rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
        >
          {testing ? 'Prüfe…' : 'Verbindung testen'}
        </button>
        <button
          type="button"
          onClick={() => void applyFromBossQr()}
          className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
        >
          Boss Install-QR
        </button>
      </div>
      {testMsg ? (
        <p
          className={`mt-2 rounded-md px-2 py-1.5 text-xs ${
            testMsg.startsWith('OK')
              ? 'border border-emerald-500/35 bg-emerald-500/10'
              : 'border border-red-500/30 bg-red-500/10'
          }`}
        >
          {testMsg}
        </p>
      ) : null}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Aktiv: <span className="font-mono">{getApiBase() || '(nicht gesetzt — Standalone ohne Relay)'}</span>
        {saved || (isStandaloneDeviceMode() && getConfiguredDirectIotaRpcUrl())
          ? ''
          : ' — ohne URL und ohne Handoff/Direkt-RPC sind API-Funktionen nicht erreichbar.'}
      </p>
      {canUseAndroidForegroundSync() ? (
        <div className="mt-4 border-t border-border pt-4">
          <h5 className="text-sm font-semibold text-foreground">Android Hintergrund (§ H.6f)</h5>
          <p className="mt-1 text-xs text-muted-foreground">
            Foreground Service mit sichtbarer Benachrichtigung — hält den Prozess aktiv,{' '}
            <strong className="text-foreground">kein</strong> periodischer Abruf. Stoppt unter ~15 % Akku
            ohne Ladegerät. Web Bluetooth in der WebView bleibt vom OS abhängig.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={fgBusy}
              onClick={() => void toggleFgSync()}
              className="rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
            >
              {fgBusy ? '…' : fgEnabled ? 'Hintergrund-Sync aus' : 'Hintergrund-Sync an'}
            </button>
            <span className="text-[11px] text-muted-foreground">
              Service: {fgRunning ? 'läuft' : 'gestoppt'}
            </span>
          </div>
        </div>
      ) : null}
      {cameraDialog}
    </div>
  )
}
