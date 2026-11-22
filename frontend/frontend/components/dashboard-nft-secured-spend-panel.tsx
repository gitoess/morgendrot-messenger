'use client'

/**
 * Aus Guthaben senden — Empfänger zuerst, klare Kartenwahl, Vault auto erkennen.
 * Anlegen nur im NFT-Tab Guthaben.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NftKeycardImagePreview } from '@/frontend/components/nft-keycard-image-preview'
import {
  NFT_BEARER_TREASURY_CHANGED,
  findNftBearerTreasuryByNft,
} from '@/frontend/lib/nft-bearer-treasury-local-store'
import { withdrawNftBearerTreasury } from '@/frontend/lib/nft-bearer-treasury-actions'
import {
  NFT_GUARDED_PURSE_CHANGED,
  findNftGuardedPurseByNft,
  iotaDecimalToMist,
} from '@/frontend/lib/nft-guarded-purse-local-store'
import { spendNftGuardedPurse } from '@/frontend/lib/nft-guarded-purse-actions'
import {
  NFT_KEYCARD_VAULT_CHANGED_EVENT,
  getNftKeycard,
} from '@/frontend/lib/nft-keycard-local-store'
import {
  buildSecuredSpendOptions,
  inferSpendModeForNft,
  nftHasFundedSecuredBalance,
} from '@/frontend/lib/nft-secured-spend-options'
import {
  fetchNftVaultBalance,
  formatLocalMistHintAsIota,
} from '@/frontend/lib/nft-vault-balance'
import { restoreParkedVaultsForOwnedNfts } from '@/frontend/lib/nft-vault-local-clear'
import { NFT_VAULT_PARKED_CHANGED, listParkedNftVaults } from '@/frontend/lib/nft-vault-parked-store'
import { syncDiscoveredVaultsIntoLocalIndex } from '@/frontend/lib/nft-vault-discover-onchain'
import { nftVaultSessionHint } from '@/frontend/lib/nft-vault-session-gate'
import { requestNftVaultBalanceRefresh } from '@/frontend/components/dashboard-nft-secured-balances'
import {
  ChatViewEvidenceImageViewerButton,
  NFT_WALLET_MODES,
} from '@/frontend/components/chat-view-evidence-image-viewer'
import { VAULT_PASSWORD_SESSION_CHANGED } from '@/frontend/lib/vault-password-session'
import { MESSAGING_MODULES_PACKAGE_ID } from '@/frontend/lib/messaging-modules-package'
import { cn } from '@/lib/utils'

const API_BASE =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '')) || ''

function isPlausibleOid(raw: string): boolean {
  return /^0x[0-9a-f]{64}$/.test(raw.trim().toLowerCase())
}

function normOid(raw: string): string {
  return raw.trim().toLowerCase()
}

function shortId(id: string): string {
  const t = id.trim()
  if (t.length < 14) return t
  return `${t.slice(0, 8)}…${t.slice(-4)}`
}

async function fetchMyAddress(): Promise<string> {
  try {
    const r = await fetch(`${API_BASE}/api/status`, { cache: 'no-store' })
    if (!r.ok) return ''
    const j = (await r.json()) as { myAddressFull?: string; myAddress?: string }
    return (j.myAddressFull || j.myAddress || '').trim()
  } catch {
    return ''
  }
}

function resolveVault(nftObjectId: string): {
  kind: 'guarded' | 'bearer'
  vaultId: string
  pkg: string
  balanceHint: string | null
} | null {
  const id = normOid(nftObjectId)
  const mode = inferSpendModeForNft(id)
  const purse = findNftGuardedPurseByNft(id)
  const treasury = findNftBearerTreasuryByNft(id)
  if (mode === 'bearer' && treasury) {
    return {
      kind: 'bearer',
      vaultId: treasury.treasuryObjectId,
      pkg: treasury.messagingPackageId || MESSAGING_MODULES_PACKAGE_ID,
      balanceHint: formatLocalMistHintAsIota(treasury.balanceMistHint),
    }
  }
  if (purse) {
    return {
      kind: 'guarded',
      vaultId: purse.purseObjectId,
      pkg: purse.messagingPackageId || MESSAGING_MODULES_PACKAGE_ID,
      balanceHint: formatLocalMistHintAsIota(purse.balanceMistHint),
    }
  }
  if (treasury) {
    return {
      kind: 'bearer',
      vaultId: treasury.treasuryObjectId,
      pkg: treasury.messagingPackageId || MESSAGING_MODULES_PACKAGE_ID,
      balanceHint: formatLocalMistHintAsIota(treasury.balanceMistHint),
    }
  }
  const parked = listParkedNftVaults().find((p) => p.nftObjectId === id)
  if (parked) {
    return {
      kind: parked.kind,
      vaultId: parked.vaultObjectId,
      pkg: parked.messagingPackageId || MESSAGING_MODULES_PACKAGE_ID,
      balanceHint: formatLocalMistHintAsIota(parked.balanceMistHint),
    }
  }
  const bv = getNftKeycard(id)?.boundVault
  if (bv?.vaultObjectId) {
    return {
      kind: bv.kind,
      vaultId: bv.vaultObjectId,
      pkg: bv.messagingPackageId || MESSAGING_MODULES_PACKAGE_ID,
      balanceHint: null,
    }
  }
  return null
}

export type DashboardNftSecuredSpendHandle = {
  /** Eltern-Form (Empfänger/Betrag) → Vault-Spend. */
  payWith: (
    recipientAddress: string,
    amountIota: string
  ) => Promise<{ ok: boolean; error?: string }>
  canPay: boolean
  busy: boolean
}

