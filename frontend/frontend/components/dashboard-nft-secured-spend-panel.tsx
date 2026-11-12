'use client'

/**
 * Aus Guthaben senden — Empfänger zuerst, klare Kartenwahl, Vault auto erkennen.
 * Anlegen nur im NFT-Tab Guthaben.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NftKeycardImagePreview } from '@/frontend/components/nft-keycard-image-preview'
import {
  NFT_BEARER_TREASURY_CHANGED,
  findNftBearerTreasuryByNft,
  listNftBearerTreasuriesLocal,
} from '@/frontend/lib/nft-bearer-treasury-local-store'
import { withdrawNftBearerTreasury } from '@/frontend/lib/nft-bearer-treasury-actions'
import {
  NFT_GUARDED_PURSE_CHANGED,
  findNftGuardedPurseByNft,
  iotaDecimalToMist,
  listNftGuardedPursesLocal,
} from '@/frontend/lib/nft-guarded-purse-local-store'
import { spendNftGuardedPurse } from '@/frontend/lib/nft-guarded-purse-actions'
import {
  NFT_KEYCARD_VAULT_CHANGED_EVENT,
  getNftKeycard,
  listNftKeycards,
} from '@/frontend/lib/nft-keycard-local-store'
import {
  buildSecuredSpendOptions,
  inferSpendModeForNft,
} from '@/frontend/lib/nft-secured-spend-options'
import {
  fetchNftVaultBalance,
  formatLocalMistHintAsIota,
} from '@/frontend/lib/nft-vault-balance'
import { restoreParkedVaultsForOwnedNfts } from '@/frontend/lib/nft-vault-local-clear'
import { NFT_VAULT_PARKED_CHANGED, listParkedNftVaults } from '@/frontend/lib/nft-vault-parked-store'
import { recoverNftVaultFromDigest } from '@/frontend/lib/nft-vault-recover-from-tx'
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

export function DashboardNftSecuredSpendPanel(p: {
  preferredObjectId?: string
  className?: string
  onClose?: () => void
}) {
  const [tick, setTick] = useState(0)
  const [selected, setSelected] = useState('')
  const [manualDraft, setManualDraft] = useState('')
  const [manualError, setManualError] = useState('')
  const [amountIota, setAmountIota] = useState('0.01')
  const [recipient, setRecipient] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')
  const [err, setErr] = useState('')
  const [liveIota, setLiveIota] = useState<string | null>(null)
  const [digestIn, setDigestIn] = useState('')
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

  /** Chain-Scan: Guarded owned + Bearer Create-Events → lokaler Index (kein manueller Digest). */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const r = await syncDiscoveredVaultsIntoLocalIndex()
      if (cancelled) return
      if (r.ok) {
        if (r.guarded + r.bearer > 0) {
          setInfo(`On-chain gefunden: ${r.guarded} Guarded · ${r.bearer} Bearer`)
          requestNftVaultBalanceRefresh()
        }
        setTick((n) => n + 1)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const options = useMemo(() => {
    void tick
    return buildSecuredSpendOptions()
  }, [tick])

  const indexStats = useMemo(() => {
    void tick
    return {
      keycards: listNftKeycards().length,
      purses: listNftGuardedPursesLocal().filter((x) => x.status === 'active').length,
      treasuries: listNftBearerTreasuriesLocal().filter((x) => x.status === 'active').length,
      parked: listParkedNftVaults().length,
    }
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

  const applyManual = () => {
    const id = normOid(manualDraft)
    if (!isPlausibleOid(id)) {
      setManualError('Object-ID: 0x + genau 64 Hex-Zeichen.')
      return
    }
    setManualError('')
    setSelected(id)
    setManualDraft('')
    restoreParkedVaultsForOwnedNfts([id])
    setTick((n) => n + 1)
  }

  const pay = async () => {
    setErr('')
    setInfo('')
    if (!activeId) {
      setErr('Zuerst NFT/Schlüsselkarte wählen oder Object-ID übernehmen.')
      return
    }
    if (!/^0x[a-fA-F0-9]{64}$/.test(recipient.trim())) {
      setErr('Empfänger: volle Wallet-Adresse (0x + 64 Hex).')
      return
    }
    restoreParkedVaultsForOwnedNfts([activeId])
    const v = resolveVault(activeId)
    if (!v) {
      setErr('Kein Purse/Treasury für diese NFT-ID — Digest nachtragen (unten) oder zuerst Guthaben anlegen (NFT-Dialog).')
      return
    }
    let mist: bigint
    try {
      mist = iotaDecimalToMist(amountIota)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ungültiger Betrag')
      return
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
              recipientAddress: recipient,
            })
          : await withdrawNftBearerTreasury({
              messagingPackageId: v.pkg,
              treasuryObjectId: v.vaultId,
              nftObjectId: activeId,
              amountMist: mist,
              recipientAddress: recipient,
            })
      if (!r.ok) {
        setErr(r.error || 'Auszahlen fehlgeschlagen')
        return
      }
      setInfo(
        `Ausgezahlt · TX ${r.digest?.slice(0, 14) || '?'}…${
          r.oneTimeNote ? ` · ${r.oneTimeNote}` : ''
        }`
      )
      setTick((n) => n + 1)
      await refreshBal(v.vaultId)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('space-y-3 rounded-md border border-border/70 bg-muted/15 px-3 py-2.5', p.className)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium text-foreground">Aus Guthaben senden</p>
          <p className="text-[10px] text-muted-foreground">
            Empfänger + Betrag. Auszahlen braucht Signer; Index speichern braucht entsperrten Tresor.
          </p>
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

      {vaultHint ? (
        <p className="rounded border border-amber-800/40 bg-amber-950/20 px-2 py-1.5 text-[10px] text-amber-100/95">
          {vaultHint}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-foreground">1. NFT / Schlüsselkarte</p>
        <p className="text-[10px] text-muted-foreground">
          Index: {indexStats.keycards} Karten · {indexStats.purses + indexStats.treasuries} Vaults
          {indexStats.parked > 0 ? ` · ${indexStats.parked} geparkt` : ''}
        </p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 text-[11px]"
          disabled={busy}
          onClick={() => {
            void (async () => {
              setBusy(true)
              setErr('')
              try {
                const r = await syncDiscoveredVaultsIntoLocalIndex()
                if (!r.ok) {
                  setErr(r.error || 'Discovery fehlgeschlagen.')
                  return
                }
                setTick((n) => n + 1)
                requestNftVaultBalanceRefresh()
                setInfo(
                  r.guarded + r.bearer > 0
                    ? `Vaults geladen: ${r.guarded + r.bearer} neu.`
                    : 'Keine neuen Vaults on-chain.'
                )
              } finally {
                setBusy(false)
              }
            })()
          }}
        >
          Vaults laden
        </Button>
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
          <p className="text-[10px] text-amber-100/90">
            Keine Einträge. Object-ID übernehmen oder Tresor entsperren / Digest nachtragen.
          </p>
        )}
        <div className="flex gap-1.5">
          <Input
            className="h-8 flex-1 font-mono text-[11px]"
            value={manualDraft}
            onChange={(e) => {
              setManualDraft(e.target.value)
              setManualError('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                applyManual()
              }
            }}
            placeholder="0x… NFT-Object-ID"
            spellCheck={false}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 shrink-0 text-[10px]"
            disabled={!manualDraft.trim()}
            onClick={applyManual}
          >
            Übernehmen
          </Button>
        </div>
        {manualError ? <p className="text-[10px] text-destructive">{manualError}</p> : null}
        {activeId ? (
          <>
            <p className="truncate font-mono text-[10px] text-muted-foreground">Aktiv: {activeId}</p>
            <NftKeycardImagePreview objectId={activeId} hintUrl={activeOpt?.previewUrl} compact />
          </>
        ) : null}
      </div>

      <div className="space-y-1.5 rounded border border-border/60 bg-background/40 px-2.5 py-2">
        <p className="text-[11px] font-medium text-foreground">2. Guthaben</p>
        {vault ? (
          <p className="text-[12px] text-foreground">
            {vault.kind === 'guarded' ? 'Nur ich' : 'Karteninhaber'}:{' '}
            <strong>{liveIota != null ? liveIota : vault.balanceHint || '—'}</strong> IOTA
            <span className="ml-1 font-mono text-[10px] text-muted-foreground">
              ({shortId(vault.vaultId)})
            </span>
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-foreground">Noch kein Guthaben für dieses NFT.</p>
            <ChatViewEvidenceImageViewerButton
              triggerLabel="Zum Guthaben-Tab"
              defaultMode="guthaben"
              preferredObjectId={activeId || undefined}
              allowedModes={NFT_WALLET_MODES}
              autoLoadOwnOnOpen
              triggerClassName="inline-flex h-8 items-center justify-center rounded-md border border-border bg-primary px-3 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
            />
            <details className="rounded border border-border/50 px-2 py-1.5">
              <summary className="cursor-pointer text-[10px] text-muted-foreground">
                Erweitert: Create-TX nachtragen
              </summary>
              <div className="mt-1.5 flex gap-1.5">
                <Input
                  className="h-8 flex-1 font-mono text-[10px]"
                  value={digestIn}
                  onChange={(e) => setDigestIn(e.target.value)}
                  placeholder="TX-Digest"
                  spellCheck={false}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-[10px]"
                  disabled={busy || !digestIn.trim()}
                  onClick={() => {
                    void (async () => {
                      setBusy(true)
                      setErr('')
                      try {
                        const r = await recoverNftVaultFromDigest(digestIn.trim())
                        if (!r.ok) {
                          setErr(r.error)
                          return
                        }
                        setSelected(r.vault.nftObjectId)
                        setDigestIn('')
                        setInfo('Vault aus Digest nachgetragen.')
                        setTick((n) => n + 1)
                      } finally {
                        setBusy(false)
                      }
                    })()
                  }}
                >
                  Nachtragen
                </Button>
              </div>
            </details>
          </div>
        )}
      </div>

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

      {err ? <p className="text-[11px] text-destructive whitespace-pre-wrap">{err}</p> : null}
      {info ? <p className="text-[11px] text-foreground whitespace-pre-wrap">{info}</p> : null}
    </div>
  )
}
