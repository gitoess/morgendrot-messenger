'use client'

/**
 * IOTA-Überweisung über die Wallet-Session — **Haupt-Dashboard** für schnellen Zugriff (gleiche API wie zuvor in den Einstellungen).
 */

import { useState } from 'react'
import { Check, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { transferCoins } from '@/frontend/lib/api'

export function DashboardIotaTransferCard() {
  const [transferTo, setTransferTo] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [transferStatus, setTransferStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [transferMsg, setTransferMsg] = useState('')

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
    } else {
      setTransferStatus('error')
      setTransferMsg(res.error || 'Transfer fehlgeschlagen')
    }
    setTransferring(false)
    setTimeout(() => setTransferStatus('idle'), 5000)
  }

  return (
    <div id="dashboard-iota-transfer" className="rounded-xl border border-border bg-card p-4">
      <h4 className="mb-3 font-semibold text-foreground">IOTA überweisen</h4>
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
            value={transferTo}
            onChange={(e) => setTransferTo(e.target.value)}
            placeholder="0x..."
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
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
