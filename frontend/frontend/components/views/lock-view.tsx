'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Key,
  Ticket,
  Plus,
  Send,
  Trash2,
  RefreshCw,
  Check,
  AlertCircle,
  Zap,
  Lock,
  Copy,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import QRCode from 'qrcode'
import {
  createKey,
  createKeys,
  transferKey,
  purgeKey,
  listKeys,
  createTicket,
  createTickets,
  useTicket,
  transferTicket,
  purgeTicket,
  listTickets,
  fetchStatus,
  type ApiStatus,
} from '@/frontend/lib/api'
import type { KeyData, TicketData } from '../../lib/types'

interface LockViewProps {
  variant: 'smart-lock' | 'access-key-ticket' | 'payment-trigger'
}

type Tab = 'keys' | 'tickets'
type Action = 'create' | 'transfer' | 'delete' | null

export function LockView({ variant }: LockViewProps) {
  const [tab, setTab] = useState<Tab>('keys')
  const [action, setAction] = useState<Action>(null)
  const [keys, setKeys] = useState<KeyData[]>([])
  const [tickets, setTickets] = useState<TicketData[]>([])
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [statusMsg, setStatusMsg] = useState('')

  // Form fields
  const [lockAddress, setLockAddress] = useState('')
  const [recipient, setRecipient] = useState('')
  const [count, setCount] = useState('1')
  const [ttl, setTtl] = useState('')
  const [keyId, setKeyId] = useState('')
  const [ticketId, setTicketId] = useState('')
  const [eventId, setEventId] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [ticketMetadata, setTicketMetadata] = useState('')
  const [createdTicketInfo, setCreatedTicketInfo] = useState<{ objectId: string; eventId: string; recipient: string } | null>(null)
  const [createdTicketIds, setCreatedTicketIds] = useState<string[]>([])
  const [ticketEmailTo, setTicketEmailTo] = useState('krupps.ursl@gmail.com')
  const [ticketCount, setTicketCount] = useState('10')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copyDone, setCopyDone] = useState(false)

  const [loadError, setLoadError] = useState<string | null>(null)
  const [chainStrip, setChainStrip] = useState<ApiStatus | null>(null)
  const addressSuggestions = useMemo(() => {
    const set = new Set<string>()
    const addIfAddress = (raw: unknown) => {
      const t = String(raw || '').trim()
      if (/^0x[a-fA-F0-9]{64}$/.test(t)) set.add(t)
    }
    addIfAddress(chainStrip?.myAddress)
    const connectedUnknown = (chainStrip as { connectedAddresses?: unknown } | null)?.connectedAddresses
    if (Array.isArray(connectedUnknown)) {
      for (const item of connectedUnknown) addIfAddress(item)
    }
    return Array.from(set)
  }, [chainStrip])

  const explorerBase = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_EXPLORER_BASE
    ? process.env.NEXT_PUBLIC_EXPLORER_BASE.replace(/\/$/, '')
    : 'https://explorer.iota.org/object'

  const ticketPayloadText = useMemo(() => {
    if (createdTicketIds.length > 1) {
      const links = createdTicketIds.map((id) => `${explorerBase}/${id}`)
      return JSON.stringify({ type: 'tickets', count: createdTicketIds.length, objectIds: createdTicketIds, explorerLinks: links }, null, 2)
    }
    if (createdTicketInfo) {
      const link = `${explorerBase}/${createdTicketInfo.objectId}`
      return JSON.stringify({
        objectId: createdTicketInfo.objectId,
        eventId: createdTicketInfo.eventId,
        recipient: createdTicketInfo.recipient,
        explorerLink: link,
      }, null, 2)
    }
    return ''
  }, [createdTicketInfo, createdTicketIds, explorerBase])

  useEffect(() => {
    if (!ticketPayloadText) {
      setQrDataUrl(null)
      return
    }
    QRCode.toDataURL(ticketPayloadText, { width: 200, margin: 2 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null))
  }, [ticketPayloadText])

  const loadKeys = async () => {
    setLoading(true)
    setLoadError(null)
    const res = await listKeys()
    if (res.ok && res.data) setKeys(res.data)
    else if (!res.ok) setLoadError((res as { error?: string }).error || 'Laden fehlgeschlagen')
    setLoading(false)
  }

  const loadTickets = async () => {
    setLoading(true)
    setLoadError(null)
    const res = await listTickets()
    if (res.ok && res.data) setTickets(res.data)
    else if (!res.ok) setLoadError((res as { error?: string }).error || 'Laden fehlgeschlagen')
    setLoading(false)
  }

  useEffect(() => {
    loadKeys()
    loadTickets()
  }, [])

  useEffect(() => {
    let alive = true
    const tick = () => {
      fetchStatus().then((s) => {
        if (alive && 'pollClockHint' in s) {
          const { pollClockHint: _h, ...rest } = s
          setChainStrip(rest)
        }
      })
    }
    tick()
    const id = setInterval(tick, 15000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  const showStatus = (success: boolean, msg: string) => {
    setStatus(success ? 'success' : 'error')
    setStatusMsg(msg)
    setTimeout(() => setStatus('idle'), 3000)
  }

  const handleCreateKey = async () => {
    if (!lockAddress || !recipient) return
    setProcessing(true)
    const res = await (parseInt(count) > 1
      ? createKeys(lockAddress, recipient, parseInt(count), ttl ? parseInt(ttl) : undefined)
      : createKey(lockAddress, recipient, ttl ? parseInt(ttl) : undefined))
    showStatus(res.ok, res.ok ? 'Schlüssel erstellt!' : res.error || 'Fehler')
    if (res.ok) {
      loadKeys()
      setAction(null)
      setLockAddress('')
      setRecipient('')
      setCount('1')
      setTtl('')
    }
    setProcessing(false)
  }

  const handleTransferKey = async () => {
    if (!keyId || !recipient) return
    setProcessing(true)
    const res = await transferKey(keyId, recipient)
    showStatus(res.ok, res.ok ? 'Schlüssel übertragen!' : res.error || 'Fehler')
    if (res.ok) {
      loadKeys()
      setAction(null)
      setKeyId('')
      setRecipient('')
    }
    setProcessing(false)
  }

  const handleDeleteKey = async () => {
    if (!keyId) return
    setProcessing(true)
    const res = await purgeKey(keyId)
    showStatus(res.ok, res.ok ? 'Schlüssel gelöscht!' : res.error || 'Fehler')
    if (res.ok) {
      loadKeys()
      setAction(null)
      setKeyId('')
    }
    setProcessing(false)
  }

  const handleCreateTicket = async () => {
    if (!eventId || !validFrom || !validUntil || !recipient) return
    setProcessing(true)
    setCreatedTicketInfo(null)
    setCreatedTicketIds([])
    const res = await createTicket(
      eventId,
      parseInt(validFrom),
      parseInt(validUntil),
      recipient,
      ticketMetadata.trim() ? ticketMetadata.trim() : undefined
    )
    const out = res as { ok: boolean; error?: string; objectId?: string }
    showStatus(out.ok, out.ok ? 'Ticket erstellt!' : out.error || 'Fehler')
    if (out.ok && out.objectId) {
      setCreatedTicketInfo({ objectId: out.objectId, eventId, recipient })
      loadTickets()
    }
    if (out.ok) {
      setEventId('')
      setValidFrom('')
      setValidUntil('')
      setRecipient('')
      setTicketMetadata('')
    }
    setProcessing(false)
  }

  const handleCreateTicketsBatch = async () => {
    if (!eventId || !validFrom || !validUntil || !recipient) return
    const count = Math.min(50, Math.max(1, parseInt(ticketCount, 10) || 1))
    setProcessing(true)
    setCreatedTicketInfo(null)
    setCreatedTicketIds([])
    const res = await createTickets(
      eventId,
      parseInt(validFrom),
      parseInt(validUntil),
      recipient,
      count,
      ticketMetadata.trim() ? ticketMetadata.trim() : undefined
    )
    const out = res as { ok: boolean; error?: string; createdObjectIds?: string[] }
    showStatus(out.ok, out.ok ? `${count} Tickets erstellt!` : out.error || 'Fehler')
    if (out.ok && Array.isArray(out.createdObjectIds) && out.createdObjectIds.length > 0) {
      setCreatedTicketIds(out.createdObjectIds)
      setCreatedTicketInfo({ objectId: out.createdObjectIds[0], eventId, recipient })
      loadTickets()
    }
    if (out.ok) {
      setEventId('')
      setValidFrom('')
      setValidUntil('')
      setRecipient('')
      setTicketMetadata('')
    }
    setProcessing(false)
  }

  const handleSendTicketByEmail = () => {
    const ids = createdTicketIds.length > 0 ? createdTicketIds : (createdTicketInfo ? [createdTicketInfo.objectId] : [])
    if (ids.length === 0) return
    const lines = ids.map((id) => `${explorerBase}/${id}`)
    const subject = encodeURIComponent(ids.length > 1 ? `Festival-Tickets (${ids.length})` : 'Festival-Ticket / Ticket-Link')
    const body = encodeURIComponent(
      ids.length > 1
        ? `Ticket-Objekte (Explorer):\n${lines.join('\n')}\n\nAnzahl: ${ids.length}`
        : `Ticket-Objekt (Explorer):\n${lines[0]}\n\nTicket-ID: ${ids[0]}${createdTicketInfo ? `\nEvent-ID: ${createdTicketInfo.eventId}\nEmpfänger: ${createdTicketInfo.recipient}` : ''}`
    )
    window.location.href = `mailto:${ticketEmailTo}?subject=${subject}&body=${body}`
  }

  const handleUseTicket = async () => {
    if (!ticketId || !eventId) return
    setProcessing(true)
    const res = await useTicket(ticketId, eventId)
    showStatus(res.ok, res.ok ? 'Ticket eingelöst!' : res.error || 'Fehler')
    if (res.ok) loadTickets()
    setProcessing(false)
  }

  const handleTransferTicket = async () => {
    if (!ticketId || !recipient) return
    setProcessing(true)
    const res = await transferTicket(ticketId, recipient)
    showStatus(res.ok, res.ok ? 'Ticket übertragen!' : res.error || 'Fehler')
    if (res.ok) {
      loadTickets()
      setAction(null)
      setTicketId('')
      setRecipient('')
    }
    setProcessing(false)
  }

  const handleDeleteTicket = async () => {
    if (!ticketId) return
    setProcessing(true)
    const res = await purgeTicket(ticketId)
    showStatus(res.ok, res.ok ? 'Ticket gelöscht!' : res.error || 'Fehler')
    if (res.ok) {
      loadTickets()
      setAction(null)
      setTicketId('')
    }
    setProcessing(false)
  }

  const maskId = (id: string) =>
    id.length <= 14 ? id : `${id.slice(0, 8)}...${id.slice(-4)}`

  const getTitle = () => {
    switch (variant) {
      case 'smart-lock': return 'Smart-Lock'
      case 'access-key-ticket': return 'Schlüssel & Tickets'
      case 'payment-trigger': return 'Zahlungs-Trigger'
    }
  }

  const getIcon = () => {
    switch (variant) {
      case 'smart-lock': return <Lock className="h-6 w-6" />
      case 'access-key-ticket': return <Key className="h-6 w-6" />
      case 'payment-trigger': return <Zap className="h-6 w-6" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
          {getIcon()}
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{getTitle()}</h2>
          <p className="text-sm text-muted-foreground">
            {variant === 'smart-lock' && 'Verwalte Zugänge zu deinem Schloss'}
            {variant === 'access-key-ticket' && 'NFT-basierte Berechtigungen'}
            {variant === 'payment-trigger' && 'Zahlung löst Zugang aus'}
          </p>
        </div>
      </div>

      {chainStrip && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="font-medium text-foreground">Backend</span>
            {chainStrip.backendRunning === false ? (
              <span className="text-red-400">offline</span>
            ) : (
              <span className="text-emerald-500">OK</span>
            )}
          </span>
          {chainStrip.locked && <span className="text-amber-500">Wallet gesperrt</span>}
          <span>
            Chat / Peering:{' '}
            <span className={chainStrip.connected ? 'text-emerald-500' : 'text-muted-foreground'}>
              {chainStrip.connected ? 'verbunden' : 'nicht verbunden'}
            </span>
          </span>
          <span>
            Messaging-Keys:{' '}
            <span className={chainStrip.hasKeys ? 'text-emerald-500' : 'text-muted-foreground'}>
              {chainStrip.hasKeys ? 'im Speicher' : 'nicht geladen'}
            </span>
          </span>
          {chainStrip.role && (
            <span>
              Rolle: <span className="font-mono text-foreground">{chainStrip.role}</span>
            </span>
          )}
          {chainStrip.myAddress && (
            <span className="font-mono" title={chainStrip.myAddress}>
              {maskId(chainStrip.myAddress)}
            </span>
          )}
        </div>
      )}

      {/* Status Message */}
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

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => { setTab('keys'); setAction(null) }}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            tab === 'keys'
              ? 'bg-primary text-primary-foreground'
              : 'bg-accent text-accent-foreground hover:bg-accent/80'
          )}
        >
          <Key className="h-4 w-4" />
          Schlüssel
        </button>
        <button
          onClick={() => { setTab('tickets'); setAction(null) }}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            tab === 'tickets'
              ? 'bg-primary text-primary-foreground'
              : 'bg-accent text-accent-foreground hover:bg-accent/80'
          )}
        >
          <Ticket className="h-4 w-4" />
          Tickets
        </button>
      </div>

      {/* Keys Tab */}
      {tab === 'keys' && (
        <div className="space-y-4">
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAction(action === 'create' ? null : 'create')}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                action === 'create'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
              )}
            >
              <Plus className="h-4 w-4" />
              Neu erstellen
            </button>
            <button
              onClick={() => setAction(action === 'transfer' ? null : 'transfer')}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                action === 'transfer'
                  ? 'bg-blue-500 text-white'
                  : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
              )}
            >
              <Send className="h-4 w-4" />
              Übertragen
            </button>
            <button
              onClick={() => setAction(action === 'delete' ? null : 'delete')}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                action === 'delete'
                  ? 'bg-red-500 text-white'
                  : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
              )}
            >
              <Trash2 className="h-4 w-4" />
              Löschen
            </button>
          </div>

          {/* Action Forms */}
          {action === 'create' && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <h4 className="font-semibold text-foreground">Neuen Schlüssel erstellen</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Schloss-Adresse</label>
                  <input
                    type="text"
                    list="lock-address-suggestions"
                    value={lockAddress}
                    onChange={(e) => setLockAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Empfänger</label>
                  <input
                    type="text"
                    list="lock-address-suggestions"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="0x..."
                    className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Anzahl</label>
                  <input
                    type="number"
                    value={count}
                    onChange={(e) => setCount(e.target.value)}
                    min="1"
                    className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Gültigkeit (Tage, optional)</label>
                  <input
                    type="number"
                    value={ttl}
                    onChange={(e) => setTtl(e.target.value)}
                    placeholder="30"
                    className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
              <button
                onClick={handleCreateKey}
                disabled={processing || !lockAddress || !recipient}
                className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {processing ? 'Erstelle...' : `${parseInt(count) > 1 ? count + ' Schlüssel' : 'Schlüssel'} erstellen`}
              </button>
            </div>
          )}

          {action === 'transfer' && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <h4 className="font-semibold text-foreground">Schlüssel übertragen</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Key-ID</label>
                  <input
                    type="text"
                    value={keyId}
                    onChange={(e) => setKeyId(e.target.value)}
                    placeholder="0x..."
                    className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Neuer Besitzer</label>
                  <input
                    type="text"
                    list="lock-address-suggestions"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="0x..."
                    className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
              <button
                onClick={handleTransferKey}
                disabled={processing || !keyId || !recipient}
                className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {processing ? 'Übertrage...' : 'Übertragen'}
              </button>
            </div>
          )}

          {action === 'delete' && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-4">
              <h4 className="font-semibold text-foreground">Schlüssel löschen</h4>
              <p className="text-sm text-muted-foreground">Der Schlüssel wird unwiderruflich gelöscht.</p>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Key-ID</label>
                <input
                  type="text"
                  value={keyId}
                  onChange={(e) => setKeyId(e.target.value)}
                  placeholder="0x..."
                  className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>
              <button
                onClick={handleDeleteKey}
                disabled={processing || !keyId}
                className="rounded-lg bg-red-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {processing ? 'Lösche...' : 'Endgültig löschen'}
              </button>
            </div>
          )}

          {/* Keys List */}
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h4 className="font-semibold text-foreground">Meine Schlüssel</h4>
              <button
                onClick={loadKeys}
                disabled={loading}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                Aktualisieren
              </button>
            </div>
            {loadError && (
              <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
                {loadError}
              </div>
            )}
            <div className="max-h-64 overflow-y-auto">
              {keys.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Key className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  Noch keine Schlüssel vorhanden
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {keys.map((key) => (
                    <li key={key.id} className="flex items-center justify-between p-3 hover:bg-accent/50">
                      <span className="font-mono text-sm text-foreground">{maskId(key.id)}</span>
                      {key.validUntil && (
                        <span className="text-xs text-muted-foreground">
                          bis {new Date(key.validUntil).toLocaleDateString('de-DE')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tickets Tab - Similar structure */}
      {tab === 'tickets' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAction(action === 'create' ? null : 'create')}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                action === 'create'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
              )}
            >
              <Plus className="h-4 w-4" />
              Neu erstellen
            </button>
            <button
              onClick={() => setAction(action === 'transfer' ? null : 'transfer')}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                action === 'transfer'
                  ? 'bg-blue-500 text-white'
                  : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
              )}
            >
              <Send className="h-4 w-4" />
              Übertragen
            </button>
            <button
              onClick={() => setAction(action === 'delete' ? null : 'delete')}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                action === 'delete'
                  ? 'bg-red-500 text-white'
                  : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
              )}
            >
              <Trash2 className="h-4 w-4" />
              Löschen
            </button>
          </div>

          {action === 'create' && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <h4 className="font-semibold text-foreground">Neues Ticket erstellen</h4>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEventId('0x' + '0'.repeat(64))
                    setValidFrom(String(Date.now()))
                    setValidUntil(String(Date.now() + 7 * 24 * 60 * 60 * 1000))
                    setTicketMetadata('0x466573746976616c')
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  Preset: Festival (Event-ID Platzhalter, Metadata „Festival“ als Hex)
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Event-ID (0x + 64 Hex)</label>
                  <input
                    type="text"
                    value={eventId}
                    onChange={(e) => setEventId(e.target.value)}
                    placeholder="0x..."
                    className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Empfänger (0x…)</label>
                  <input
                    type="text"
                    list="lock-address-suggestions"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="0x..."
                    className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Gültig ab (Unix ms)</label>
                  <input
                    type="number"
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                    placeholder={Date.now().toString()}
                    className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Gültig bis (Unix ms)</label>
                  <input
                    type="number"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    placeholder={(Date.now() + 86400000).toString()}
                    className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Metadata (Hex, optional)</label>
                  <input
                    type="text"
                    value={ticketMetadata}
                    onChange={(e) => setTicketMetadata(e.target.value)}
                    placeholder="0x oder leer"
                    className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleCreateTicket}
                  disabled={processing || !eventId || !validFrom || !validUntil || !recipient}
                  className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {processing ? 'Erstelle...' : '1 Ticket erstellen'}
                </button>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground">Anzahl (1–50):</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={ticketCount}
                    onChange={(e) => setTicketCount(e.target.value)}
                    className="w-20 rounded border border-border bg-input px-2 py-1.5 text-sm text-foreground"
                  />
                  <button
                    onClick={handleCreateTicketsBatch}
                    disabled={processing || !eventId || !validFrom || !validUntil || !recipient}
                    className="rounded-lg bg-emerald-500/20 text-emerald-400 px-4 py-2.5 text-sm font-medium hover:bg-emerald-500/30 disabled:opacity-50"
                  >
                    Mehrere Tickets (gleicher Empfänger)
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Für verschiedene Adressen: mehrfach „1 Ticket erstellen“ mit wechselndem Empfänger oder mehrere Batches nacheinander.
              </p>
            </div>
          )}

          {/* Hinweis: Was nach Erstellung erscheint */}
          {!(createdTicketInfo || createdTicketIds.length > 0) && (
            <p className="text-sm text-muted-foreground rounded-lg border border-border bg-muted/30 px-4 py-2">
              Nach dem Erstellen eines Tickets („1 Ticket erstellen“ oder „Mehrere Tickets“) erscheinen hier ein <strong>QR-Code</strong> (mit Objekt-ID, Event, Empfänger, Explorer-Link), die <strong>Daten zum Kopieren</strong> und optional der E-Mail-Button.
            </p>
          )}
          {/* Immer sichtbar nach Erstellung: QR-Code + Daten zum Kopieren */}
          {(createdTicketInfo || createdTicketIds.length > 0) && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-4">
              <h4 className="font-semibold text-foreground">
                {createdTicketIds.length > 1 ? `Zuletzt erstellt: ${createdTicketIds.length} Tickets` : 'Zuletzt erstelltes Ticket'}
              </h4>
              <div className="flex flex-wrap items-start gap-6">
                {qrDataUrl && (
                  <div className="flex flex-col items-center gap-2">
                    <img src={qrDataUrl} alt="QR-Code Ticket-Daten" className="rounded-lg border border-border bg-white p-2" width={200} height={200} />
                    <span className="text-xs text-muted-foreground">QR enthält Objekt-ID, Event, Empfänger, Explorer-Link</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground mb-1">Daten zum Kopieren:</p>
                  <textarea
                    readOnly
                    value={ticketPayloadText}
                    className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-xs text-foreground resize-none h-32"
                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(ticketPayloadText)
                      setCopyDone(true)
                      setTimeout(() => setCopyDone(false), 2000)
                    }}
                    className="mt-2 flex items-center gap-2 rounded-lg bg-primary/10 text-primary px-4 py-2 text-sm font-medium hover:bg-primary/20"
                  >
                    <Copy className="h-4 w-4" />
                    {copyDone ? 'Kopiert!' : 'In Zwischenablage kopieren'}
                  </button>
                </div>
              </div>
              {createdTicketInfo && (
                <a
                  href={`${explorerBase}/${createdTicketInfo.objectId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm text-primary hover:underline"
                >
                  Im Explorer öffnen
                </a>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                <label className="text-sm text-muted-foreground">Optional: Link(s) per E-Mail an</label>
                <input
                  type="email"
                  value={ticketEmailTo}
                  onChange={(e) => setTicketEmailTo(e.target.value)}
                  placeholder="E-Mail"
                  className="rounded border border-border bg-input px-3 py-1.5 text-sm text-foreground w-48"
                />
                <button
                  type="button"
                  onClick={handleSendTicketByEmail}
                  className="rounded-lg bg-amber-500/20 text-amber-400 px-3 py-1.5 text-sm hover:bg-amber-500/30"
                >
                  E-Mail öffnen (mailto)
                </button>
              </div>
              <button
                type="button"
                onClick={() => { setCreatedTicketInfo(null); setCreatedTicketIds([]); setQrDataUrl(null) }}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Ausblenden
              </button>
            </div>
          )}

          {action === 'transfer' && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <h4 className="font-semibold text-foreground">Ticket übertragen</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Ticket-ID</label>
                  <input
                    type="text"
                    value={ticketId}
                    onChange={(e) => setTicketId(e.target.value)}
                    placeholder="0x..."
                    className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Neuer Besitzer</label>
                  <input
                    type="text"
                    list="lock-address-suggestions"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="0x..."
                    className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
              <button
                onClick={handleTransferTicket}
                disabled={processing || !ticketId || !recipient}
                className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {processing ? 'Übertrage...' : 'Übertragen'}
              </button>
            </div>
          )}

          {action === 'delete' && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-4">
              <h4 className="font-semibold text-foreground">Ticket löschen</h4>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Ticket-ID</label>
                <input
                  type="text"
                  value={ticketId}
                  onChange={(e) => setTicketId(e.target.value)}
                  placeholder="0x..."
                  className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>
              <button
                onClick={handleDeleteTicket}
                disabled={processing || !ticketId}
                className="rounded-lg bg-red-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {processing ? 'Lösche...' : 'Endgültig löschen'}
              </button>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h4 className="font-semibold text-foreground">Meine Tickets</h4>
              <button
                onClick={loadTickets}
                disabled={loading}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                Aktualisieren
              </button>
            </div>
            {loadError && (
              <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
                {loadError}
              </div>
            )}
            <div className="max-h-64 overflow-y-auto">
              {tickets.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Ticket className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  Noch keine Tickets vorhanden
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {tickets.map((ticket) => (
                    <li key={ticket.id} className="flex items-center justify-between p-3 hover:bg-accent/50">
                      <div>
                        <span className="font-mono text-sm text-foreground">{maskId(ticket.id)}</span>
                        {ticket.used && (
                          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            Eingelöst
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
      <datalist id="lock-address-suggestions">
        {addressSuggestions.map((addr) => (
          <option key={addr} value={addr} />
        ))}
      </datalist>
    </div>
  )
}
