'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Inbox as InboxIcon, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { executeCommand, getPackageIdHistory, getCurrentIds } from '@/frontend/lib/api'
import type { Message } from '@/lib/types'

interface InboxProps {
  currentPackageId?: string
}

export function Inbox({ currentPackageId }: InboxProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [packageHistory, setPackageHistory] = useState<{ current?: string; history?: string[] }>({})
  const [selectedPackageId, setSelectedPackageId] = useState<string>('')
  const [senderFilter, setSenderFilter] = useState('')

  useEffect(() => {
    getPackageIdHistory().then((res) => {
      if (res.ok) setPackageHistory({ current: res.current, history: res.history || [] })
    })
  }, [currentPackageId])

  useEffect(() => {
    setSelectedPackageId(currentPackageId || packageHistory.current || '')
  }, [currentPackageId, packageHistory.current])

  const fetchMessages = async (count: number) => {
    setLoading(true)
    setError(null)

    try {
      const effectivePackageId = selectedPackageId && selectedPackageId.trim() ? selectedPackageId.trim() : null
      const current = currentPackageId || packageHistory.current || ''

      if (effectivePackageId && current && effectivePackageId.toLowerCase() !== current.toLowerCase()) {
        const setRes = await executeCommand('/set-package-id', [effectivePackageId])
        if (!setRes.ok) {
          setError(setRes.error || 'Package-ID konnte nicht gesetzt werden')
          setLoading(false)
          return
        }
      }

      const args = [String(count)]
      if (senderFilter.trim().startsWith('0x')) args.push(senderFilter.trim())

      const response = await executeCommand('/fetch', args)

      if (response.ok && response.messages) {
        setMessages(response.messages)
      } else {
        setError(response.error || 'Fehler beim Abrufen')
      }
    } catch {
      setError('Verbindungsfehler')
    }

    setLoading(false)
  }

  const maskAddress = (addr: string) => {
    if (addr.length <= 14) return addr
    return `${addr.slice(0, 8)}...${addr.slice(-4)}`
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-2">
          <InboxIcon className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-card-foreground">
            Posteingang (IOTA Events)
          </h3>
          {messages.length > 0 && (
            <Badge variant="secondary">{messages.length}</Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={selectedPackageId || 'current'}
            onValueChange={(v) => setSelectedPackageId(v === 'current' ? '' : v)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Package-ID" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Aktuell</SelectItem>
              {[
                ...(packageHistory.current && !(packageHistory.history || []).includes(packageHistory.current)
                  ? [packageHistory.current]
                  : []),
                ...(packageHistory.history || []),
              ]
                .filter((id, i, a) => a.indexOf(id) === i)
                .map((id) => (
                  <SelectItem key={id} value={id}>
                    {id.length > 16 ? `${id.slice(0, 10)}…${id.slice(-6)}` : id}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => fetchMessages(20)} disabled={loading}>
            Letzte 20
          </Button>
          <Button variant="outline" size="sm" onClick={() => fetchMessages(50)} disabled={loading}>
            50
          </Button>
          <Button variant="outline" size="sm" onClick={() => fetchMessages(100)} disabled={loading}>
            100
          </Button>
          <Button variant="ghost" size="icon" onClick={() => fetchMessages(20)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="sr-only">Aktualisieren</span>
          </Button>
        </div>
      </div>
      <div className="border-b border-border px-4 pb-3 pt-0">
        <Label className="text-xs text-muted-foreground">Nur von Sender (optional)</Label>
        <Input
          placeholder="0x… oder leer"
          value={senderFilter}
          onChange={(e) => setSenderFilter(e.target.value)}
          className="mt-1 max-w-xs font-mono text-sm"
        />
      </div>

      <div className="max-h-96 overflow-y-auto p-4">
        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!error && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <InboxIcon className="mb-2 h-8 w-8" />
            <p>Keine Nachrichten</p>
            <p className="text-sm">
              Klicke auf &quot;Letzte 20 holen&quot; um Nachrichten abzurufen
            </p>
          </div>
        )}

        {messages.length > 0 && (
          <ul className="space-y-2">
            {messages.map((msg, index) => (
              <li
                key={`${msg.sender}-${msg.nonce || index}`}
                className="rounded-lg border border-border bg-background p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">
                    {maskAddress(msg.sender)}
                  </span>
                  {msg.isPlain && (
                    <Badge variant="outline" className="gap-1">
                      <Eye className="h-3 w-3" />
                      Klartext
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-card-foreground">{msg.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
