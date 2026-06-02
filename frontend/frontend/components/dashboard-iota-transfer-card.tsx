'use client'

/**
 * IOTA-Überweisung über die Wallet-Session — Dashboard (voll oder kompakt für Boss-Start).
 */

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, QrCode, RefreshCw, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { transferCoins } from '@/frontend/lib/api'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import QRCode from 'qrcode'

export type DashboardIotaTransferCardProps = {
  compact?: boolean
  myAddressFull?: string | null
  walletNativeIotaBalance?: { mist: string; displayIota: string } | null
  walletNativeIotaBalanceFetchFailed?: boolean
  hasValidMyAddressForBalance?: boolean
  onRefreshStatus?: () => void | Promise<void>
  addressSuggestions?: string[]
}

export function DashboardIotaTransferCard({
  compact = false,
  myAddressFull,
  walletNativeIotaBalance,
  walletNativeIotaBalanceFetchFailed,
  hasValidMyAddressForBalance = false,
  onRefreshStatus,
  addressSuggestions = [],
}: DashboardIotaTransferCardProps) {
  const [transferOpen, setTransferOpen] = useState(!compact)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [receiveQrUrl, setReceiveQrUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [transferTo, setTransferTo] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [transferStatus, setTransferStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [transferMsg, setTransferMsg] = useState('')
  const [refreshingBalance, setRefreshingBalance] = useState(false)

  const myAddress = (myAddressFull || '').trim()
  const addrOk = /^0x[a-fA-F0-9]{64}$/i.test(myAddress)

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

  const loadReceiveQr = useCallback(async () => {
    if (!addrOk) {
      setReceiveQrUrl('')
      return
    }
    try {
      const url = await QRCode.toDataURL(myAddress, { width: 220, margin: 2 })
      setReceiveQrUrl(url)
    } catch {
      setReceiveQrUrl('')
    }
  }, [addrOk, myAddress])

  useEffect(() => {
    if (receiveOpen) void loadReceiveQr()
  }, [receiveOpen, loadReceiveQr])

  const copyAddress = async () => {
    if (!addrOk) return
    try {
      await navigator.clipboard.writeText(myAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const balanceLine = (() => {
    if (walletNativeIotaBalanceFetchFailed) {
      return <p className="text-xs text-amber-600 dark:text-amber-400">Saldo: Abfrage fehlgeschlagen</p>
    }
    if (walletNativeIotaBalance) {
      return (
        <span className="text-xs text-muted-foreground" title={`Exakt: ${walletNativeIotaBalance.mist} MIST`}>
          <strong className="text-foreground">{walletNativeIotaBalance.displayIota}</strong> IOTA
        </span>
      )
    }
    if (!hasValidMyAddressForBalance) {
      return <p className="text-[11px] text-muted-foreground">Saldo nach gültiger MY_ADDRESS</p>
    }
    return <p className="text-[11px] text-muted-foreground">Saldo wird geladen…</p>
  })()

  const transferForm = (
    <>
      {transferStatus !== 'idle' && (
        <div
          className={cn(
            'mb-2 flex items-center gap-2 rounded-lg p-2 text-xs font-medium',
            transferStatus === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          )}
        >
          {transferStatus === 'success' ? <Check className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {transferMsg}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="mb-0.5 block text-[11px] text-muted-foreground">Empfänger</label>
          <input
            type="text"
            list="dashboard-iota-transfer-recipients"
            value={transferTo}
            onChange={(e) => setTransferTo(e.target.value)}
            placeholder="0x…"
            className="w-full rounded-md border border-border bg-input px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
          />
          <datalist id="dashboard-iota-transfer-recipients">
            {addressSuggestions.map((addr) => (
              <option key={addr} value={addr} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="mb-0.5 block text-[11px] text-muted-foreground">Betrag (IOTA)</label>
          <input
            type="number"
            value={transferAmount}
            onChange={(e) => setTransferAmount(e.target.value)}
            placeholder="0.1"
            step="0.01"
            min="0"
            className="w-full rounded-md border border-border bg-input px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={() => void handleTransfer()}
        disabled={transferring || !transferTo || !transferAmount}
        className="mt-2 w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {transferring ? 'Überweise…' : 'Überweisen'}
      </button>
    </>
  )

  if (compact) {
    return (
      <>
        <div
          id="dashboard-iota-transfer"
          className="rounded-xl border border-border/80 bg-card/60 p-3"
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-foreground">IOTA Wallet</h4>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">{balanceLine}</div>
            </div>
            {onRefreshStatus ? (
              <button
                type="button"
                onClick={() => void handleRefreshBalance()}
                disabled={refreshingBalance}
                className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-50"
                title="Saldo aktualisieren"
                aria-label="Saldo aktualisieren"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', refreshingBalance && 'animate-spin')} />
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTransferOpen((v) => !v)}
              className="rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              {transferOpen ? 'Überweisen ausblenden' : 'Überweisen'}
            </button>
            <button
              type="button"
              onClick={() => setReceiveOpen(true)}
              disabled={!addrOk}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40"
            >
              <QrCode className="h-3.5 w-3.5" aria-hidden />
              Empfangen
            </button>
          </div>
          {transferOpen ? <div className="mt-3 border-t border-border/60 pt-3">{transferForm}</div> : null}
        </div>
        <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>IOTA empfangen</DialogTitle>
              <DialogDescription>QR mit deiner Wallet-Adresse — Zahlung an diese Adresse.</DialogDescription>
            </DialogHeader>
            {receiveQrUrl ? (
              <img src={receiveQrUrl} alt="QR-Code Wallet-Adresse" className="mx-auto rounded-lg border border-border" />
            ) : (
              <p className="text-sm text-muted-foreground">Keine gültige Adresse — zuerst MY_ADDRESS setzen.</p>
            )}
            {addrOk ? (
              <div className="space-y-2">
                <p className="break-all font-mono text-[11px] leading-relaxed text-foreground">{myAddress}</p>
                <button
                  type="button"
                  onClick={() => void copyAddress()}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Kopiert' : 'Adresse kopieren'}
                </button>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <div id="dashboard-iota-transfer" className="rounded-xl border border-border bg-card p-4">
      <h4 className="mb-3 font-semibold text-foreground">IOTA überweisen</h4>
      <div className="mb-3 rounded-lg border border-border/80 bg-muted/30 px-3 py-2">{balanceLine}</div>
      {transferForm}
    </div>
  )
}
