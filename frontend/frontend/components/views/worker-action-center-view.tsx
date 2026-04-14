'use client'

import { useState, useEffect } from 'react'
import {
  Activity,
  Key,
  Ticket,
  Trash2,
  RefreshCw,
  Check,
  AlertCircle,
  Radio,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  sendHeartbeat,
  setHeartbeatInterval,
  listKeys,
  listTickets,
  purgeKey,
  purgeTicket,
  useTicket,
} from '@/frontend/lib/api'
import type { KeyData, TicketData } from '../../lib/types'

/**
 * Action Center für Arbeiter/Lock: Heartbeat, Ticket-Validierung, Purge in einer Ansicht.
 * Kein Kachel-Wechsel – alles in einem Workflow (Bank-Tor, Einlass).
 */
export function WorkerActionCenterView() {
  const [heartbeatStatus, setHeartbeatStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [heartbeatMsg, setHeartbeatMsg] = useState('')
  const [keys, setKeys] = useState<KeyData[]>([])
  const [tickets, setTickets] = useState<TicketData[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [actionStatus, setActionStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [actionMsg, setActionMsg] = useState('')
  const [intervalMs, setIntervalMs] = useState('30000')
  const [ticketIdToUse, setTicketIdToUse] = useState('')
  const [eventIdToUse, setEventIdToUse] = useState('')

  const loadData = async () => {
    setLoading(true)
    const [kRes, tRes] = await Promise.all([listKeys(), listTickets()])
    if (kRes.ok && kRes.data) setKeys(kRes.data)
    if (tRes.ok && tRes.data) setTickets(tRes.data)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    const t = setInterval(loadData, 15000)
    return () => clearInterval(t)
  }, [])

  const showAction = (success: boolean, msg: string) => {
    setActionStatus(success ? 'success' : 'error')
    setActionMsg(msg)
    setTimeout(() => setActionStatus('idle'), 3000)
  }

  const handleHeartbeat = async () => {
    setHeartbeatStatus('idle')
    const res = await sendHeartbeat()
    setHeartbeatStatus(res.ok ? 'success' : 'error')
    setHeartbeatMsg(res.ok ? 'Heartbeat gesendet' : res.error || 'Fehler')
    setTimeout(() => setHeartbeatStatus('idle'), 2000)
  }

  const handleSetInterval = async () => {
    const ms = parseInt(intervalMs, 10)
    if (isNaN(ms) || ms < 1000) return
    const res = await setHeartbeatInterval(ms)
    showAction(res.ok, res.ok ? `Interval ${ms} ms` : res.error || 'Fehler')
  }

  const handleUseTicket = async () => {
    if (!ticketIdToUse.trim() || !eventIdToUse.trim()) return
    setProcessing(true)
    const res = await useTicket(ticketIdToUse.trim(), eventIdToUse.trim())
    showAction(res.ok, res.ok ? 'Ticket eingelöst' : res.error || 'Fehler')
    if (res.ok) {
      setTicketIdToUse('')
      setEventIdToUse('')
      loadData()
    }
    setProcessing(false)
  }

  const handlePurgeKey = async (keyId: string) => {
    setProcessing(true)
    const res = await purgeKey(keyId)
    showAction(res.ok, res.ok ? 'Key gelöscht' : res.error || 'Fehler')
    if (res.ok) loadData()
    setProcessing(false)
  }

  const handlePurgeTicket = async (ticketId: string) => {
    setProcessing(true)
    const res = await purgeTicket(ticketId)
    showAction(res.ok, res.ok ? 'Ticket gelöscht' : res.error || 'Fehler')
    if (res.ok) loadData()
    setProcessing(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
          <Radio className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Action Center</h2>
          <p className="text-sm text-muted-foreground">
            Heartbeat, Ticket prüfen, Keys/Tickets verwalten – alles an einem Ort
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground/85">
            Standard-Workspace für Rolle <span className="font-mono">arbeiter</span> /{' '}
            <span className="font-mono">lock</span> (Fahrplan H.0 #3 · docs/UI-ROLLEN-WORKSPACES.md).
          </p>
        </div>
      </div>

      {actionStatus !== 'idle' && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg p-3 text-sm font-medium',
            actionStatus === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          )}
        >
          {actionStatus === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {actionMsg}
        </div>
      )}

      {/* Statuszeile: Heartbeat + Guthaben-Platzhalter */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-amber-400" />
              <span className="font-medium text-foreground">Heartbeat</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={intervalMs}
                onChange={(e) => setIntervalMs(e.target.value)}
                className="w-20 rounded border border-border bg-input px-2 py-1 text-sm"
                min="5000"
                step="1000"
              />
              <span className="text-xs text-muted-foreground">ms</span>
              <button
                onClick={handleSetInterval}
                className="rounded bg-muted px-2 py-1 text-xs hover:bg-muted/80"
              >
                Set
              </button>
            </div>
          </div>
          <button
            onClick={handleHeartbeat}
            className={cn(
              'mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors',
              heartbeatStatus === 'success'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-primary text-primary-foreground hover:opacity-90'
            )}
          >
            {heartbeatStatus === 'success' ? (
              <Check className="h-4 w-4" />
            ) : (
              <Activity className="h-4 w-4" />
            )}
            {heartbeatStatus === 'success' ? heartbeatMsg : 'Heartbeat senden'}
          </button>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium text-foreground">Guthaben</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">– (API optional)</p>
        </div>
      </div>

      {/* Ticket einlösen */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
          <Ticket className="h-4 w-4" />
          Ticket einlösen
        </h3>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Ticket-ID"
            value={ticketIdToUse}
            onChange={(e) => setTicketIdToUse(e.target.value)}
            className="rounded border border-border bg-input px-3 py-2 text-sm min-w-[140px]"
          />
          <input
            type="text"
            placeholder="Event-ID"
            value={eventIdToUse}
            onChange={(e) => setEventIdToUse(e.target.value)}
            className="rounded border border-border bg-input px-3 py-2 text-sm min-w-[120px]"
          />
          <button
            onClick={handleUseTicket}
            disabled={processing || !ticketIdToUse.trim() || !eventIdToUse.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Einlösen
          </button>
        </div>
      </div>

      {/* Keys & Tickets verwalten (Purge) */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
            <Key className="h-4 w-4" />
            Keys ({keys.length})
          </h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">Lade…</p>
          ) : keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Keys</p>
          ) : (
            <ul className="space-y-2 max-h-48 overflow-auto">
              {keys.slice(0, 20).map((k) => (
                <li
                  key={k.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
                >
                  <span className="truncate font-mono text-xs">{k.id.slice(0, 16)}…</span>
                  <button
                    onClick={() => handlePurgeKey(k.id)}
                    disabled={processing}
                    className="rounded p-1 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                    title="Key purgen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
            <Ticket className="h-4 w-4" />
            Tickets ({tickets.length})
          </h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">Lade…</p>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Tickets</p>
          ) : (
            <ul className="space-y-2 max-h-48 overflow-auto">
              {tickets.slice(0, 20).map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
                >
                  <span className="truncate font-mono text-xs">{t.id.slice(0, 16)}…</span>
                  <button
                    onClick={() => handlePurgeTicket(t.id)}
                    disabled={processing}
                    className="rounded p-1 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                    title="Ticket purgen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <button
        onClick={loadData}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm hover:bg-muted/50 disabled:opacity-50"
      >
        <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        Aktualisieren
      </button>
    </div>
  )
}
