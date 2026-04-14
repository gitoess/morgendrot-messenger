'use client'

import { useState, useEffect } from 'react'
import {
  Send,
  Handshake,
  Link,
  Coins,
  Package,
  Trash2,
  Shield,
} from 'lucide-react'
import { getStatus, getCurrentIds } from '@/frontend/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CommandForm } from '@/components/command-form'
import { Inbox } from '@/components/inbox'
import type { FormField } from '@/lib/types'

interface ChatProjectProps {
  variant: 'private-chat' | 'pinnwand'
}

const handshakeFields: FormField[] = [
  {
    name: 'partner',
    label: 'Partner-Adresse',
    placeholder: '0x...',
    required: true,
    helpText: 'Die IOTA-Adresse deines Chat-Partners',
  },
]

const connectFields: FormField[] = [
  {
    name: 'address',
    label: 'Adresse',
    placeholder: '0x... oder leer für .env',
    helpText: 'Optional: Spezifische Adresse oder leer für Standard',
  },
]

const transferFields: FormField[] = [
  {
    name: 'recipient',
    label: 'Empfänger',
    placeholder: '0x...',
    required: true,
  },
  {
    name: 'amount',
    label: 'Betrag (IOTA)',
    placeholder: '0.1',
    type: 'number',
    required: true,
  },
]

const packageIdFields: FormField[] = [
  {
    name: 'packageId',
    label: 'Package-ID',
    placeholder: '0x... (64 Hex-Zeichen)',
    required: true,
    helpText: 'Die neue Package-ID zum Wechseln',
  },
]

export function ChatProject({ variant }: ChatProjectProps) {
  const [recipient, setRecipient] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{
    status: 'idle' | 'success' | 'error'
    message?: string
  }>({ status: 'idle' })
  const [currentPackageId, setCurrentPackageId] = useState<string | undefined>()
  const [purgeStatus, setPurgeStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [purgeMessage, setPurgeMessage] = useState('')

  const isPrivate = variant === 'private-chat'

  useEffect(() => {
    Promise.all([getStatus(), getCurrentIds()]).then(([status, ids]) => {
      const pkg = (ids.ok && ids.packageId) || (status.ok && status.data?.packageId)
      if (pkg) setCurrentPackageId(pkg)
    })
  }, [])

  const handleSend = async () => {
    if (!message.trim()) return

    setSending(true)
    setSendResult({ status: 'idle' })

    try {
      const { executeCommand } = await import('@/frontend/lib/api')
      const cmd = isPrivate ? '/send' : '/send-plain'
      const args = isPrivate ? [message] : [recipient, message]

      const response = await executeCommand(cmd, args)

      if (response.ok) {
        setSendResult({
          status: 'success',
          message: 'Nachricht gesendet',
        })
        setMessage('')
      } else {
        setSendResult({
          status: 'error',
          message: response.error || 'Fehler beim Senden',
        })
      }
    } catch {
      setSendResult({
        status: 'error',
        message: 'Verbindungsfehler',
      })
    }

    setSending(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {isPrivate ? 'Privat-Chat' : 'Pinnwand'}
          </h2>
          <p className="text-muted-foreground">
            {isPrivate
              ? 'Ende-zu-Ende verschlüsselte Nachrichten'
              : 'Öffentliche Broadcast-Nachrichten'}
          </p>
        </div>
      </div>

      {/* Main content with tabs */}
      <Tabs defaultValue="messages" className="space-y-4">
        <TabsList>
          <TabsTrigger value="messages" className="gap-2">
            <Send className="h-4 w-4" />
            Nachrichten
          </TabsTrigger>
          <TabsTrigger value="connection" className="gap-2">
            <Handshake className="h-4 w-4" />
            Verbindung
          </TabsTrigger>
          <TabsTrigger value="tools" className="gap-2">
            <Package className="h-4 w-4" />
            Tools
          </TabsTrigger>
          <TabsTrigger value="cleanup" className="gap-2">
            <Trash2 className="h-4 w-4" />
            Aufräumen
          </TabsTrigger>
        </TabsList>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-6">
          {/* Send Message Form */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-card-foreground">
              <Send className="h-5 w-5 text-primary" />
              Nachricht senden
            </h3>
            <div className="space-y-4">
              {!isPrivate && (
                <div className="space-y-1.5">
                  <Label htmlFor="recipient">Empfänger</Label>
                  <Input
                    id="recipient"
                    placeholder="0x..."
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="message">Nachricht</Label>
                <Textarea
                  id="message"
                  placeholder={
                    isPrivate
                      ? 'Deine verschlüsselte Nachricht...'
                      : 'Deine öffentliche Nachricht...'
                  }
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={handleSend} disabled={sending || !message.trim()}>
                  {sending ? 'Wird gesendet...' : 'Senden'}
                </Button>
                {sendResult.status === 'success' && (
                  <span className="text-sm text-primary">{sendResult.message}</span>
                )}
                {sendResult.status === 'error' && (
                  <span className="text-sm text-destructive">
                    {sendResult.message}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Inbox */}
          <Inbox currentPackageId={currentPackageId} />
        </TabsContent>

        {/* Connection Tab */}
        <TabsContent value="connection" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-4">
              <CommandForm
                title="Handshake starten"
                description="Schlüsselaustausch mit einem Partner initiieren"
                command="/handshake"
                fields={handshakeFields}
              />
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <CommandForm
                title="Verbinden"
                description="Mit einer Adresse verbinden"
                command="/connect"
                fields={connectFields}
              />
            </div>
          </div>
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-4">
              <CommandForm
                title="IOTA überweisen"
                description="Coins an eine Adresse senden"
                command="/transfer-coins"
                fields={transferFields}
              />
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <CommandForm
                title="Package-ID setzen"
                description="Wechsle zu einer anderen Package-ID"
                command="/set-package-id"
                fields={packageIdFields}
              />
            </div>
          </div>
        </TabsContent>

        {/* Cleanup Tab */}
        <TabsContent value="cleanup" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-4">
              <CommandForm
                title="Vault sichern"
                description="Lokale Daten verschlüsselt speichern"
                command="/vault-save"
                fields={[
                  {
                    name: 'password',
                    label: 'Passwort (optional)',
                    placeholder: 'Verschlüsselungspasswort',
                    type: 'text',
                  },
                ]}
              />
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="flex items-center gap-2 text-base font-semibold text-card-foreground">
                    <Trash2 className="h-5 w-5 text-destructive" />
                    Handshake löschen
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Alle Handshake-Daten bereinigen (Rebate)
                  </p>
                </div>
                <Button
                  variant="destructive"
                  disabled={purgeStatus === 'loading'}
                  onClick={async () => {
                    setPurgeStatus('loading')
                    setPurgeMessage('')
                    try {
                      const { executeCommand } = await import('@/frontend/lib/api')
                      const res = await executeCommand('/purge-handshake', [])
                      if (res.ok) {
                        setPurgeStatus('success')
                        setPurgeMessage(res.message || 'Handshake gelöscht.')
                      } else {
                        setPurgeStatus('error')
                        setPurgeMessage(res.error || 'Fehler beim Löschen')
                      }
                    } catch {
                      setPurgeStatus('error')
                      setPurgeMessage('Verbindungsfehler')
                    }
                  }}
                >
                  {purgeStatus === 'loading' ? 'Läuft…' : 'Handshake löschen'}
                </Button>
                {purgeStatus === 'success' && (
                  <p className="text-sm text-primary">{purgeMessage}</p>
                )}
                {purgeStatus === 'error' && (
                  <p className="text-sm text-destructive">{purgeMessage}</p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
