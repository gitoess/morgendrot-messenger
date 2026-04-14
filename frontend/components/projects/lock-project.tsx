'use client'

import { useState, useEffect } from 'react'
import { Key, Ticket, CreditCard, List, Trash2, RefreshCw, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CommandForm } from '@/components/command-form'
import { listKeys, listTickets, getConfig, setConfig } from '@/frontend/lib/api'
import type { FormField } from '@/lib/types'

const LOCK_CONFIG_KEYS = [
  'ROLE',
  'LOCK_ID',
  'OPEN_COMMAND',
  'OPEN_URL',
  'OPEN_COMMAND_WORDS',
  'PAYMENT_TRIGGER_ENABLED',
  'OFFLINE_OPEN_ENABLED',
]
const PAYMENT_CONFIG_KEYS = [
  'PAYMENT_TRIGGER_ENABLED',
  'PAYMENT_TRIGGER_MIN_IOTA',
  'PAYMENT_TRIGGER_WEBHOOK_URL',
  'PAYMENT_TRIGGER_STATE',
]

interface LockProjectProps {
  variant: 'smart-lock' | 'access-key-ticket' | 'payment-trigger'
}

const createKeyFields: FormField[] = [
  {
    name: 'lockAddress',
    label: 'Lock-/Event-Adresse',
    placeholder: '0x...',
    required: true,
    helpText: 'Schloss oder Einlass-Gate Adresse',
  },
  {
    name: 'recipient',
    label: 'Empfänger-Adresse',
    placeholder: '0x...',
    required: true,
  },
  {
    name: 'ttl',
    label: 'Gültigkeit (Tage)',
    placeholder: '30',
    type: 'number',
    helpText: 'Optional: Wie lange der Schlüssel gültig sein soll',
  },
]

const createKeysFields: FormField[] = [
  ...createKeyFields,
  {
    name: 'count',
    label: 'Anzahl',
    placeholder: '50',
    type: 'number',
    required: true,
    helpText: 'Anzahl der zu erstellenden Schlüssel',
  },
]

const createKeyNotifyFields: FormField[] = [
  ...createKeyFields,
  {
    name: 'message',
    label: 'Nachricht',
    placeholder: 'Hier ist dein Schlüssel!',
    type: 'textarea',
    helpText: 'Klartext-Nachricht für den Empfänger',
  },
]

const createTicketFields: FormField[] = [
  {
    name: 'eventId',
    label: 'Event-ID',
    placeholder: '0x...',
    required: true,
  },
  {
    name: 'validFrom',
    label: 'Gültig ab (ms)',
    placeholder: 'Unix-Timestamp',
    type: 'number',
    required: true,
  },
  {
    name: 'validUntil',
    label: 'Gültig bis (ms)',
    placeholder: 'Unix-Timestamp',
    type: 'number',
    required: true,
  },
  {
    name: 'metadata',
    label: 'Metadata (Hex)',
    placeholder: 'Optional',
  },
  {
    name: 'recipient',
    label: 'Empfänger',
    placeholder: '0x...',
    required: true,
  },
]

const transferKeyFields: FormField[] = [
  {
    name: 'keyId',
    label: 'Key-ID',
    placeholder: '0x...',
    required: true,
  },
  {
    name: 'newOwner',
    label: 'Neuer Besitzer',
    placeholder: '0x...',
    required: true,
  },
]

const transferTicketFields: FormField[] = [
  {
    name: 'ticketId',
    label: 'Ticket-ID',
    placeholder: '0x...',
    required: true,
  },
  {
    name: 'newOwner',
    label: 'Neuer Besitzer',
    placeholder: '0x...',
    required: true,
  },
]

const useTicketFields: FormField[] = [
  {
    name: 'ticketId',
    label: 'Ticket-ID',
    placeholder: '0x...',
    required: true,
  },
  {
    name: 'eventId',
    label: 'Event-ID',
    placeholder: '0x...',
    required: true,
  },
]

const purgeKeyFields: FormField[] = [
  {
    name: 'keyId',
    label: 'Key-ID',
    placeholder: '0x...',
    required: true,
  },
]

const purgeTicketFields: FormField[] = [
  {
    name: 'ticketId',
    label: 'Ticket-ID',
    placeholder: '0x...',
    required: true,
  },
]

interface KeyData {
  id: string
  lockAddress?: string
  owner?: string
  validUntil?: number
}

