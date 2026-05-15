'use client'

/**
 * IOTA-Überweisung über die Wallet-Session — **Haupt-Dashboard** für schnellen Zugriff (gleiche API wie zuvor in den Einstellungen).
 */

import { useState } from 'react'
import { Check, RefreshCw, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { transferCoins } from '@/frontend/lib/api'

export type DashboardIotaTransferCardProps = {
  /** Aus GET /api/status (nach Unlock). */
  walletNativeIotaBalance?: { mist: string; displayIota: string } | null
  walletNativeIotaBalanceFetchFailed?: boolean
  /** Volle MY_ADDRESS vom Backend (0x+64) — für Saldo-Abfrage nötig. */
  hasValidMyAddressForBalance?: boolean
  /** Status erneut laden (Saldo aktualisieren). */
  onRefreshStatus?: () => void | Promise<void>
  /** Vorschläge für Empfänger (z. B. eigene Adresse, verbundene Partner) — nur Auswahlhilfe. */
  addressSuggestions?: string[]
}

export function DashboardIotaTransferCard({
  walletNativeIotaBalance,
  walletNativeIotaBalanceFetchFailed,
  hasValidMyAddressForBalance = false,
  onRefreshStatus,
  addressSuggestions = [],
}: DashboardIotaTransferCardProps) {
  const [transferTo, setTransferTo] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [transferStatus, setTransferStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [transferMsg, setTransferMsg] = useState('')
  const [refreshingBalance, setRefreshingBalance] = useState(false)

  const handleRefreshBalance = async () => {
    if (!onRefreshStatus) return
    setRefreshingBalance(true)
    try {
      await onRefreshStatus()
    } finally {
      setRefreshingBalance(false)
    }
  }

  const handleTransfer = async () => {
    if (!transferTo || !transferAmount) return
    setTransferring(true)
    setTransferStatus('idle')
    const res = await transferCoins(transferTo, parseFloat(transferAmount))
    if (res.ok) {
      setTransferStatus('success')
      setTransferMsg('Transfer erfolgreich!')
      setTransferTo('')
      setTransferAmount('')
      void handleRefreshBalance()
    } else {
      setTransferStatus('error')
      setTransferMsg(res.error || 'Transfer fehlgeschlagen')
    }
    setTransferring(false)
    setTimeout(() => setTransferStatus('idle'), 5000)
  }

  const balanceLine = (() => {
    if (walletNativeIotaBalanceFetchFailed) {
      return <p className="text-xs text-amber-600 dark:text-amber-400">Saldo: Abfrage fehlgeschlagen (RPC?).</p>
    }
    if (walletNativeIotaBalance) {
      return (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span title={`Exakt: ${walletNativeIotaBalance.mist} MIST`}>
            Wallet: <strong className="text-foreground">{walletNativeIotaBalance.displayIota} IOTA</strong>
          </span>
          {onRefreshStatus ? (
            <button
              type="button"
              onClick={() => void handleRefreshBalance()}
              disabled={refreshingBalance}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[11px] text-foreground hover:bg-accent disabled:opacity-50"
              title="Saldo vom Netzwerk neu laden"
            >
              <RefreshCw className={cn('h-3 w-3', refreshingBalance && 'animate-spin')} aria-hidden />
              Aktualisieren
            </button>
          ) : null}
        </div>
      )
    }
    if (!hasValidMyAddressForBalance) {
      return (
        <p className="text-xs text-muted-foreground">
          Für den Saldo braucht die laufende Morgendrot-Basis eine gültige{' '}
          <span className="font-mono">MY_ADDRESS</span> (0x + 64 Hex) in der Konfiguration. Diese Karte siehst du nur,
          wenn der <strong className="text-foreground/90">Tresor bereits entsperrt</strong> ist (Passwort-Dialog weg).
        </p>
      )
    }
    return (
      <div className="space-y-2 text-xs text-muted-foreground">
        <p>
          Saldo wird über die IOTA-RPC der Basis abgefragt. Kurz warten,{' '}
          {onRefreshStatus ? (
            <button
              type="button"
              onClick={() => void handleRefreshBalance()}
              disabled={refreshingBalance}
              className="font-medium text-foreground underline-offset-2 hover:underline disabled:opacity-50"
            >
              Aktualisieren
            </button>
          ) : (
            'Aktualisieren'
          )}{' '}
          oder den Status-Poll abwarten.
        </p>
      </div>
    )
  })()

  return (
    <div id="dashboard-iota-transfer" className="rounded-xl border border-border bg-card p-4">
      <h4 className="mb-3 font-semibold text-foreground">IOTA überweisen</h4>
      <div className="mb-3 rounded-lg border border-border/80 bg-muted/30 px-3 py-2">{balanceLine}</div>
      {transferStatus !== 'idle' && (
        <div
          className={cn(
            'mb-3 flex items-center gap-2 rounded-lg p-3 text-sm font-medium',
            transferStatus === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          )}
        >
          {transferStatus === 'success' ? <Check className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          {transferMsg}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Empfänger</label>
          <input
            type="text"
            list="dashboard-iota-transfer-recipients"
            value={transferTo}
            onChange={(e) => setTransferTo(e.target.value)}
            placeholder="0x..."
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <datalist id="dashboard-iota-transfer-recipients">
            {addressSuggestions.map((addr) => (
              <option key={addr} value={addr} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Betrag (IOTA)</label>
          <input
            type="number"
            value={transferAmount}
            onChange={(e) => setTransferAmount(e.target.value)}
            placeholder="0.1"
            step="0.01"
            min="0"
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={() => void handleTransfer()}
        disabled={transferring || !transferTo || !transferAmount}
        className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {transferring ? 'Überweise…' : 'Überweisen'}
      </button>
    </div>
  )
}