export const DashboardNftSecuredSpendPanel = forwardRef<
  DashboardNftSecuredSpendHandle,
  {
    preferredObjectId?: string
    className?: string
    onClose?: () => void
    /** Inline unter Betrag — kein eigener Kasten/Titel. */
    embed?: boolean
    /** false = ausgegraut (Modus „Frei“). */
    interactive?: boolean
    /** Nur NFT-Wahl + Guthaben; Empfänger/Betrag/Senden vom Eltern-Form. */
    vaultOnly?: boolean
  }
>(function DashboardNftSecuredSpendPanel(p, ref) {
  const embed = Boolean(p.embed)
  const interactive = p.interactive !== false
  const vaultOnly = Boolean(p.vaultOnly)
  const [tick, setTick] = useState(0)
  const [selected, setSelected] = useState('')
  const [amountIota, setAmountIota] = useState('0.01')
  const [recipient, setRecipient] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')
  const [err, setErr] = useState('')
  const [liveIota, setLiveIota] = useState<string | null>(null)
  const [vaultHint, setVaultHint] = useState(() => nftVaultSessionHint())

  useEffect(() => {
    const sync = () => {
      setTick((n) => n + 1)
      setVaultHint(nftVaultSessionHint())
    }
    window.addEventListener('storage', sync)
    window.addEventListener(NFT_GUARDED_PURSE_CHANGED, sync)
    window.addEventListener(NFT_BEARER_TREASURY_CHANGED, sync)
    window.addEventListener(NFT_KEYCARD_VAULT_CHANGED_EVENT, sync)
    window.addEventListener(NFT_VAULT_PARKED_CHANGED, sync)
    window.addEventListener(VAULT_PASSWORD_SESSION_CHANGED, sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(NFT_GUARDED_PURSE_CHANGED, sync)
      window.removeEventListener(NFT_BEARER_TREASURY_CHANGED, sync)
      window.removeEventListener(NFT_KEYCARD_VAULT_CHANGED_EVENT, sync)
      window.removeEventListener(NFT_VAULT_PARKED_CHANGED, sync)
      window.removeEventListener(VAULT_PASSWORD_SESSION_CHANGED, sync)
    }
  }, [])

  /** Stiller Index-Refresh beim Öffnen — gleiches wie Wallet-↻, ohne Extra-Button. */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const r = await syncDiscoveredVaultsIntoLocalIndex()
      if (cancelled || !r.ok) return
      requestNftVaultBalanceRefresh()
      setTick((n) => n + 1)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const options = useMemo(() => {
    void tick
    return buildSecuredSpendOptions().filter((o) => nftHasFundedSecuredBalance(o.objectId))
  }, [tick])

  useEffect(() => {
    const prefer = normOid(p.preferredObjectId || '')
    if (prefer && isPlausibleOid(prefer)) {
      setSelected(prefer)
      return
    }
    if (!selected && options[0]) setSelected(options[0].objectId)
  }, [options, p.preferredObjectId, selected])

  const activeId = selected && isPlausibleOid(selected) ? selected : ''
  const activeOpt = options.find((o) => o.objectId === activeId)

  useEffect(() => {
    if (!activeId) return
    restoreParkedVaultsForOwnedNfts([activeId])
    setTick((n) => n + 1)
  }, [activeId])

  const vault = useMemo(() => {
    void tick
    return activeId ? resolveVault(activeId) : null
  }, [activeId, tick])

  const refreshBal = useCallback(async (vaultId: string | undefined) => {
    if (!vaultId) {
      setLiveIota(null)
      return
    }
    const r = await fetchNftVaultBalance(vaultId)
    setLiveIota(r.ok ? r.iotaLabel : null)
  }, [])

  useEffect(() => {
    void refreshBal(vault?.vaultId)
  }, [vault?.vaultId, refreshBal])

  const pay = async (override?: {
    recipient?: string
    amountIota?: string
  }): Promise<{ ok: boolean; error?: string }> => {
    setErr('')
    setInfo('')
    const recipientUse = (override?.recipient ?? recipient).trim()
    const amountUse = (override?.amountIota ?? amountIota).trim()
    if (override?.recipient != null) setRecipient(override.recipient)
    if (override?.amountIota != null) setAmountIota(override.amountIota)
    if (!activeId) {
      const msg = 'Zuerst NFT mit Guthaben wählen.'
      setErr(msg)
      return { ok: false, error: msg }
    }
    if (!/^0x[a-fA-F0-9]{64}$/.test(recipientUse)) {
      const msg = 'Empfänger: volle Wallet-Adresse (0x + 64 Hex).'
      setErr(msg)
      return { ok: false, error: msg }
    }
    restoreParkedVaultsForOwnedNfts([activeId])
    const v = resolveVault(activeId)
    if (!v) {
      const msg = 'Kein Guthaben für dieses NFT — unter NFT → NFT gesichert anlegen.'
      setErr(msg)
      return { ok: false, error: msg }
    }
    let mist: bigint
    try {
      mist = iotaDecimalToMist(amountUse)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ungültiger Betrag'
      setErr(msg)
      return { ok: false, error: msg }
    }
    setBusy(true)
    try {
      const r =
        v.kind === 'guarded'
          ? await spendNftGuardedPurse({
              messagingPackageId: v.pkg,
              purseObjectId: v.vaultId,
              nftObjectId: activeId,
              amountMist: mist,
              recipientAddress: recipientUse,
            })
          : await withdrawNftBearerTreasury({
              messagingPackageId: v.pkg,
              treasuryObjectId: v.vaultId,
              nftObjectId: activeId,
              amountMist: mist,
              recipientAddress: recipientUse,
            })
      if (!r.ok) {
        const msg = r.error || 'Auszahlen fehlgeschlagen'
        setErr(msg)
        return { ok: false, error: msg }
      }
      setInfo(
        `Ausgezahlt · TX ${r.digest?.slice(0, 14) || '?'}…${
          r.oneTimeNote ? ` · ${r.oneTimeNote}` : ''
        }`
      )
      setTick((n) => n + 1)
      await refreshBal(v.vaultId)
      return { ok: true }
    } finally {
      setBusy(false)
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      payWith: (recipientAddress, amount) =>
        pay({ recipient: recipientAddress, amountIota: amount }),
      canPay: Boolean(activeId && vault && !busy),
      busy,
    }),
    // pay closes over latest activeId/vault; refresh when those change
    [activeId, vault, busy, recipient, amountIota]
  )

  return (
    <div
      className={cn(
        'space-y-3',
        embed
          ? 'rounded-md border border-dashed border-border/60 bg-muted/10 px-2.5 py-2'
          : 'rounded-md border border-border/70 bg-muted/15 px-3 py-2.5',
        !interactive && 'pointer-events-none select-none opacity-45',
        p.className
      )}
      aria-disabled={!interactive}
    >
      {!embed ? (
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-medium text-foreground">NFT gesichert senden</p>
          </div>
          {p.onClose ? (
            <button
              type="button"
              className="shrink-0 text-[10px] text-muted-foreground underline-offset-2 hover:underline"
              onClick={p.onClose}
            >
              Schließen
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-[11px] font-medium text-foreground">NFT / Schlüsselkarte</p>
      )}

      {vaultHint && interactive && !embed ? (
        <p className="rounded border border-amber-800/40 bg-amber-950/20 px-2 py-1.5 text-[10px] text-amber-100/95">
          {vaultHint}
        </p>
      ) : null}

      <div className="space-y-1.5">
        {!embed ? (
          <p className="text-[11px] font-medium text-foreground">1. NFT mit Guthaben</p>
        ) : null}
        {options.length > 0 ? (
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-[12px] text-foreground"
            value={options.some((o) => o.objectId === selected) ? selected : ''}
            onChange={(e) => {
              const id = normOid(e.target.value)
              setSelected(id)
              restoreParkedVaultsForOwnedNfts([id])
              setTick((n) => n + 1)
            }}
          >
            {!options.some((o) => o.objectId === selected) ? (
              <option value="" disabled>
                — bitte wählen —
              </option>
            ) : null}
            {options.map((o) => (
              <option key={o.objectId} value={o.objectId}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Kein gesichertes Guthaben — unter NFT anlegen. Wallet-↻ aktualisiert auch den Vault-Index.
            </p>
            <ChatViewEvidenceImageViewerButton
              triggerLabel="Zu NFT gesichert"
              defaultMode="guthaben"
              preferredObjectId={activeId || undefined}
              allowedModes={NFT_WALLET_MODES}
              autoLoadOwnOnOpen
              triggerClassName="inline-flex h-8 items-center justify-center rounded-md border border-border bg-primary px-3 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
            />
          </div>
        )}
        {activeId && options.some((o) => o.objectId === activeId) ? (
          <NftKeycardImagePreview objectId={activeId} hintUrl={activeOpt?.previewUrl} compact />
        ) : null}
      </div>

      {vault ? (
        <div className="space-y-1.5 rounded border border-border/60 bg-background/40 px-2.5 py-2">
          <p className="text-[11px] font-medium text-foreground">
            {embed ? 'Guthaben' : '2. Guthaben'}
          </p>
          <p className="text-[12px] text-foreground">
            {vault.kind === 'guarded' ? 'Nur ich' : 'Karteninhaber'}:{' '}
            <strong>{liveIota != null ? liveIota : vault.balanceHint || '—'}</strong> IOTA
            <span className="ml-1 font-mono text-[10px] text-muted-foreground">
              ({shortId(vault.vaultId)})
            </span>
          </p>
        </div>
      ) : null}

      {!vaultOnly ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-foreground">3. Empfänger & Betrag</p>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground">Empfänger-Wallet (0x…)</span>
            <div className="flex gap-1.5">
              <Input
                className="h-9 flex-1 font-mono text-[12px]"
                value={recipient}
                disabled={busy}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x… Empfänger-Adresse"
                spellCheck={false}
                autoComplete="off"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 shrink-0 text-[10px]"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    const me = await fetchMyAddress()
                    if (!me) {
                      setErr('Eigene Adresse nicht geladen.')
                      return
                    }
                    setRecipient(me)
                    setErr('')
                  })()
                }}
              >
                An mich
              </Button>
            </div>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground">Betrag (IOTA)</span>
            <Input
              className="h-9 font-mono text-[12px]"
              value={amountIota}
              disabled={busy}
              onChange={(e) => setAmountIota(e.target.value)}
              placeholder="0.01"
            />
          </label>
          <Button
            type="button"
            className="h-9 w-full text-[12px]"
            disabled={busy || !activeId || !vault || !recipient.trim() || !amountIota.trim()}
            onClick={() => void pay()}
          >
            {busy ? 'Sende…' : !vault ? 'Zuerst Guthaben anlegen' : 'Jetzt senden'}
          </Button>
        </div>
      ) : null}

      {err ? <p className="text-[11px] text-destructive whitespace-pre-wrap">{err}</p> : null}
      {info && interactive ? (
        <p className="text-[11px] text-foreground whitespace-pre-wrap">{info}</p>
      ) : null}
    </div>
  )
})
