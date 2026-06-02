'use client'

import { useCallback, useEffect, useState } from 'react'
import { API_BASE_OVERRIDE_KEY, getApiBase } from '@/frontend/lib/api/api-base'
import { getNativeLoopbackApiBaseWarning } from '@/frontend/lib/api-base-native-hints'
import { shouldShowCapacitorApiBaseSettings } from '@/frontend/lib/capacitor-platform'
import { fetchStatus } from '@/frontend/lib/api/status'
import { applyInstallQrApiBase, parseInstallQrPayload } from '@/frontend/lib/install-qr'
import { scanMeshBundleQrWithCamera } from '@/frontend/lib/mesh-qr'

export function CapacitorApiBaseCard() {
  const [visible, setVisible] = useState(false)
  const [draft, setDraft] = useState('')
  const [saved, setSaved] = useState('')
  const [testMsg, setTestMsg] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    setVisible(shouldShowCapacitorApiBaseSettings())
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
      setTestMsg('Zuerst URL speichern.')
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
          `Keine gültige Antwort. Am PC: npm run dev:lan, Firewall TCP 3342, gleiches WLAN. Ziel: ${base}`
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
      <p className="mt-1 text-sm text-muted-foreground">
        <strong className="text-foreground">Nicht</strong> <span className="font-mono text-xs">127.0.0.1</span> — das
        ist auf dem Handy das Gerät selbst. Trage die <strong>LAN-IPv4 deines PCs</strong> ein (am PC:{' '}
        <span className="font-mono text-xs">ipconfig</span>), z. B.{' '}
        <span className="font-mono text-xs">http://192.168.0.10:3342</span>. Am PC:{' '}
        <code className="rounded bg-muted px-1 text-xs">npm run dev:lan</code> (API auf allen Interfaces).
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
        Aktiv: <span className="font-mono">{getApiBase() || '(nicht gesetzt)'}</span>
        {saved ? '' : ' — ohne URL sind API-Aufrufe in der APK nicht erreichbar.'}
      </p>
    </div>
  )
}
