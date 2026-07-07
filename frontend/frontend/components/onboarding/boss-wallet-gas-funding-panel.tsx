'use client'

import { useMemo, useState } from 'react'
import { Copy, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ApiStatus } from '@/frontend/lib/api/status'
import { fetchWalletBalances, mergeWalletBalancesIntoApiStatus } from '@/frontend/lib/api/wallet-balances'
import { buildBossOnboardingRuntime, resolveBossWizardAddress } from '@/frontend/lib/onboarding-boss-runtime'
import {
  bossWizardCanRequestTestnetTokens,
  previewBossTestnetFaucetUrl,
  requestBossTestnetGas,
  resolveBossWizardFullAddress,
} from '@/frontend/lib/boss-wizard-testnet-gas'
import {
  clearBossTestnetFaucetPrefs,
  readBossTestnetFaucetPrefs,
  writeBossTestnetFaucetPrefs,
  type BossTestnetFaucetPrefs,
} from '@/frontend/lib/boss-wizard-testnet-faucet-prefs'
import { IOTA_TESTNET_FAUCET_BASE } from '@morgendrot/shared/iota-testnet-faucet-url'
import {
  pickWalletBalanceForNetwork,
  walletBalanceFetchFailedForNetwork,
  walletHasGasForNetwork,
  type WalletNetworkId,
} from '@/frontend/lib/wallet-balance-by-network'
import { toast } from 'sonner'

type Props = {
  network: WalletNetworkId
  apiSnapshot?: ApiStatus | null
  fallbackMyAddress?: string | null
  sessionLocked?: boolean
  backendOnline?: boolean
  onActivateWallet?: () => void
  onReload?: () => void | Promise<void>
  compact?: boolean
}

const COPY = {
  testnet: {
    title: 'Gas für Testnet',
    intro:
      'Bevor du den Contract anlegst, braucht deine Wallet Testnet-Token für Transaktionsgebühren. Der Faucet öffnet sich im Browser — dort Captcha bestätigen.',
    networkLabel: 'Testnet',
    zeroHint: ' — noch zu wenig für einen Deploy.',
    hasGasHint: ' — Gas vorhanden.',
    footer:
      'IOTA verlangt im Browser ein Captcha. Nach dem Token-Eingang Saldo aktualisieren.',
  },
  mainnet: {
    title: 'Gas für Mainnet (IOTA)',
    intro:
      'Für Mainnet brauchst du echtes IOTA auf derselben Wallet-Adresse — z. B. von Börse oder anderer Wallet dorthin senden. Kein kostenloser Faucet.',
    networkLabel: 'Mainnet',
    zeroHint: ' — noch zu wenig für Deploy und Transaktionen.',
    hasGasHint: ' — IOTA vorhanden.',
    footer:
      'Sende nur IOTA im Mainnet-Netzwerk an diese Adresse. Nach dem Eingang Saldo aktualisieren.',
  },
} as const

export type BossWalletGasFundingPanelProps = Props

