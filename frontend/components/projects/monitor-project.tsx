'use client'

import { useState, useEffect } from 'react'
import {
  Eye,
  Radio,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  FileText,
  Download,
  Settings,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { getConfig, setConfig } from '@/frontend/lib/api'
import type { MonitorDevice } from '@/lib/types'

const MONITOR_CONFIG_KEYS = [
  'MONITOR_DEVICES',
  'MONITOR_TIMEOUT_SEC',
  'MONITOR_CHECK_INTERVAL_SEC',
  'MONITOR_WEBHOOK_URL',
  'MONITOR_STATE_PATH',
  'ENABLE_HEARTBEAT',
]

function ConfigKeyRow({
  envKey,
  value,
  isBool,
  onSave,
}: {
  envKey: string
  value: string
  isBool: boolean
  onSave: (key: string, value: string) => Promise<void>
}) {
  const [edit, setEdit] = useState(value)
  const [saving, setSaving] = useState(false)
  useEffect(() => setEdit(value), [value])
  const save = async () => {
    setSaving(true)
    await onSave(envKey, isBool ? (edit === 'true' ? 'false' : 'true') : edit)
    setSaving(false)
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded border border-border p-2">
      <Label className="min-w-[220px] font-mono text-sm">{envKey}</Label>
      {isBool ? (
        <>
          <Switch checked={edit === 'true'} onCheckedChange={(c) => setEdit(c ? 'true' : 'false')} />
          <Button size="sm" variant="secondary" onClick={save} disabled={saving}>
            {saving ? '…' : 'Setzen'}
          </Button>
        </>
      ) : (
        <>
          <Input className="max-w-md font-mono text-sm" value={edit} onChange={(e) => setEdit(e.target.value)} />
          <Button size="sm" variant="secondary" onClick={save} disabled={saving}>
            {saving ? '…' : 'Setzen'}
          </Button>
        </>
      )}
    </div>
  )
}

interface MonitorProjectProps {
  variant: 'sensor-central' | 'device-monitor' | 'heartbeat-sender'
}

// Build device list from MONITOR_DEVICES (comma-separated addresses)
function devicesFromConfig(devicesStr: string): MonitorDevice[] {
  if (!devicesStr || !devicesStr.trim()) return []
  return devicesStr
    .split(/[\s,]+/)
    .map((a) => a.trim())
    .filter(Boolean)
    .map((address) => ({
      address,
      name: address.length > 16 ? `${address.slice(0, 8)}…${address.slice(-6)}` : address,
      status: 'online' as const,
      lastSeen: Date.now(),
      sensor: '-',
      purgeable: false,
    }))
}

export function MonitorProject({ variant }: MonitorProjectProps) {
  const [devices, setDevices] = useState<MonitorDevice[]>([])
  const [loading, setLoading] = useState(false)
  const [configMap, setConfigMap] = useState<Record<string, string>>({})
  const [configLoading, setConfigLoading] = useState(false)
  const [heartbeatEnabled, setHeartbeatEnabled] = useState(false)

  const loadConfig = async () => {
    setConfigLoading(true)
    const res = await getConfig()
    if (res.ok && res.config) {
      const map: Record<string, string> = {}
      res.config.forEach((c) => {
        map[c.envKey] = c.value ?? ''
      })
      setConfigMap(map)
      const devStr = res.config.find((c) => c.envKey === 'MONITOR_DEVICES')?.value ?? ''
      setDevices(devicesFromConfig(devStr))
      const hb = res.config.find((c) => c.envKey === 'ENABLE_HEARTBEAT')?.value
      setHeartbeatEnabled(hb === 'true')
    }
    setConfigLoading(false)
  }

  useEffect(() => {
    loadConfig()
  }, [variant])

  const handleSetConfig = async (key: string, value: string) => {
    const res = await setConfig(key, value)
    if (res.ok) {
      setConfigMap((m) => ({ ...m, [key]: value }))
      if (key === 'MONITOR_DEVICES') setDevices(devicesFromConfig(value))
      if (key === 'ENABLE_HEARTBEAT') setHeartbeatEnabled(value === 'true')
    }
  }

  const getTitle = () => {
    switch (variant) {
      case 'sensor-central':
        return 'Sensor-Zentrale'
      case 'device-monitor':
        return 'Geräte-Monitor'
      case 'heartbeat-sender':
        return 'Heartbeat-Sender'
    }
  }

  const getDescription = () => {
    switch (variant) {
      case 'sensor-central':
        return 'Rauch, Wasser, Einbruch - Alarm-Management'
      case 'device-monitor':
        return 'Überwache mehrere Geräte auf Offline-Status'
      case 'heartbeat-sender':
        return 'Dieses Gerät sendet regelmäßig Lebenszeichen'
    }
  }

  const getStatusIcon = (status: MonitorDevice['status']) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="h-4 w-4 text-primary" />
      case 'offline':
        return <XCircle className="h-4 w-4 text-destructive" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusBadge = (status: MonitorDevice['status']) => {
    switch (status) {
      case 'online':
        return <Badge className="bg-primary/10 text-primary">Online</Badge>
      case 'offline':
        return <Badge variant="destructive">Offline</Badge>
      case 'warning':
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600">Warnung</Badge>
        )
    }
  }

  const formatLastSeen = (timestamp?: number) => {
    if (!timestamp) return '-'
    const diff = Date.now() - timestamp
    if (diff < 60000) return 'Gerade eben'
    if (diff < 3600000) return `vor ${Math.floor(diff / 60000)} Min.`
    if (diff < 86400000) return `vor ${Math.floor(diff / 3600000)} Std.`
    return new Date(timestamp).toLocaleDateString('de-DE')
  }

  const refreshDevices = async () => {
    setLoading(true)
    await loadConfig()
    setLoading(false)
  }

  if (variant === 'heartbeat-sender') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{getTitle()}</h2>
          <p className="text-muted-foreground">{getDescription()}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Radio className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-card-foreground">
                  Heartbeat aktivieren
                </h3>
                <p className="text-sm text-muted-foreground">
                  Sendet regelmäßig Lebenszeichen an den Monitor
                </p>
              </div>
            </div>
            <Switch
              checked={heartbeatEnabled}
              onCheckedChange={async (checked) => {
                setHeartbeatEnabled(checked)
                await handleSetConfig('ENABLE_HEARTBEAT', checked ? 'true' : 'false')
              }}
            />
          </div>

          {heartbeatEnabled && (
            <div className="mt-6 space-y-4 border-t border-border pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-primary" />
                <span className="text-sm text-card-foreground">
                  Heartbeat aktiv - Letzter Ping: Gerade eben
                </span>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>Intervall (Sekunden)</Label>
                  <Input type="number" defaultValue="30" />
                </div>
                <div className="space-y-2">
                  <Label>Monitor-Adresse</Label>
                  <Input placeholder="0x..." />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="mb-4 font-semibold text-card-foreground">Konfiguration</h3>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Geräte-Name</Label>
              <Input placeholder="Mein Gerät" />
            </div>
            <div className="space-y-2">
              <Label>Sensor-Typ</Label>
              <Input placeholder="z.B. temperature, door, motion" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{getTitle()}</h2>
        <p className="text-muted-foreground">{getDescription()}</p>
      </div>

      <Tabs defaultValue="devices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="devices" className="gap-2">
            <Eye className="h-4 w-4" />
            Geräte
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <Settings className="h-4 w-4" />
            Konfiguration
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <FileText className="h-4 w-4" />
            Audit
          </TabsTrigger>
        </TabsList>

        {/* Devices Tab */}
        <TabsContent value="devices" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="gap-1">
                <CheckCircle className="h-3 w-3 text-primary" />
                {devices.filter((d) => d.status === 'online').length} Online
              </Badge>
              <Badge variant="outline" className="gap-1">
                <XCircle className="h-3 w-3 text-destructive" />
                {devices.filter((d) => d.status === 'offline').length} Offline
              </Badge>
              <Badge variant="outline" className="gap-1">
                <AlertTriangle className="h-3 w-3 text-yellow-500" />
                {devices.filter((d) => d.status === 'warning').length} Warnung
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshDevices}
              disabled={loading}
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Aktualisieren
                </>
              )}
            </Button>
          </div>

          <div className="rounded-lg border border-border">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Gerät
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Zuletzt
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Sensor
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Purgebar
                  </th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr
                    key={device.address}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium text-card-foreground">
                          {device.name}
                        </span>
                        <span className="block font-mono text-xs text-muted-foreground">
                          {device.address}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(device.status)}
                        {getStatusBadge(device.status)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatLastSeen(device.lastSeen)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{device.sensor}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {device.purgeable ? (
                        <Badge variant="secondary">Ja</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">Nein</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Config Tab */}
        <TabsContent value="config" className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-card-foreground">
                Monitor-Config (MONITOR_*, ENABLE_HEARTBEAT)
              </h3>
              <Button variant="outline" size="sm" onClick={loadConfig} disabled={configLoading}>
                {configLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Aktualisieren'}
              </Button>
            </div>
            <div className="space-y-3">
              {MONITOR_CONFIG_KEYS.map((k) => (
                <ConfigKeyRow
                  key={k}
                  envKey={k}
                  value={configMap[k] ?? ''}
                  isBool={k === 'ENABLE_HEARTBEAT'}
                  onSave={handleSetConfig}
                />
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Audit Tab */}
        <TabsContent value="audit" className="space-y-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Audit CSV
            </Button>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Audit PDF
            </Button>
          </div>
          <div className="rounded-lg border border-border bg-card p-6">
            <p className="text-center text-muted-foreground">
              Audit-Logs werden hier angezeigt
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
