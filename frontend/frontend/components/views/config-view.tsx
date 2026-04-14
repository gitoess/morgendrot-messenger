'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { getConfig, setConfig } from '@/frontend/lib/api'

export function ConfigView() {
  const [items, setItems] = useState<Array<{ key: string; value: string; envKey: string }>>([])
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await getConfig()
    if (res.ok && res.config) {
      setItems(res.config)
    } else {
      setItems([])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleSet = async (envKey: string, value: string) => {
    setSavingKey(envKey)
    await setConfig(envKey, value)
    setItems((prev) => prev.map((c) => (c.envKey === envKey ? { ...c, value } : c)))
    setSavingKey(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">.env anpassen</h2>
          <p className="text-sm text-muted-foreground">
            Konfigurations-Keys anzeigen und setzen (GET/POST /api/config). Für Tor:{' '}
            <span className="font-mono text-foreground">RPC_SOCKS_PROXY</span> z. B.{' '}
            <span className="font-mono">socks5://127.0.0.1:9050</span> – der laufende Backend-Prozess nutzt den Proxy
            sofort für alle IOTA-RPC-Calls (ohne Neustart).
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
          <span className="ml-2">Aktualisieren</span>
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {items.length === 0 ? (
            <p className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
              Keine Config geladen oder Backend nicht erreichbar.
            </p>
          ) : (
            items.map((item) => (
              <ConfigRow
                key={item.envKey}
                envKey={item.envKey}
                value={item.value}
                saving={savingKey === item.envKey}
                onSave={handleSet}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function ConfigRow({
  envKey,
  value,
  saving,
  onSave,
}: {
  envKey: string
  value: string
  saving: boolean
  onSave: (key: string, value: string) => Promise<void>
}) {
  const [edit, setEdit] = useState(value)
  useEffect(() => setEdit(value), [value])
  const isBool = value === 'true' || value === 'false'

  const save = async () => {
    await onSave(envKey, isBool ? (edit === 'true' ? 'false' : 'true') : edit)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
      <Label className="min-w-[200px] font-mono text-sm text-muted-foreground">
        {envKey}
      </Label>
      {isBool ? (
        <>
          <Switch
            checked={edit === 'true'}
            onCheckedChange={(c) => setEdit(c ? 'true' : 'false')}
          />
          <Button size="sm" variant="secondary" onClick={save} disabled={saving}>
            {saving ? '…' : 'Setzen'}
          </Button>
        </>
      ) : (
        <>
          <Input
            className="max-w-md flex-1 font-mono text-sm"
            value={edit}
            onChange={(e) => setEdit(e.target.value)}
          />
          <Button size="sm" variant="secondary" onClick={save} disabled={saving}>
            {saving ? '…' : 'Setzen'}
          </Button>
        </>
      )}
    </div>
  )
}