export function BossWalletGasFundingPanel(p: Props) {
  const copy = COPY[p.network]
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [balancePatch, setBalancePatch] = useState<Extract<
    Awaited<ReturnType<typeof fetchWalletBalances>>,
    { ok: true }
  > | null>(null)
  const [copied, setCopied] = useState(false)
  const [faucetPrefs, setFaucetPrefs] = useState<BossTestnetFaucetPrefs>(() => readBossTestnetFaucetPrefs())
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const effectiveApi = useMemo(
    () => (balancePatch ? mergeWalletBalancesIntoApiStatus(p.apiSnapshot, balancePatch) : p.apiSnapshot),
    [balancePatch, p.apiSnapshot]
  )

  const fullAddress = resolveBossWizardFullAddress(effectiveApi, p.fallbackMyAddress)
  const displayAddress =
    fullAddress ||
    resolveBossWizardAddress(effectiveApi, p.fallbackMyAddress) ||
    effectiveApi?.myAddress?.trim() ||
    ''
  const runtime = buildBossOnboardingRuntime(
    effectiveApi,
    p.sessionLocked ?? false,
    p.fallbackMyAddress
  )
  const serverWalletUnlocked = runtime.serverWalletUnlocked
  const needsUnlock = runtime.needsVaultUnlock || runtime.needsNewWallet
  const canRequestTestnet =
    p.network === 'testnet' &&
    bossWizardCanRequestTestnetTokens(fullAddress, { serverWalletUnlocked, faucetPrefs })
  const balance = pickWalletBalanceForNetwork(effectiveApi, p.network)
  const balanceFailed = walletBalanceFetchFailedForNetwork(effectiveApi, p.network)
  const hasGas = walletHasGasForNetwork(effectiveApi, p.network)
  const faucetPageUrl = previewBossTestnetFaucetUrl(fullAddress, faucetPrefs)
  const recipientOverrideActive =
    Boolean(faucetPrefs.recipientOverride.trim()) &&
    fullAddress &&
    faucetPrefs.recipientOverride.trim().toLowerCase() !== fullAddress.toLowerCase()

  const patchFaucetPrefs = (patch: Partial<BossTestnetFaucetPrefs>) => {
    setFaucetPrefs(writeBossTestnetFaucetPrefs(patch))
  }

  const borderClass =
    p.network === 'testnet' ? 'border-amber-500/40 bg-amber-500/10' : 'border-violet-500/40 bg-violet-500/10'

  const copyAddress = async () => {
    if (!fullAddress) return
    try {
      await navigator.clipboard.writeText(fullAddress)
      setCopied(true)
      toast.success('Adresse kopiert')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Kopieren fehlgeschlagen')
    }
  }

  const runTestnetFaucet = () => {
    if (!canRequestTestnet) return
    setBusy(true)
    try {
      const r = requestBossTestnetGas(fullAddress, { serverWalletUnlocked, faucetPrefs })
      if (!r.ok) {
        toast.error(r.error || 'Faucet konnte nicht geöffnet werden')
        return
      }
      toast.success(r.message || 'Faucet im Browser geöffnet.')
    } finally {
      window.setTimeout(() => setBusy(false), 400)
    }
  }

  const runReload = async () => {
    if (refreshing) return
    setRefreshing(true)
    let refreshed = false
    try {
      if (p.backendOnline !== false) {
        const r = await fetchWalletBalances()
        if (r.ok) {
          setBalancePatch(r)
          refreshed = true
        } else if (!p.onReload) {
          toast.error(r.error || 'Saldo konnte nicht geladen werden')
          return
        }
      }
      await p.onReload?.()
      if (refreshed || p.onReload) toast.success('Saldo aktualisiert')
      setBalancePatch(null)
    } catch {
      toast.error('Saldo konnte nicht aktualisiert werden')
    } finally {
      setRefreshing(false)
    }
  }

  const showReload = Boolean(p.onReload) || p.backendOnline !== false

  return (
    <div className={`space-y-2 rounded-md border px-3 py-2.5 ${borderClass}`}>
      <p className="text-sm font-medium text-foreground">{copy.title}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{copy.intro}</p>

      {displayAddress ? (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            {p.network === 'mainnet'
              ? 'IOTA an diese Wallet-Adresse senden (Mainnet):'
              : 'Deine Wallet-Adresse:'}
          </p>
          <p className="break-all font-mono text-xs text-foreground" title={fullAddress || displayAddress}>
            {fullAddress || displayAddress}
          </p>
          {fullAddress ? (
            <Button type="button" size="sm" variant="outline" onClick={() => void copyAddress()}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              {copied ? 'Kopiert!' : 'Adresse kopieren'}
            </Button>
          ) : null}
        </div>
      ) : serverWalletUnlocked ? (
        <p className="text-xs text-muted-foreground">
          Server-Wallet ist entsperrt — Adresse erscheint gleich oder unter IOTA → System-Identität.
        </p>
      ) : needsUnlock ? (
        <div className="space-y-2">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            {runtime.needsNewWallet
              ? 'Zuerst Wallet anlegen.'
              : 'Zuerst Wallet entsperren — dann Adresse und Saldo sichtbar.'}
          </p>
          {p.onActivateWallet ? (
            <Button type="button" size="sm" variant="default" onClick={() => p.onActivateWallet?.()}>
              {runtime.needsNewWallet ? 'Wallet einrichten' : 'Wallet entsperren'}
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="text-xs text-muted-foreground">
        {balanceFailed ? (
          <span>
            {copy.networkLabel}-Saldo konnte nicht geladen werden
            {showReload ? ' — erneut versuchen.' : '.'}
          </span>
        ) : balance ? (
          <span>
            {copy.networkLabel}:{' '}
            <strong className="text-foreground">{balance.displayIota} IOTA</strong>
            {hasGas === false ? copy.zeroHint : hasGas ? copy.hasGasHint : null}
          </span>
        ) : serverWalletUnlocked || fullAddress ? (
          <span>{copy.networkLabel}-Saldo wird geladen…</span>
        ) : (
          <span>Saldo erscheint nach dem Entsperren der Wallet.</span>
        )}
      </div>

      {p.network === 'testnet' ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="default"
              className={canRequestTestnet ? undefined : 'opacity-50'}
              disabled={busy || !canRequestTestnet}
              onClick={() => runTestnetFaucet()}
            >
              {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Testnet-Token anfordern
            </Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <a href={faucetPageUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Faucet-Seite
              </a>
            </Button>
          </div>
          {fullAddress && !faucetPrefs.customOpenUrl.trim() ? (
            <p className="break-all font-mono text-[10px] text-muted-foreground" title={faucetPageUrl}>
              Automatischer Link: {faucetPageUrl}
            </p>
          ) : null}
          {recipientOverrideActive ? (
            <p className="text-[10px] text-amber-800 dark:text-amber-200">
              Faucet nutzt eine andere Adresse als die aktuelle Wallet — prüfen oder „Aktuelle Wallet
              übernehmen“.
            </p>
          ) : null}
          <details
            className="rounded-md border border-border/60 bg-background/40 px-2 py-1.5"
            open={advancedOpen}
            onToggle={(e) => setAdvancedOpen((e.currentTarget as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              Erweitert (Faucet-Link &amp; Adresse, optional)
            </summary>
            <div className="mt-2 space-y-2">
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                Die Wallet-Adresse kann sich ändern (neues Gerät, andere Seed). Dann Link oder Empfänger
                hier anpassen — sonst wird die aktuelle Adresse oben verwendet.
              </p>
              <label className="block space-y-1">
                <span className="text-[10px] font-medium text-muted-foreground">
                  Eigener Faucet-Link (vollständige URL, optional)
                </span>
                <input
                  type="url"
                  value={faucetPrefs.customOpenUrl}
                  onChange={(e) => patchFaucetPrefs({ customOpenUrl: e.target.value })}
                  placeholder={faucetPageUrl}
                  className="w-full rounded-md border border-border bg-input px-2 py-1.5 font-mono text-[10px]"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-medium text-muted-foreground">
                  Adresse für automatischen Link (optional)
                </span>
                <input
                  type="text"
                  value={faucetPrefs.recipientOverride}
                  onChange={(e) => patchFaucetPrefs({ recipientOverride: e.target.value })}
                  placeholder={fullAddress || '0x…'}
                  className="w-full rounded-md border border-border bg-input px-2 py-1.5 font-mono text-[10px]"
                />
              </label>
              {fullAddress ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => patchFaucetPrefs({ recipientOverride: fullAddress })}
                >
                  Aktuelle Wallet-Adresse übernehmen
                </Button>
              ) : null}
              <label className="block space-y-1">
                <span className="text-[10px] font-medium text-muted-foreground">
                  Andere Faucet-Basis-URL (optional, ohne Adresse)
                </span>
                <input
                  type="url"
                  value={faucetPrefs.faucetBase}
                  onChange={(e) => patchFaucetPrefs({ faucetBase: e.target.value })}
                  placeholder={IOTA_TESTNET_FAUCET_BASE}
                  className="w-full rounded-md border border-border bg-input px-2 py-1.5 font-mono text-[10px]"
                />
              </label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  clearBossTestnetFaucetPrefs()
                  setFaucetPrefs(readBossTestnetFaucetPrefs())
                  toast.message('Faucet-Einstellungen auf Standard zurückgesetzt.')
                }}
              >
                Standard wiederherstellen
              </Button>
            </div>
          </details>
        </div>
      ) : fullAddress ? (
        <p className="text-xs text-violet-900 dark:text-violet-200">
          Tipp: In der Börse oder Sender-Wallet <strong className="font-medium">Netzwerk Mainnet</strong> wählen —
          Testnet-Token haben auf Mainnet keinen Wert.
        </p>
      ) : null}

      {showReload ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          disabled={refreshing || p.backendOnline === false}
          onClick={() => void runReload()}
        >
          {refreshing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Saldo aktualisieren
        </Button>
      ) : null}

      <p className="text-xs text-muted-foreground">{copy.footer}</p>
    </div>
  )
}
