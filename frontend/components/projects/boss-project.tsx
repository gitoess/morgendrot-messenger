'use client'

import { useState, useEffect } from 'react'
import { Crown, Users, Settings, Shield, RefreshCw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getConfig, setConfig } from '@/frontend/lib/api'

const PINNWAND_KEYS = [
  'ENABLE_BROADCAST_PINNWAND',
  'BROADCAST_PINNWAND_ADDRESS',
  'BROADCAST_AUTHORIZED_SENDERS',
]
const BOSS_KEYS = ['ROLE', 'BOSS_ADDRESS', 'KOMMANDANT_ADDRESSES', 'WORKER_ADDRESSES']

interface BossProjectProps {
  variant: 'boss-signer' | 'pinnwand-admin'
}

function ConfigRow({
  envKey,
  value,
  isBool,
  onSave,
}: {
  envKey: string
  value: string
  isBool: boolean
  onSave: (k: string, v: string) => Promise<void>
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
      <Label className="min-w-[200px] font-mono text-sm">{envKey}</Label>
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

export function BossProject({ variant }: BossProjectProps) {
  const getTitle = () => {
    switch (variant) {
      case 'boss-signer':
        return 'Boss-Signer & Maschinen'
      case 'pinnwand-admin':
        return 'Pinnwand-Verwaltung'
    }
  }

  const getDescription = () => {
    switch (variant) {
      case 'boss-signer':
        return 'Hierarchische Steuerung mit Delegierung'
      case 'pinnwand-admin':
        return 'Administriere Broadcast-Kanäle'
    }
  }

  const [configMap, setConfigMap] = useState<Record<string, string>>({})
  const [configLoading, setConfigLoading] = useState(false)

  const loadConfig = async () => {
    setConfigLoading(true)
    const res = await getConfig()
    if (res.ok && res.config) {
      const map: Record<string, string> = {}
      res.config.forEach((c) => {
        map[c.envKey] = c.value ?? ''
      })
      setConfigMap(map)
    }
    setConfigLoading(false)
  }

  useEffect(() => {
    loadConfig()
  }, [variant])

  const handleSetConfig = async (key: string, value: string) => {
    const res = await setConfig(key, value)
    if (res.ok) setConfigMap((m) => ({ ...m, [key]: value }))
  }

  if (variant === 'pinnwand-admin') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{getTitle()}</h2>
          <p className="text-muted-foreground">{getDescription()}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-card-foreground">
              Pinnwand-Konfiguration
            </h3>
            <Button variant="outline" size="sm" onClick={loadConfig} disabled={configLoading}>
              {configLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Aktualisieren'}
            </Button>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            ENABLE_BROADCAST_PINNWAND, BROADCAST_PINNWAND_ADDRESS, BROADCAST_AUTHORIZED_SENDERS
          </p>
          <div className="space-y-3">
            {PINNWAND_KEYS.map((k) => (
              <ConfigRow
                key={k}
                envKey={k}
                value={configMap[k] ?? ''}
                isBool={k === 'ENABLE_BROADCAST_PINNWAND'}
                onSave={handleSetConfig}
              />
            ))}
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

      <Tabs defaultValue="hierarchy" className="space-y-4">
        <TabsList>
          <TabsTrigger value="hierarchy" className="gap-2">
            <Users className="h-4 w-4" />
            Hierarchie
          </TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2">
            <Shield className="h-4 w-4" />
            Berechtigungen
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <Settings className="h-4 w-4" />
            Konfiguration
          </TabsTrigger>
        </TabsList>

        {/* Hierarchy Tab */}
        <TabsContent value="hierarchy" className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-card-foreground">
              <Crown className="h-5 w-5 text-primary" />
              Aktuelle Rolle
            </h3>
            <div className="flex items-center gap-3">
              <Badge className="bg-primary/10 text-primary">
                {(configMap.ROLE || 'boss').toUpperCase()}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {configMap.ROLE === 'arbeiter'
                  ? 'Ausführende Einheit'
                  : configMap.ROLE === 'kommandant'
                    ? 'Kann Arbeiter steuern'
                    : 'Vollzugriff auf alle Funktionen'}
              </span>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                <h4 className="font-semibold text-card-foreground">Boss</h4>
              </div>
              <div className="space-y-2">
                <Label>BOSS_ADDRESS</Label>
                <Input
                  placeholder="0x..."
                  value={configMap.BOSS_ADDRESS ?? ''}
                  onChange={(e) => setConfigMap((m) => ({ ...m, BOSS_ADDRESS: e.target.value }))}
                  onBlur={() => configMap.BOSS_ADDRESS != null && handleSetConfig('BOSS_ADDRESS', configMap.BOSS_ADDRESS)}
                />
                <p className="text-xs text-muted-foreground">
                  Oberste Autorität im System
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                <h4 className="font-semibold text-card-foreground">Kommandanten</h4>
              </div>
              <div className="space-y-2">
                <Label>KOMMANDANT_ADDRESSES</Label>
                <Input
                  placeholder="0x..., 0x..."
                  value={configMap.KOMMANDANT_ADDRESSES ?? ''}
                  onChange={(e) => setConfigMap((m) => ({ ...m, KOMMANDANT_ADDRESSES: e.target.value }))}
                  onBlur={() => configMap.KOMMANDANT_ADDRESSES != null && handleSetConfig('KOMMANDANT_ADDRESSES', configMap.KOMMANDANT_ADDRESSES)}
                />
                <p className="text-xs text-muted-foreground">
                  Können Arbeiter steuern
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <h4 className="font-semibold text-card-foreground">Arbeiter</h4>
              </div>
              <div className="space-y-2">
                <Label>WORKER_ADDRESSES</Label>
                <Input
                  placeholder="0x..., 0x..."
                  value={configMap.WORKER_ADDRESSES ?? ''}
                  onChange={(e) => setConfigMap((m) => ({ ...m, WORKER_ADDRESSES: e.target.value }))}
                  onBlur={() => configMap.WORKER_ADDRESSES != null && handleSetConfig('WORKER_ADDRESSES', configMap.WORKER_ADDRESSES)}
                />
                <p className="text-xs text-muted-foreground">
                  Ausführende Geräte
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions" className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="mb-4 font-semibold text-card-foreground">
              Berechtigungen pro Rolle
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <span className="font-medium text-card-foreground">
                    keyIssue
                  </span>
                  <p className="text-sm text-muted-foreground">
                    Schlüssel ausstellen können
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant="outline">Boss</Badge>
                  <Badge variant="outline">Kommandant</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <span className="font-medium text-card-foreground">
                    revokeDown
                  </span>
                  <p className="text-sm text-muted-foreground">
                    Untergeordnete widerrufen können
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant="outline">Boss</Badge>
                  <Badge variant="outline">Kommandant</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <span className="font-medium text-card-foreground">
                    commandDown
                  </span>
                  <p className="text-sm text-muted-foreground">
                    Befehle an Untergeordnete senden
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant="outline">Boss</Badge>
                  <Badge variant="outline">Kommandant</Badge>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Config Tab */}
        <TabsContent value="config" className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-card-foreground">
                Boss-Hierarchie (ROLE, BOSS_ADDRESS, KOMMANDANT_*, WORKER_*)
              </h3>
              <Button variant="outline" size="sm" onClick={loadConfig} disabled={configLoading}>
                {configLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Aktualisieren'}
              </Button>
            </div>
            <div className="space-y-3">
              {BOSS_KEYS.map((k) => (
                <ConfigRow
                  key={k}
                  envKey={k}
                  value={configMap[k] ?? ''}
                  isBool={false}
                  onSave={handleSetConfig}
                />
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="mb-4 font-semibold text-card-foreground">
              PTB (Programmable Transaction Blocks)
            </h3>
            <p className="text-sm text-muted-foreground">
              Mit PTB können mehrere Aktionen in einer einzigen Transaktion
              zusammengefasst werden. Das spart Gas und ermöglicht atomare
              Operationen.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
