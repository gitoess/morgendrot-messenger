'use client'

import { useState } from 'react'
import {
  Shield,
  AlertTriangle,
  Lock,
  Unlock,
  Trash2,
  Database,
  Cloud,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CommandForm } from '@/components/command-form'
import type { FormField } from '@/lib/types'

interface VaultProjectProps {
  variant: 'local-vault' | 'emergency-purge'
}

const purgeMsgFields: FormField[] = [
  {
    name: 'nonce',
    label: 'Nonce',
    placeholder: 'z.B. 123',
    type: 'number',
    required: true,
    helpText: 'Die Nonce der zu löschenden Nachricht',
  },
]

export function VaultProject({ variant }: VaultProjectProps) {
  const [purgeConfirm, setPurgeConfirm] = useState('')
  const [isPurging, setIsPurging] = useState(false)

  const getTitle = () => {
    switch (variant) {
      case 'local-vault':
        return 'Lokaler Tresor / On-Chain'
      case 'emergency-purge':
        return 'Notfall-Löschung'
    }
  }

  const getDescription = () => {
    switch (variant) {
      case 'local-vault':
        return 'Geheime Daten sicher speichern'
      case 'emergency-purge':
        return 'Schnelle Bereinigung aller sensiblen Daten'
    }
  }

  const handleEmergencyPurge = async () => {
    if (purgeConfirm !== 'LÖSCHEN') return

    setIsPurging(true)
    try {
      const { executeCommand } = await import('@/frontend/lib/api')
      await executeCommand('/emergency-purge-all', [])
    } catch {
      // Handle error
    }
    setIsPurging(false)
  }

  if (variant === 'emergency-purge') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{getTitle()}</h2>
          <p className="text-muted-foreground">{getDescription()}</p>
        </div>

        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6">
          <div className="flex items-start gap-4">
            <AlertTriangle className="h-6 w-6 shrink-0 text-destructive" />
            <div className="space-y-2">
              <h3 className="font-semibold text-destructive">Warnung</h3>
              <p className="text-sm text-muted-foreground">
                Diese Aktion löscht alle sensiblen Daten unwiderruflich. Stelle
                sicher, dass du ein Backup hast, bevor du fortfährst.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-4">
            <CommandForm
              title="Handshake-Daten löschen"
              description="Alle Handshake-Daten bereinigen"
              command="/purge-handshake"
              fields={[]}
            />
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <CommandForm
              title="Nachricht löschen"
              description="Eine spezifische Nachricht löschen"
              command="/purge-msg"
              fields={purgeMsgFields}
            />
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <CommandForm
              title="Schlüssel löschen (Notfall)"
              description="Einen Schlüssel sofort widerrufen"
              command="/emergency-purge-key"
              fields={[
                {
                  name: 'keyId',
                  label: 'Key-ID',
                  placeholder: '0x...',
                  required: true,
                },
              ]}
            />
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <CommandForm
              title="Ticket löschen (Notfall)"
              description="Ein Ticket sofort widerrufen"
              command="/emergency-purge-ticket"
              fields={[
                {
                  name: 'ticketId',
                  label: 'Ticket-ID',
                  placeholder: '0x...',
                  required: true,
                },
              ]}
            />
          </div>
        </div>

        <div className="rounded-lg border border-destructive bg-card p-6">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-destructive">
            <Trash2 className="h-5 w-5" />
            Alles löschen
          </h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Tippe &quot;LÖSCHEN&quot; ein, um alle Daten zu bereinigen
          </p>
          <div className="flex items-center gap-4">
            <Input
              value={purgeConfirm}
              onChange={(e) => setPurgeConfirm(e.target.value)}
              placeholder="LÖSCHEN"
              className="max-w-xs"
            />
            <Button
              variant="destructive"
              onClick={handleEmergencyPurge}
              disabled={purgeConfirm !== 'LÖSCHEN' || isPurging}
            >
              {isPurging ? 'Wird gelöscht...' : 'Alles löschen'}
            </Button>
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

      <Tabs defaultValue="local" className="space-y-4">
        <TabsList>
          <TabsTrigger value="local" className="gap-2">
            <Database className="h-4 w-4" />
            Lokal
          </TabsTrigger>
          <TabsTrigger value="onchain" className="gap-2">
            <Cloud className="h-4 w-4" />
            On-Chain
          </TabsTrigger>
        </TabsList>

        {/* Local Tab */}
        <TabsContent value="local" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-card-foreground">
                  Vault sichern
                </h3>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Speichere alle sensiblen Daten verschlüsselt auf der Festplatte
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Passwort (optional)</Label>
                  <Input type="password" placeholder="Verschlüsselungspasswort" />
                </div>
                <Button className="w-full">
                  <Lock className="mr-2 h-4 w-4" />
                  Vault sichern
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <Unlock className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-card-foreground">
                  Vault laden
                </h3>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Lade gesicherte Daten aus dem lokalen Vault
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Passwort</Label>
                  <Input type="password" placeholder="Entschlüsselungspasswort" />
                </div>
                <Button variant="outline" className="w-full">
                  <Unlock className="mr-2 h-4 w-4" />
                  Vault laden
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="mb-4 font-semibold text-card-foreground">
              Vault-Status
            </h3>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-lg border border-border p-4">
                <span className="text-sm text-muted-foreground">Letzte Sicherung</span>
                <p className="font-medium text-card-foreground">-</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <span className="text-sm text-muted-foreground">Gespeicherte Objekte</span>
                <p className="font-medium text-card-foreground">0</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <span className="text-sm text-muted-foreground">Verschlüsselung</span>
                <p className="font-medium text-card-foreground">AES-256</p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* On-Chain Tab */}
        <TabsContent value="onchain" className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <Cloud className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-card-foreground">
                On-Chain Vault
              </h3>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Speichere verschlüsselte Daten direkt auf der IOTA-Blockchain.
              Diese Daten sind dezentral gespeichert und können nur mit dem
              richtigen Schlüssel entschlüsselt werden.
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Daten (werden verschlüsselt)</Label>
                <Input placeholder="Geheime Daten..." />
              </div>
              <Button>
                <Shield className="mr-2 h-4 w-4" />
                On-Chain sichern
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="mb-4 font-semibold text-card-foreground">
              On-Chain Vault abrufen
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Vault-ID</Label>
                <Input placeholder="0x..." />
              </div>
              <Button variant="outline">Abrufen</Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
