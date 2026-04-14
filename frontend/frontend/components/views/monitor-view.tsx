'use client'

import { useState, useEffect } from 'react'
import {
  Eye,
  Wifi,
  WifiOff,
  RefreshCw,
  Play,
  Pause,
  AlertTriangle,
  Flame,
  Droplets,
  DoorOpen,
  Activity,
  Check,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDeviceStatus, sendHeartbeat, setHeartbeatInterval } from '@/frontend/lib/api'
import type { DeviceStatus } from '../../lib/types'

interface MonitorViewProps {
  variant: 'sensor-central' | 'device-monitor' | 'heartbeat-sender'
}

export function MonitorView({ variant }: MonitorViewProps) {
  const [devices, setDevices] = useState<DeviceStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [heartbeatActive, setHeartbeatActive] = useState(false)
  const [interval, setIntervalValue] = useState('30000')
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [statusMsg, setStatusMsg] = useState('')

  const loadDevices = async () => {
    setLoading(true)
    const res = await getDeviceStatus()
    if (res.ok && res.data) setDevices(res.data)
    setLoading(false)
  }

  useEffect(() => {
    if (variant !== 'heartbeat-sender') {
      loadDevices()
      const timer = setInterval(loadDevices, 15000)
      return () => clearInterval(timer)
    }
  }, [variant])

  const showStatus = (success: boolean, msg: string) => {
    setStatus(success ? 'success' : 'error')
    setStatusMsg(msg)
    setTimeout(() => setStatus('idle'), 3000)
  }

  const handleSendHeartbeat = async () => {
    const res = await sendHeartbeat()
    showStatus(res.ok, res.ok ? 'Heartbeat gesendet!' : res.error || 'Fehler')
  }

  const handleSetInterval = async () => {
    const ms = parseInt(interval)
    if (isNaN(ms) || ms < 1000) return
    const res = await setHeartbeatInterval(ms)
    showStatus(res.ok, res.ok ? `Interval auf ${ms}ms gesetzt` : res.error || 'Fehler')
  }

  const toggleHeartbeat = () => {
    setHeartbeatActive(!heartbeatActive)
    if (!heartbeatActive) {
      handleSendHeartbeat()
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-emerald-500'
      case 'warning': return 'bg-amber-500'
      case 'offline': return 'bg-red-500'
      default: return 'bg-muted'
    }
  }

  const getSensorIcon = (name: string) => {
    if (name.toLowerCase().includes('rauch') || name.toLowerCase().includes('fire')) {
      return <Flame className="h-5 w-5" />
    }
    if (name.toLowerCase().includes('wasser') || name.toLowerCase().includes('water')) {
      return <Droplets className="h-5 w-5" />
    }
    if (name.toLowerCase().includes('tür') || name.toLowerCase().includes('door')) {
      return <DoorOpen className="h-5 w-5" />
    }
    return <AlertTriangle className="h-5 w-5" />
  }

  const getTitle = () => {
    switch (variant) {
      case 'sensor-central': return 'Sensor-Zentrale'
      case 'device-monitor': return 'Geräte-Monitor'
      case 'heartbeat-sender': return 'Heartbeat-Sender'
    }
  }

  const getDescription = () => {
    switch (variant) {
      case 'sensor-central': return 'Überwache Sensoren und empfange Alarme'
      case 'device-monitor': return 'Prüfe den Online-Status deiner Geräte'
      case 'heartbeat-sender': return 'Sende regelmäßig Lebenszeichen'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
          {variant === 'heartbeat-sender' ? (
            <Activity className="h-6 w-6" />
          ) : (
            <Eye className="h-6 w-6" />
          )}
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{getTitle()}</h2>
          <p className="text-sm text-muted-foreground">{getDescription()}</p>
        </div>
      </div>

      {/* Status */}
      {status !== 'idle' && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg p-3 text-sm font-medium',
            status === 'success'
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-red-500/10 text-red-400'
          )}
        >
          {status === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {statusMsg}
        </div>
      )}

      {/* Heartbeat Sender */}
      {variant === 'heartbeat-sender' && (
        <div className="space-y-4">
          {/* Heartbeat Control */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex flex-col items-center gap-6 text-center">
              <div
                className={cn(
                  'flex h-24 w-24 items-center justify-center rounded-full transition-colors',
                  heartbeatActive
                    ? 'animate-pulse bg-emerald-500/20 text-emerald-400'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                <Activity className="h-12 w-12" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {heartbeatActive ? 'Heartbeat aktiv' : 'Heartbeat inaktiv'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {heartbeatActive
                    ? 'Sendet alle ' + (parseInt(interval) / 1000) + ' Sekunden'
                    : 'Klicke zum Starten'}
                </p>
              </div>
              <button
                onClick={toggleHeartbeat}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium transition-colors',
                  heartbeatActive
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-emerald-500 text-white hover:bg-emerald-600'
                )}
              >
                {heartbeatActive ? (
                  <>
                    <Pause className="h-4 w-4" />
                    Stoppen
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Starten
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Interval Settings */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="mb-4 font-semibold text-foreground">Einstellungen</h4>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1.5 block text-sm text-muted-foreground">
                  Interval (Millisekunden)
                </label>
                <input
                  type="number"
                  value={interval}
                  onChange={(e) => setIntervalValue(e.target.value)}
                  min="1000"
                  step="1000"
                  className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground focus:border-primary focus:outline-none"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleSetInterval}
                  className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent/80"
                >
                  Speichern
                </button>
              </div>
            </div>
          </div>

          {/* Manual Send */}
          <button
            onClick={handleSendHeartbeat}
            className="w-full rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-accent"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-foreground">Einzelnes Heartbeat senden</span>
                <p className="text-sm text-muted-foreground">Sendet sofort ein Lebenszeichen</p>
              </div>
              <Activity className="h-5 w-5 text-muted-foreground" />
            </div>
          </button>
        </div>
      )}

      {/* Device Monitor / Sensor Central */}
      {variant !== 'heartbeat-sender' && (
        <div className="space-y-4">
          {/* Refresh */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Automatische Aktualisierung alle 15 Sekunden
            </span>
            <button
              onClick={loadDevices}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              Jetzt aktualisieren
            </button>
          </div>

          {/* Summary */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Wifi className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-2xl font-bold text-emerald-400">
                    {devices.filter((d) => d.status === 'online').length}
                  </span>
                  <p className="text-sm text-muted-foreground">Online</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-2xl font-bold text-amber-400">
                    {devices.filter((d) => d.status === 'warning').length}
                  </span>
                  <p className="text-sm text-muted-foreground">Warnung</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/20 text-red-400">
                  <WifiOff className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-2xl font-bold text-red-400">
                    {devices.filter((d) => d.status === 'offline').length}
                  </span>
                  <p className="text-sm text-muted-foreground">Offline</p>
                </div>
              </div>
            </div>
          </div>

          {/* Device List */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border p-4">
              <h4 className="font-semibold text-foreground">
                {variant === 'sensor-central' ? 'Sensoren' : 'Geräte'}
              </h4>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {devices.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Eye className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  Keine Geräte gefunden
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {devices.map((device) => (
                    <li key={device.id} className="flex items-center justify-between p-4 hover:bg-accent/50">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-lg',
                            device.status === 'online' && 'bg-emerald-500/10 text-emerald-400',
                            device.status === 'warning' && 'bg-amber-500/10 text-amber-400',
                            device.status === 'offline' && 'bg-red-500/10 text-red-400'
                          )}
                        >
                          {variant === 'sensor-central' ? getSensorIcon(device.name) : <Eye className="h-5 w-5" />}
                        </div>
                        <div>
                          <span className="font-medium text-foreground">{device.name}</span>
                          <p className="font-mono text-xs text-muted-foreground">
                            {device.address.slice(0, 8)}...{device.address.slice(-4)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {device.lastSeen > 0 && new Date(device.lastSeen).toLocaleTimeString('de-DE')}
                        </span>
                        <div className={cn('h-3 w-3 rounded-full', getStatusColor(device.status))} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
