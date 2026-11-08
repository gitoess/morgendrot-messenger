'use client'

/**
 * IOTA-Überweisung über die Wallet-Session — Dashboard (voll oder kompakt für Boss-Start).
 * Frei | Purse-Guthaben im gleichen Stil rechts neben dem Titel.
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
import { useAppTranslation } from '@/frontend/lib/i18n/hooks'
import {
  ChatViewEvidenceImageViewerButton,
  NFT_WALLET_MODES,
} from '@/frontend/components/chat-view-evidence-image-viewer'
import {
  DashboardNftSecuredBalanceAmount,
  DashboardNftSecuredBalances,
} from '@/frontend/components/dashboard-nft-secured-balances'

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
  const { t } = useAppTranslation('dashboard')
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
  const [nftDefaultMode, setNftDefaultMode] = useState<'owner' | 'guthaben'>('owner')
  const [nftOpenNonce, setNftOpenNonce] = useState(0)

  const myAddress = (myAddressFull || '').trim()
  const addrOk = /^0x[a-fA-F0-9]{64}$/i.test(myAddress)

  const openGuthaben = () => {
    setNftDefaultMode('guthaben')
    setNftOpenNonce((n) => n + 1)
  }

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
      setTransferMsg(t('iota.transferSuccess'))
      setTransferTo('')
      setTransferAmount('')
      void handleRefreshBalance()
    } else {
      setTransferStatus('error')
      setTransferMsg(res.error || t('iota.transferFailed'))
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

  const freeBalanceLine = (() => {
    if (walletNativeIotaBalanceFetchFailed) {
      return <p className="text-xs text-amber-600 dark:text-amber-400">{t('iota.balanceFailed')}</p>
    }
    if (walletNativeIotaBalance) {
      return (
        <span className="text-xs text-muted-foreground" title={`Exakt: ${walletNativeIotaBalance.mist} MIST`}>
          <strong className="text-foreground">{walletNativeIotaBalance.displayIota}</strong> IOTA
        </span>
      )
    }
    if (!hasValidMyAddressForBalance) {
      return <p className="text-[11px] text-muted-foreground">{t('iota.balanceAfterAddress')}</p>
    }
    return <p className="text-[11px] text-muted-foreground">{t('iota.balanceLoading')}</p>
  })()

  /** Titel + Frei | Purse Guthaben rechts, gleicher Stil. */
  const walletHeader = (
    <div className="mb-2 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h4 className={cn('font-semibold text-foreground', compact ? 'text-sm' : '')}>
          {t('cards.iotaWallet')}
        </h4>
        <div className="mt-1 flex flex-wrap items-start gap-x-5 gap-y-1">
          <div className="min-w-[7rem]">
            <p className="text-[10px] text-muted-foreground">Frei:</p>
            {freeBalanceLine}
          </div>
          <div className="min-w-[7rem]">
            <p className="text-[10px] text-muted-foreground">Purse Guthaben:</p>
            <DashboardNftSecuredBalanceAmount compact={compact} />
          </div>
        </div>
      </div>
      {onRefreshStatus ? (
        <button
          type="button"
          onClick={() => void handleRefreshBalance()}
          disabled={refreshingBalance}
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-50"
          title={t('iota.refreshBalance')}
          aria-label={t('iota.refreshBalance')}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshingBalance && 'animate-spin')} />
        </button>
      ) : null}
    </div>
  )

  const nftButton = (
    <ChatViewEvidenceImageViewerButton
      triggerLabel={t('iota.nft')}
      defaultMode={nftDefaultMode}
      openNonce={nftOpenNonce}
      autoLoadOwnOnOpen={nftDefaultMode === 'owner'}
      onOpenChange={(v) => {
        if (!v) setNftDefaultMode('owner')
      }}
      allowedModes={NFT_WALLET_MODES}
      triggerClassName="inline-flex h-auto w-auto items-center justify-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted [&>svg]:mr-0 [&>svg]:h-3.5 [&>svg]:w-3.5"
    />
  )

  const receiveDialog = (
    <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('iota.receiveTitle')}</DialogTitle>
          <DialogDescription>{t('iota.receiveDescription')}</DialogDescription>
        </DialogHeader>
        {receiveQrUrl ? (
          <img src={receiveQrUrl} alt={t('iota.receiveQrAlt')} className="mx-auto rounded-lg border border-border" />
        ) : (
          <p className="text-sm text-muted-foreground">{t('iota.noValidAddress')}</p>
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
              {copied ? t('iota.copied') : t('iota.copyAddress')}
            </button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )

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
          <label className="mb-0.5 block text-[11px] text-muted-foreground">{t('iota.recipient')}</label>
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
          <label className="mb-0.5 block text-[11px] text-muted-foreground">{t('iota.amount')}</label>
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
        {transferring ? t('iota.sending') : t('iota.send')}
      </button>
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        Oben = freie Coins. Gesichertes Guthaben: „Gesichert auszahlen…“ oder NFT → Tab Guthaben.
      </p>
    </>
  )

  if (compact) {
    return (
      <>
        <div id="dashboard-iota-transfer" className="rounded-xl border border-border/80 bg-card/60 p-3">
          {walletHeader}
          <DashboardNftSecuredBalances compact onOpenSpend={openGuthaben} />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTransferOpen((v) => !v)}
              className="rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              {transferOpen ? t('iota.hideSend') : t('iota.send')}
            </button>
            <button
              type="button"
              onClick={() => setReceiveOpen(true)}
              disabled={!addrOk}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40"
            >
              <QrCode className="h-3.5 w-3.5" aria-hidden />
              {t('iota.receive')}
            </button>
            {nftButton}
          </div>
          {transferOpen ? <div className="mt-3 border-t border-border/60 pt-3">{transferForm}</div> : null}
        </div>
        {receiveDialog}
      </>
    )
  }

  return (
    <>
      <div id="dashboard-iota-transfer" className="rounded-xl border border-border bg-card p-4">
        {walletHeader}
        <DashboardNftSecuredBalances onOpenSpend={openGuthaben} />
        <div className="mb-3 mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setReceiveOpen(true)}
            disabled={!addrOk}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40"
          >
            <QrCode className="h-3.5 w-3.5" aria-hidden />
            {t('iota.receive')}
          </button>
          {nftButton}
        </div>
        {transferForm}
      </div>
      {receiveDialog}
    </>
  )
}