interface TicketData {
  id: string
  eventId?: string
  owner?: string
  validFrom?: number
  validUntil?: number
  used?: boolean
}

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
  const handleSave = async () => {
    setSaving(true)
    await onSave(envKey, isBool ? (edit === 'true' ? 'false' : 'true') : edit)
    setSaving(false)
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded border border-border p-2">
      <Label className="min-w-[180px] font-mono text-sm">{envKey}</Label>
      {isBool ? (
        <>
          <Switch
            checked={edit === 'true'}
            onCheckedChange={(c) => setEdit(c ? 'true' : 'false')}
          />
          <Button size="sm" variant="secondary" onClick={handleSave} disabled={saving}>
            {saving ? '…' : 'Setzen'}
          </Button>
        </>
      ) : (
        <>
          <Input
            className="max-w-xs font-mono text-sm"
            value={edit}
            onChange={(e) => setEdit(e.target.value)}
          />
          <Button size="sm" variant="secondary" onClick={handleSave} disabled={saving}>
            {saving ? '…' : 'Setzen'}
          </Button>
        </>
      )}
    </div>
  )
}

export function LockProject({ variant }: LockProjectProps) {
  const [keys, setKeys] = useState<KeyData[]>([])
  const [tickets, setTickets] = useState<TicketData[]>([])
  const [loadingKeys, setLoadingKeys] = useState(false)
  const [loadingTickets, setLoadingTickets] = useState(false)
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
    if (res.ok) {
      setConfigMap((m) => ({ ...m, [key]: value }))
    }
  }

  const fetchKeys = async () => {
    setLoadingKeys(true)
    const response = await listKeys()
    if (response.ok && response.data) {
      setKeys(response.data as KeyData[])
    }
    setLoadingKeys(false)
  }

  const fetchTickets = async () => {
    setLoadingTickets(true)
    const response = await listTickets()
    if (response.ok && response.data) {
      setTickets(response.data as TicketData[])
    }
    setLoadingTickets(false)
  }

  const maskId = (id: string) => {
    if (id.length <= 14) return id
    return `${id.slice(0, 8)}...${id.slice(-4)}`
  }

  const getTitle = () => {
    switch (variant) {
      case 'smart-lock':
        return 'Smart-Lock Setup'
      case 'access-key-ticket':
        return 'AccessKey & Event-Ticket'
      case 'payment-trigger':
        return 'Zahlungs-Trigger'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">{getTitle()}</h2>
        <p className="text-muted-foreground">
          {variant === 'smart-lock' && 'Konfiguriere ein Schloss mit IOTA-Zugang'}
          {variant === 'access-key-ticket' &&
            'Erstelle und verwalte NFT-basierte Schlüssel und Tickets'}
          {variant === 'payment-trigger' &&
            'Ladesäule oder Geräte per IOTA-Zahlung freischalten'}
        </p>
      </div>

      <Tabs defaultValue="keys" className="space-y-4">
        <TabsList>
          <TabsTrigger value="keys" className="gap-2">
            <Key className="h-4 w-4" />
            Schlüssel
          </TabsTrigger>
          <TabsTrigger value="tickets" className="gap-2">
            <Ticket className="h-4 w-4" />
            Tickets
          </TabsTrigger>
          {variant === 'payment-trigger' && (
            <TabsTrigger value="payment" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Zahlung
            </TabsTrigger>
          )}
          <TabsTrigger value="config" className="gap-2">
            <Settings className="h-4 w-4" />
            Config
          </TabsTrigger>
        </TabsList>

        {/* Keys Tab */}
        <TabsContent value="keys" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-4">
              <CommandForm
                title="Schlüssel erstellen"
                description="Einen einzelnen AccessKey erstellen"
                command="/create-key"
                fields={createKeyFields}
                onSuccess={fetchKeys}
              />
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <CommandForm
                title="Mehrere Schlüssel erstellen"
                description="Batch-Erstellung von AccessKeys"
                command="/create-keys"
                fields={createKeysFields}
                onSuccess={fetchKeys}
              />
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <CommandForm
                title="Schlüssel + Nachricht"
                description="Schlüssel erstellen und Empfänger benachrichtigen"
                command="/create-key-and-notify"
                fields={createKeyNotifyFields}
                onSuccess={fetchKeys}
              />
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <CommandForm
                title="Schlüssel übertragen"
                description="Einen Schlüssel an einen neuen Besitzer übertragen"
                command="/transfer-key"
                fields={transferKeyFields}
                onSuccess={fetchKeys}
              />
            </div>
          </div>

          {/* Key List */}
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2">
                <List className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-card-foreground">Meine Schlüssel</h3>
                {keys.length > 0 && (
                  <Badge variant="secondary">{keys.length}</Badge>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchKeys}
                disabled={loadingKeys}
              >
                {loadingKeys ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Laden
                  </>
                )}
              </Button>
            </div>
            <div className="max-h-64 overflow-y-auto p-4">
              {keys.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">
                  Keine Schlüssel gefunden
                </p>
              ) : (
                <ul className="space-y-2">
                  {keys.map((key) => (
                    <li
                      key={key.id}
                      className="flex items-center justify-between rounded-lg border border-border p-3"
                    >
                      <div>
                        <span className="font-mono text-sm">{maskId(key.id)}</span>
                        {key.validUntil && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            bis {new Date(key.validUntil).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Purge Keys */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-4">
              <CommandForm
                title="Schlüssel löschen"
                description="Einen Schlüssel widerrufen (Rebate)"
                command="/purge-key"
                fields={purgeKeyFields}
                onSuccess={fetchKeys}
              />
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <CommandForm
                title="Notfall-Löschung"
                description="Sofortige Löschung ohne Rückerstattung"
                command="/emergency-purge-key"
                fields={purgeKeyFields}
                onSuccess={fetchKeys}
              />
            </div>
          </div>
        </TabsContent>

        {/* Tickets Tab */}
        <TabsContent value="tickets" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-4">
              <CommandForm
                title="Ticket erstellen"
                description="Ein Event-Ticket erstellen"
                command="/create-ticket"
                fields={createTicketFields}
                onSuccess={fetchTickets}
              />
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <CommandForm
                title="Ticket einlösen"
                description="Ein Ticket für den Einlass verwenden"
                command="/use-ticket"
                fields={useTicketFields}
                onSuccess={fetchTickets}
              />
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <CommandForm
                title="Ticket übertragen"
                description="Ein Ticket an einen neuen Besitzer übertragen"
                command="/transfer-ticket"
                fields={transferTicketFields}
                onSuccess={fetchTickets}
              />
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <CommandForm
                title="Ticket löschen"
                description="Ein Ticket widerrufen (Rebate)"
                command="/purge-ticket"
                fields={purgeTicketFields}
                onSuccess={fetchTickets}
              />
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <CommandForm
                title="Notfall-Löschung Ticket"
                description="Sofortige Löschung eines Tickets ohne Rückerstattung"
                command="/emergency-purge-ticket"
                fields={purgeTicketFields}
                onSuccess={fetchTickets}
              />
            </div>
          </div>

          {/* Ticket List */}
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2">
                <List className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-card-foreground">Meine Tickets</h3>
                {tickets.length > 0 && (
                  <Badge variant="secondary">{tickets.length}</Badge>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchTickets}
                disabled={loadingTickets}
              >
                {loadingTickets ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Laden
                  </>
                )}
              </Button>
            </div>
            <div className="max-h-64 overflow-y-auto p-4">
              {tickets.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">
                  Keine Tickets gefunden
                </p>
              ) : (
                <ul className="space-y-2">
                  {tickets.map((ticket) => (
                    <li
                      key={ticket.id}
                      className="flex items-center justify-between rounded-lg border border-border p-3"
                    >
                      <div>
                        <span className="font-mono text-sm">{maskId(ticket.id)}</span>
                        {ticket.used && (
                          <Badge variant="secondary" className="ml-2">
                            Eingelöst
                          </Badge>
                        )}
                      </div>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Payment Tab */}
        {variant === 'payment-trigger' && (
          <TabsContent value="payment" className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-card-foreground">
                  Zahlungs-Trigger Konfiguration
                </h3>
                <p className="text-sm text-muted-foreground">
                  Konfiguriere die Zahlungsauslöser für dein Gerät. Nach erfolgreicher
                  Zahlung wird automatisch ein AccessKey erstellt oder eine Aktion
                  ausgelöst.
                </p>
                <div className="space-y-3">
                  {PAYMENT_CONFIG_KEYS.map((k) => (
                    <ConfigKeyRow
                      key={k}
                      envKey={k}
                      value={configMap[k] ?? ''}
                      isBool={k === 'PAYMENT_TRIGGER_ENABLED'}
                      onSave={handleSetConfig}
                    />
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        )}

        <TabsContent value="config" className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-card-foreground">
                Smart-Lock / Lock Config
              </h3>
              <Button variant="outline" size="sm" onClick={loadConfig} disabled={configLoading}>
                {configLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Aktualisieren'}
              </Button>
            </div>
            <div className="space-y-3">
              {LOCK_CONFIG_KEYS.map((k) => (
                <ConfigKeyRow
                  key={k}
                  envKey={k}
                  value={configMap[k] ?? ''}
                  isBool={
                    k === 'PAYMENT_TRIGGER_ENABLED' || k === 'OFFLINE_OPEN_ENABLED'
                  }
                  onSave={handleSetConfig}
                />
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
