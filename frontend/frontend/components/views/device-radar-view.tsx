'use client'

import { useState, useEffect } from 'react'
import { Radio, RefreshCw, Wifi, WifiOff, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchMonitorStatus } from '@/frontend/lib/api'

/** API liefert device (string), lastSeen, status ('online'|'offline'|'alarm'). */
type MonitorDevice = { device: string; lastSeen: number; status: 'online' | 'offline' | 'alarm' }

/**
 * Geräte-Radar: Liste Worker/Geräte mit Status (`GET /api/monitor-status`).
 * Wird oben auf dem Next-Dashboard gerendert, wenn `dashboard.tsx` `showDeviceRadar` true ist
 * (Arbeitsbereich `morgendrot_workspace_tile_set` = **full**; im Messenger-Bundle typ. nur **Boss**).
 * Im Arbeitsbereich **Messenger** (`messenger`) wird diese Sektion **nicht** angezeigt — Monitoring gehört zur
 * **Hauptprojekt-/Volldashboard-Linie**, nicht zum schlanken Messenger-Fokus (`docs/UI-ROLLEN-WORKSPACES.md` §7.1).
 * Nicht zu verwechseln mit: Chat-**Boss-Übersicht** (`bossView`, Posteingang) oder `morgendrot_show_all_tiles`.
 */
export function DeviceRadarView() {
  const [devices, setDevices] = useState<MonitorDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    const res = await fetchMonitorStatus()
    if (res.ok && res.devices) setDevices((res.devices as MonitorDevice[]) || [])
    else setError(res.error || 'Geräte konnten nicht geladen werden.')
    setLoading(false)
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [])

  const statusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-emerald-500'
      case 'warning':
      case 'alarm':
        return 'bg-amber-500'
      case 'offline':
        return 'bg-red-500'
      default:
        return 'bg-muted'
    }
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <Wifi className="h-4 w-4 text-emerald-400" />
      case 'offline':
        return <WifiOff className="h-4 w-4 text-red-400" />
      case 'alarm':
      default:
        return <AlertTriangle className="h-4 w-4 text-amber-400" />
    }
  }

  const formatLastSeen = (lastSeen?: number) => {
    if (!lastSeen) return '–'
    const d = new Date(lastSeen)
    const now = Date.now()
    const diff = Math.floor((now - lastSeen) / 1000)
    if (diff < 60) return 'gerade eben'
    if (diff < 3600) return `vor ${Math.floor(diff / 60)} min`
    return d.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-foreground">
          <Radio className="h-5 w-5 text-purple-400" />
          Geräte-Radar
        </h3>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted/50 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Aktualisieren
        </button>
      </div>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Monitoring-Kachel (nicht Chat-Posteingang): sichtbar bei Dashboard-Arbeitsbereich{' '}
        <span className="font-mono">full</span> — Daten <span className="font-mono">GET /api/monitor-status</span> (**§ H.0** /
        **`docs/UI-ROLLEN-WORKSPACES.md`** §6).
      </p>
      {error && (
        <p className="mb-3 text-sm text-red-400">{error}</p>
      )}
      {loading && devices.length === 0 ? (
        <p className="text-sm text-muted-foreground">Lade Geräte…</p>
      ) : devices.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine Geräte (Monitor nicht aktiv oder keine Heartbeats).</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Gerät</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 font-medium">Zuletzt</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d, i) => (
                <tr
                  key={`${i}-${d.lastSeen}-${d.device || 'unknown'}`}
                  className="border-b border-border/50"
                >
                  <td className="py-2 pr-4">
                    <span className="font-medium text-foreground">{d.device}</span>
                  </td>
                  <td className="py-2 pr-4">
                    <span className="flex items-center gap-1.5">
                      <span className={cn('h-2 w-2 rounded-full', statusColor(d.status))} />
                      {statusIcon(d.status)}
                      <span className="capitalize">{d.status === 'alarm' ? 'Alarm' : d.status}</span>
                    </span>
                  </td>
                  <td className="py-2 text-muted-foreground">{formatLastSeen(d.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
