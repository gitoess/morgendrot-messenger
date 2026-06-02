'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, RefreshCw, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { fetchStatus, getConfig, setConfig } from '@/frontend/lib/api'
import {
  CONFIG_ENV_DEPLOY_INTRO,
  CONFIG_KEYS_LEGACY_PARTNER,
  getConfigFieldMeta,
  resolveConfigInputKind,
  shouldShowConfigKeyInMessenger,
} from '@/frontend/lib/config-env-field-meta'

export function ConfigView({
  embedded = false,
  messengerMode = false,
}: {
  embedded?: boolean
  messengerMode?: boolean
}) {
  const [items, setItems] = useState<Array<{ key: string; value: string; envKey: string }>>([])
  const [runtimeKeys, setRuntimeKeys] = useState<Set<string>>(new Set())
  const [runtimeSourceMap, setRuntimeSourceMap] = useState<Record<string, 'env' | 'runtime'>>({})
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [showLegacy, setShowLegacy] = useState(false)

  const load = async () => {
    setLoading(true)
    const [res, status] = await Promise.all([getConfig(), fetchStatus()])
    if (res.ok && res.config) {
      setItems(res.config)
    } else {
      setItems([])
    }
    if ('pollClockHint' in status) {
      const nextKeys = new Set((status.runtimeConfigKeys ?? []).map((k) => String(k || '').trim().toUpperCase()))
      setRuntimeKeys(nextKeys)
      setRuntimeSourceMap({
        SIGNER: status.signerConfigSource ?? 'env',
        WALLET_DERIVATION_PATH: status.walletDerivationPathConfigSource ?? 'env',
        USE_MAILBOX: status.useMailboxConfigSource ?? 'env',
        MAILBOX_STORE_PLAINTEXT: status.mailboxStorePlaintextConfigSource ?? 'env',
        ENABLE_PLAINTEXT_CHANNEL: status.enablePlaintextChannelConfigSource ?? 'env',
      })
    } else {
      setRuntimeKeys(new Set())
      setRuntimeSourceMap({})
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

  const visibleItems = items.filter((item) =>
    messengerMode ? shouldShowConfigKeyInMessenger(item.envKey, { showLegacy }) : true
  )
  const legacyItems = messengerMode
    ? items.filter((item) => CONFIG_KEYS_LEGACY_PARTNER.has(item.envKey))
    : []

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-6'}>
      {!embedded ? (
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Settings className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Konfiguration</h2>
            <p className="text-sm text-muted-foreground">Keys anzeigen und setzen.</p>
          </div>
        </div>
      ) : messengerMode ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {CONFIG_ENV_DEPLOY_INTRO}{' '}
          <a
            href="/handbook?file=ENV-MESSENGER-EINSTELLUNGEN-REFERENZ.md"
            className="text-primary underline hover:no-underline"
          >
            Handbuch: alle Messenger-.env-Keys
          </a>
          . Nur Messenger-relevante Keys — Shop, Lock, Monitor und Server-Ports siehst du im{' '}
          <strong className="text-foreground">Morgendrot Projekt</strong>.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Alle Keys vom Backend. Runtime-Keys gelten sofort; andere oft nach Neustart.
        </p>
      )}

      {!embedded ? (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
            <span className="ml-2">Aktualisieren</span>
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {visibleItems.length === 0 ? (
            <p className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground">
              Keine weiteren Keys — oder Backend nicht erreichbar.
            </p>
          ) : (
            visibleItems.map((item) => (
              <ConfigRow
                key={item.envKey}
                envKey={item.envKey}
                value={item.value}
                source={runtimeSourceMap[item.envKey] ?? (runtimeKeys.has(item.envKey) ? 'runtime' : 'env')}
                saving={savingKey === item.envKey}
                onSave={handleSet}
              />
            ))
          )}

          {messengerMode && legacyItems.length > 0 ? (
            <Collapsible open={showLegacy} onOpenChange={setShowLegacy}>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:bg-accent/30">
                <span>Veraltet (Lite-UI /connect — im Messenger Telefonbuch nutzen)</span>
                <ChevronDown className={cn('h-4 w-4', showLegacy && 'rotate-180')} />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {legacyItems.map((item) => (
                  <ConfigRow
                    key={item.envKey}
                    envKey={item.envKey}
                    value={item.value}
                    source="env"
                    saving={savingKey === item.envKey}
                    onSave={handleSet}
                    deprecated
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
          ) : null}
        </div>
      )}
    </div>
  )
}

function ConfigRow({
  envKey,
  value,
  source,
  saving,
  onSave,
  deprecated = false,
}: {
  envKey: string
  value: string
  source: 'env' | 'runtime'
  saving: boolean
  onSave: (key: string, value: string) => Promise<void>
  deprecated?: boolean
}) {
  const [edit, setEdit] = useState(value)
  const [open, setOpen] = useState(false)
  useEffect(() => setEdit(value), [value])

  const meta = getConfigFieldMeta(envKey)
  const inputKind = resolveConfigInputKind(envKey, value)
  const isBool = inputKind === 'bool'
  const isSelect = inputKind === 'select' && meta.selectOptions?.length

  const save = async (next?: string) => {
    const v = next ?? (isBool ? (edit === 'true' ? 'false' : 'true') : edit)
    await onSave(envKey, v)
    if (isBool) setEdit(v)
  }

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-3',
        deprecated ? 'border-dashed border-muted-foreground/40' : 'border-border'
      )}
    >
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="font-mono text-sm text-foreground">{envKey}</Label>
            <span
              className={`rounded border px-2 py-0.5 text-[10px] ${
                source === 'runtime'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-border bg-muted text-muted-foreground'
              }`}
            >
              {source === 'runtime' ? 'Runtime' : '.env'}
            </span>
          </div>
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger className="mt-1 flex items-center gap-1 text-[11px] text-primary hover:underline">
              <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
              Erklärung
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {meta.description}
              {meta.deployHint ? (
                <p className="mt-1 text-foreground/80">
                  <strong>Deploy:</strong> {meta.deployHint}
                </p>
              ) : null}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {isBool ? (
          <>
            <Switch checked={edit === 'true'} onCheckedChange={() => void save(edit === 'true' ? 'false' : 'true')} />
            <span className="text-xs text-muted-foreground">{edit === 'true' ? 'an' : 'aus'}</span>
            <Button size="sm" variant="secondary" onClick={() => save()} disabled={saving}>
              {saving ? '…' : 'Setzen'}
            </Button>
          </>
        ) : isSelect ? (
          <>
            <Select value={edit || meta.selectOptions![0].value} onValueChange={(v) => setEdit(v)}>
              <SelectTrigger className="h-9 max-w-md flex-1 font-mono text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {meta.selectOptions!.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="secondary" onClick={() => save()} disabled={saving || edit === value}>
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
            <Button size="sm" variant="secondary" onClick={() => save()} disabled={saving || edit === value}>
              {saving ? '…' : 'Setzen'}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
