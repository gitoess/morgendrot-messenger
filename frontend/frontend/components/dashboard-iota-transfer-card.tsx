'use client'

/**
 * IOTA-Überweisung über die Wallet-Session — Dashboard (voll oder kompakt für Boss-Start).
 * Frei | Gesichert im gleichen Stil; „Aus Guthaben senden“ öffnet inline im Send-Bereich.
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
  countSecuredNftObjects,
  DashboardNftSecuredBalanceAmount,
  requestNftVaultBalanceRefresh,
} from '@/frontend/components/dashboard-nft-secured-balances'
import { DashboardNftSecuredSpendPanel } from '@/frontend/components/dashboard-nft-secured-spend-panel'
import { nftVaultSessionHint } from '@/frontend/lib/nft-vault-session-gate'
import { VAULT_PASSWORD_SESSION_CHANGED } from '@/frontend/lib/vault-password-session'
import { listParkedNftVaults } from '@/frontend/lib/nft-vault-parked-store'
import { NFT_GUARDED_PURSE_CHANGED } from '@/frontend/lib/nft-guarded-purse-local-store'
import { NFT_BEARER_TREASURY_CHANGED } from '@/frontend/lib/nft-bearer-treasury-local-store'
import {
  listNftOwnedSnapshot,
  NFT_ACTIVITY_CHANGED_EVENT,
} from '@/frontend/lib/nft-activity-local-log'

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
  const [securedSpendOpen, setSecuredSpendOpen] = useState(false)
  const [securedPreferOid, setSecuredPreferOid] = useState<string | undefined>()
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [receiveQrUrl, setReceiveQrUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [transferTo, setTransferTo] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [transferStatus, setTransferStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [transferMsg, setTransferMsg] = useState('')
  const [refreshingBalance, setRefreshingBalance] = useState(false)
  const [vaultHint, setVaultHint] = useState(() => nftVaultSessionHint())
  const [parkedCount, setParkedCount] = useState(0)
  const [nftCount, setNftCount] = useState(0)
  const [nftGalleryOpenNonce, setNftGalleryOpenNonce] = useState(0)

  const myAddress = (myAddressFull || '').trim()
  const addrOk = /^0x[a-fA-F0-9]{64}$/i.test(myAddress)

  useEffect(() => {
    const sync = () => {
      setVaultHint(nftVaultSessionHint())
      setParkedCount(listParkedNftVaults().length)
      const owned = listNftOwnedSnapshot().length
      setNftCount(owned > 0 ? owned : countSecuredNftObjects())
    }
    sync()
    window.addEventListener(VAULT_PASSWORD_SESSION_CHANGED, sync)
    window.addEventListener(NFT_GUARDED_PURSE_CHANGED, sync)
    window.addEventListener(NFT_BEARER_TREASURY_CHANGED, sync)
    window.addEventListener(NFT_ACTIVITY_CHANGED_EVENT, sync)
    return () => {
      window.removeEventListener(VAULT_PASSWORD_SESSION_CHANGED, sync)
      window.removeEventListener(NFT_GUARDED_PURSE_CHANGED, sync)
      window.removeEventListener(NFT_BEARER_TREASURY_CHANGED, sync)
      window.removeEventListener(NFT_ACTIVITY_CHANGED_EVENT, sync)
    }
  }, [])

  const openSecuredSpend = (preferredObjectId?: string) => {
    setSecuredPreferOid(preferredObjectId)
    setSecuredSpendOpen(true)
    if (compact) setTransferOpen(true)
  }

  const handleRefreshBalance = async () => {
    setRefreshingBalance(true)
    try {
      try {
        const { syncDiscoveredVaultsIntoLocalIndex } = await import(
          '@/frontend/lib/nft-vault-discover-onchain'
        )
        await syncDiscoveredVaultsIntoLocalIndex()
      } catch {
        /* ignore */
      }
      requestNftVaultBalanceRefresh()
      if (onRefreshStatus) await onRefreshStatus()
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

  const walletHeader = (
    <div className="mb-2 space-y-1.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className={cn('font-semibold text-foreground', compact ? 'text-sm' : '')}>
            {t('cards.iotaWallet')}
          </h4>
          <div className="mt-1 flex flex-wrap items-start gap-x-5 gap-y-1">
            <div className="min-w-[5.5rem]">
              <p className="text-[10px] text-muted-foreground">Frei:</p>
              {freeBalanceLine}
            </div>
            <div className="min-w-[5.5rem]">
              <p className="text-[10px] text-muted-foreground">Gesichert:</p>
              <DashboardNftSecuredBalanceAmount compact={compact} />
            </div>
            <div className="min-w-[4.5rem]">
              <p className="text-[10px] text-muted-foreground">NFT:</p>
              <button
                type="button"
                className="text-left text-xs text-muted-foreground hover:underline"
                title="NFT-Galerie öffnen"
                aria-label="NFT-Galerie öffnen"
                onClick={() => setNftGalleryOpenNonce((n) => n + 1)}
              >
                <strong className="text-foreground">{nftCount}</strong>
              </button>
            </div>
          </div>
        </div>
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
      </div>
      {vaultHint ? (
        <p className="rounded border border-amber-800/30 bg-amber-950/15 px-2 py-1 text-[10px] text-amber-100/90">
          {vaultHint}
        </p>
      ) : null}
      {parkedCount > 0 ? (
        <p className="text-[10px] text-muted-foreground">
          {parkedCount} NFT geparkt — Galerie laden oder Tresor entsperren.
        </p>
      ) : null}
    </div>
  )

  const nftButton = (
    <ChatViewEvidenceImageViewerButton
      triggerLabel={t('iota.nft')}
      defaultMode="owner"
      autoLoadOwnOnOpen
      allowedModes={NFT_WALLET_MODES}
      openNonce={nftGalleryOpenNonce}
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

  const freeTransferForm = (
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
    </>
  )

  const sendSection = (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setSecuredSpendOpen(false)}
          className={cn(
            'rounded-md border px-2.5 py-1 text-[11px] font-medium',
            !securedSpendOpen
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
          )}
        >
          Frei senden
        </button>
        <button
          type="button"
          onClick={() => openSecuredSpend()}
          className={cn(
            'rounded-md border px-2.5 py-1 text-[11px] font-medium',
            securedSpendOpen
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
          )}
        >
          Aus Guthaben senden
        </button>
      </div>
      {securedSpendOpen ? (
        <DashboardNftSecuredSpendPanel
          preferredObjectId={securedPreferOid}
          onClose={() => {
            setSecuredSpendOpen(false)
            setSecuredPreferOid(undefined)
          }}
        />
      ) : (
        freeTransferForm
      )}
    </div>
  )

  if (compact) {
    return (
      <>
        <div id="dashboard-iota-transfer" className="rounded-xl border border-border/80 bg-card/60 p-3">
          {walletHeader}
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
          {transferOpen ? <div className="mt-3 border-t border-border/60 pt-3">{sendSection}</div> : null}
        </div>
        {receiveDialog}
      </>
    )
  }

  return (
    <>
      <div id="dashboard-iota-transfer" className="rounded-xl border border-border bg-card p-4">
        {walletHeader}
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
        {sendSection}
      </div>
      {receiveDialog}
    </>
  )
}
