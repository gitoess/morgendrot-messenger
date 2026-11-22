'use client'

/**
 * Gesichertes Guthaben — Live-Balance, Modi, Vault-ID.
 * Admin sichtbar bei Modus Karteninhaber + vorhandenem Vault.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MESSAGING_MODULES_PACKAGE_ID } from '@/frontend/lib/messaging-modules-package'
import {
  adminReclaimNftBearerTreasuryToSelf,
  adminSetFrozenNftBearerTreasury,
  createNftBearerTreasury,
  depositNftBearerTreasury,
} from '@/frontend/lib/nft-bearer-treasury-actions'
import {
  findNftBearerTreasuryById,
  findNftBearerTreasuryByNft,
  NFT_BEARER_TREASURY_CHANGED,
  patchNftBearerTreasuryLocal,
  type NftBearerTreasuryLocalEntry,
} from '@/frontend/lib/nft-bearer-treasury-local-store'
import {
  createNftGuardedPurse,
  depositNftGuardedPurse,
} from '@/frontend/lib/nft-guarded-purse-actions'
import {
  findNftGuardedPurseById,
  findNftGuardedPurseByNft,
  iotaDecimalToMist,
  NFT_GUARDED_PURSE_CHANGED,
  patchNftGuardedPurseLocal,
  type NftGuardedPurseLocalEntry,
} from '@/frontend/lib/nft-guarded-purse-local-store'
import {
  NFT_TOKEN_SPEND_MODE_CHANGED,
  nftTokenSpendModeOptionLabel,
  readNftTokenSpendMode,
  writeNftTokenSpendMode,
  type NftTokenSpendMode,
} from '@/frontend/lib/nft-token-spend-mode'
import {
  fetchNftVaultBalance,
  formatLocalMistHintAsIota,
} from '@/frontend/lib/nft-vault-balance'
import { hydrateLocalIndexFromKeycardBoundVault } from '@/frontend/lib/nft-vault-handoff'
import { autoDestroyEmptyNftVault } from '@/frontend/lib/nft-vault-auto-destroy-empty'
import {
  getNftSpendPolicy,
  NFT_SPEND_POLICY_CHANGED,
  upsertNftSpendPolicy,
} from '@/frontend/lib/nft-spend-policy-local-store'
import { restoreParkedVaultsForOwnedNfts } from '@/frontend/lib/nft-vault-local-clear'
import { inferSpendModeForNft } from '@/frontend/lib/nft-secured-spend-options'
import { nftVaultSessionHint } from '@/frontend/lib/nft-vault-session-gate'
import {
  hasVaultPasswordSession,
  VAULT_PASSWORD_SESSION_CHANGED,
} from '@/frontend/lib/vault-password-session'

const LS_PKG = 'morgendrot.nftTokenSpend.messagingPackageId.v1'

function readPkg(): string {
  if (typeof window === 'undefined') return MESSAGING_MODULES_PACKAGE_ID
  try {
    return (
      window.localStorage.getItem(LS_PKG)?.trim() ||
      window.localStorage.getItem('morgendrot.nftGuardedPurse.messagingPackageId.v1')?.trim() ||
      window.localStorage.getItem('morgendrot.nftBearerTreasury.messagingPackageId.v1')?.trim() ||
      MESSAGING_MODULES_PACKAGE_ID
    )
  } catch {
    return MESSAGING_MODULES_PACKAGE_ID
  }
}


function shortId(id: string): string {
  const t = id.trim()
  if (t.length < 14) return t
  return `${t.slice(0, 10)}…${t.slice(-4)}`
}

export function NftTokenSpendPanel(p: { nftObjectId: string; disabled?: boolean }) {
  const [mode, setMode] = useState<NftTokenSpendMode>(() => inferSpendModeForNft(p.nftObjectId))
  const [msgPkg, setMsgPkg] = useState(MESSAGING_MODULES_PACKAGE_ID)
  const [amountIota, setAmountIota] = useState('0.01')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')
  const [err, setErr] = useState('')
  const [modeNote, setModeNote] = useState('')
  const [purse, setPurse] = useState<NftGuardedPurseLocalEntry | null>(null)
  const [treasury, setTreasury] = useState<NftBearerTreasuryLocalEntry | null>(null)
  const [liveIota, setLiveIota] = useState<string | null>(null)
  const [balErr, setBalErr] = useState('')
  const [balBusy, setBalBusy] = useState(false)
  const [spendPolicyTick, setSpendPolicyTick] = useState(0)
  const [vaultHint, setVaultHint] = useState(() => nftVaultSessionHint())
  const autoDestroyRef = useRef(false)

  const syncLocal = useCallback(() => {
    restoreParkedVaultsForOwnedNfts([p.nftObjectId])
    hydrateLocalIndexFromKeycardBoundVault(p.nftObjectId)
    const inferred = inferSpendModeForNft(p.nftObjectId)
    setMode((prev) => {
      const pu0 = findNftGuardedPurseByNft(p.nftObjectId)
      const tr0 = findNftBearerTreasuryByNft(p.nftObjectId)
      // Nur auto-wechseln, wenn der andere Modus leer ist — sonst „nur Anlegen“-Falle.
      if (tr0 && !pu0 && prev !== 'bearer') {
        writeNftTokenSpendMode('bearer')
        return 'bearer'
      }
      if (pu0 && !tr0 && prev !== 'guarded') {
        writeNftTokenSpendMode('guarded')
        return 'guarded'
      }
      if (!pu0 && !tr0 && prev !== inferred) {
        writeNftTokenSpendMode(inferred)
        return inferred
      }
      return prev
    })
    setPurse(findNftGuardedPurseByNft(p.nftObjectId))
    setTreasury(findNftBearerTreasuryByNft(p.nftObjectId))
  }, [p.nftObjectId])

  // Wenn Global-Default „Guarded“ ist, aber nur Bearer existiert → Bearer nutzen (sonst nur „Anlegen“).
  const effectiveMode: NftTokenSpendMode =
    mode === 'guarded' && !purse?.purseObjectId && treasury?.treasuryObjectId
      ? 'bearer'
      : mode === 'bearer' && !treasury?.treasuryObjectId && purse?.purseObjectId
        ? 'guarded'
        : mode
  const activeId =
    (effectiveMode === 'guarded'
      ? purse?.purseObjectId
      : treasury?.treasuryObjectId)?.trim() ||
    purse?.purseObjectId ||
    treasury?.treasuryObjectId ||
    ''
  const hasVault = Boolean(activeId)
  const vaultKindLabel = effectiveMode === 'guarded' ? 'Nur ich' : 'Karteninhaber'
  const vaultPkg =
    (effectiveMode === 'guarded' ? purse?.messagingPackageId : treasury?.messagingPackageId)?.trim() ||
    msgPkg

  const refreshBalance = useCallback(async (vaultId: string) => {
    if (!vaultId.trim()) {
      setLiveIota(null)
      setBalErr('')
      return
    }
    setBalBusy(true)
    setBalErr('')
    try {
      const r = await fetchNftVaultBalance(vaultId)
      if (r.ok) {
        setLiveIota(r.iotaLabel)
        setBalErr('')
        const mist = r.mist.toString()
        const purseLocal = findNftGuardedPurseById(vaultId)
        const treasuryLocal = findNftBearerTreasuryById(vaultId)
        if (purseLocal) {
          patchNftGuardedPurseLocal(vaultId, { balanceMistHint: mist })
        } else if (treasuryLocal) {
          patchNftBearerTreasuryLocal(vaultId, { balanceMistHint: mist })
        }
        if (!autoDestroyRef.current && (purseLocal || treasuryLocal)) {
          autoDestroyRef.current = true
          try {
            const destroyed = await autoDestroyEmptyNftVault({
              vaultObjectId: vaultId,
              mist: r.mist,
              fallbackPackageId: readPkg(),
            })
            if (destroyed.status === 'destroyed') {
              setLiveIota(null)
              setInfo('Leeres Guthaben entfernt — NFT wieder frei.')
              syncLocal()
            } else if (destroyed.status === 'failed') {
              setErr(destroyed.error)
            }
          } finally {
            autoDestroyRef.current = false
          }
        }
      } else {
        setLiveIota(null)
        setBalErr(r.error)
      }
    } finally {
      setBalBusy(false)
    }
  }, [syncLocal])

  useEffect(() => {
    setMsgPkg(readPkg())
    const syncMode = () => setMode(readNftTokenSpendMode())
    const syncVault = () => setVaultHint(nftVaultSessionHint())
    syncMode()
    syncVault()
    syncLocal()
    window.addEventListener(NFT_TOKEN_SPEND_MODE_CHANGED, syncMode)
    window.addEventListener(NFT_GUARDED_PURSE_CHANGED, syncLocal)
    window.addEventListener(NFT_BEARER_TREASURY_CHANGED, syncLocal)
    const syncPolicy = () => setSpendPolicyTick((n) => n + 1)
    window.addEventListener(VAULT_PASSWORD_SESSION_CHANGED, syncVault)
    window.addEventListener(NFT_SPEND_POLICY_CHANGED, syncPolicy)
    return () => {
      window.removeEventListener(NFT_TOKEN_SPEND_MODE_CHANGED, syncMode)
      window.removeEventListener(NFT_GUARDED_PURSE_CHANGED, syncLocal)
      window.removeEventListener(NFT_BEARER_TREASURY_CHANGED, syncLocal)
      window.removeEventListener(VAULT_PASSWORD_SESSION_CHANGED, syncVault)
      window.removeEventListener(NFT_SPEND_POLICY_CHANGED, syncPolicy)
    }
  }, [syncLocal])

  useEffect(() => {
    void refreshBalance(activeId)
  }, [activeId, refreshBalance])

  const run = async (
    fn: () => Promise<{
      ok: boolean
      error?: string
      digest?: string
      purseObjectId?: string
      treasuryObjectId?: string
      oneTimeNote?: string
    }>
  ) => {
    setBusy(true)
    setErr('')
    setInfo('')
    try {
      const r = await fn()
      if (!r.ok) {
        setErr(r.error || 'Fehlgeschlagen')
        return
      }
      const created = r.purseObjectId || r.treasuryObjectId
      setInfo(
        `OK${r.digest ? ` · ${r.digest.slice(0, 12)}…` : ''}${
          created ? ` · Vault ${created.slice(0, 12)}…` : ''
        }${r.oneTimeNote ? ` · ${r.oneTimeNote}` : ''}`
      )
      syncLocal()
      setSpendPolicyTick((n) => n + 1)
      const nextId =
        created ||
        findNftGuardedPurseByNft(p.nftObjectId)?.purseObjectId ||
        findNftBearerTreasuryByNft(p.nftObjectId)?.treasuryObjectId ||
        activeId
      if (nextId) await refreshBalance(nextId)
    } finally {
      setBusy(false)
    }
  }

  void spendPolicyTick
  const spendPolicy = getNftSpendPolicy(p.nftObjectId)

  const parseMist = (): bigint | null => {
    try {
      return iotaDecimalToMist(amountIota)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ungültiger Betrag')
      return null
    }
  }

  const setModeSafe = (next: NftTokenSpendMode) => {
    const otherVault =
      next === 'guarded'
        ? findNftBearerTreasuryByNft(p.nftObjectId)
        : findNftGuardedPurseByNft(p.nftObjectId)
    const thisVault =
      next === 'guarded'
        ? findNftGuardedPurseByNft(p.nftObjectId)
        : findNftBearerTreasuryByNft(p.nftObjectId)
    setMode(next)
    writeNftTokenSpendMode(next)
    setErr('')
    setInfo('')
    if (otherVault && !thisVault) {
      setModeNote(
        next === 'bearer'
          ? 'OK: „Nur ich“-Guthaben bleibt. Im Modus Karteninhaber kannst du zusätzlich anlegen.'
          : 'OK: „Karteninhaber“-Guthaben bleibt. Im Modus Nur ich kannst du zusätzlich anlegen.'
      )
    } else if (otherVault && thisVault) {
      setModeNote('Beide Modi haben je ein Vault — getrennt. Anlegen blockiert nur beim gleichen Modus.')
    } else {
      setModeNote('')
    }
  }

  const localFallback =
    effectiveMode === 'guarded'
      ? formatLocalMistHintAsIota(purse?.balanceMistHint)
      : formatLocalMistHintAsIota(treasury?.balanceMistHint)

  useEffect(() => {
    if (effectiveMode !== mode) {
      setMode(effectiveMode)
      writeNftTokenSpendMode(effectiveMode)
    }
  }, [effectiveMode, mode])

  return (
    <div className="space-y-2 text-[11px] text-muted-foreground">
      {vaultHint ? (
        <p className="rounded border border-amber-800/40 bg-amber-950/20 px-2 py-1.5 text-[10px] text-amber-100/95">
          {vaultHint}
          {!hasVaultPasswordSession() ? (
            <span className="mt-0.5 block text-amber-50/80">
              Anlegen: Tresor entsperren. Auszahlen: Signer (Wallet-Session).
            </span>
          ) : null}
        </p>
      ) : null}
      <label className="flex flex-col gap-0.5">
        <span className="text-foreground">Auszahl-Modus</span>
        <select
          className="h-8 rounded border border-border bg-background px-2 text-[11px] text-foreground"
          value={effectiveMode}
          disabled={p.disabled || busy}
          onChange={(e) => setModeSafe(e.target.value as NftTokenSpendMode)}
        >
          <option value="guarded">{nftTokenSpendModeOptionLabel('guarded')}</option>
          <option value="bearer">{nftTokenSpendModeOptionLabel('bearer')}</option>
        </select>
      </label>
      {effectiveMode === 'bearer' && !hasVault ? (
        <p className="text-[10px] text-muted-foreground">
          Nach Anlegen erscheinen hier unten Admin-Buttons (Auszahlen sperren / Coins zurückholen).
        </p>
      ) : null}
      {modeNote ? (
        <p className="rounded border border-amber-800/30 bg-amber-950/15 px-2 py-1 text-[10px] text-amber-100/90">
          {modeNote}
        </p>
      ) : null}

      <label className="flex items-start gap-2 text-[11px] text-foreground">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={Boolean(spendPolicy?.oneTimeUse)}
          disabled={p.disabled || busy || Boolean(spendPolicy?.consumedAtMs)}
          onChange={(e) => {
            upsertNftSpendPolicy({
              nftObjectId: p.nftObjectId,
              oneTimeUse: e.target.checked,
              burnAfterSpend: e.target.checked,
              offlineHandoff: spendPolicy?.offlineHandoff,
            })
            setSpendPolicyTick((n) => n + 1)
          }}
        />
        <span>
          Einmal-Auszahlen — nach erstem Abheben gesperrt
          {spendPolicy?.consumedAtMs ? ' · verbraucht' : ''}
        </span>
      </label>

      {hasVault ? (
        <div
          className={
            effectiveMode === 'guarded'
              ? 'space-y-1.5 rounded border border-emerald-800/30 bg-emerald-950/15 px-2.5 py-2'
              : 'space-y-1.5 rounded border border-violet-800/30 bg-violet-950/15 px-2.5 py-2'
          }
        >
          <p className="text-[12px] font-medium text-foreground">
            Guthaben:{' '}
            {balBusy
              ? '…'
              : liveIota != null
                ? `${liveIota} IOTA`
                : localFallback || '—'}
            {treasury?.frozen ? ' · Auszahlen gesperrt' : ''}
          </p>
          {balErr && liveIota == null ? (
            <p className="text-[10px] text-muted-foreground">Chain: {balErr}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-foreground/90">
              {vaultKindLabel}-ID: <span className="font-mono">{shortId(activeId)}</span>
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-1.5 text-[10px]"
              disabled={busy}
              onClick={() => {
                void navigator.clipboard.writeText(activeId)
                setInfo('Vault-ID kopiert.')
              }}
            >
              Kopieren
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 px-1.5 text-[10px]"
              disabled={p.disabled || busy || balBusy}
              onClick={() => void refreshBalance(activeId)}
            >
              Aktualisieren
            </Button>
          </div>
        </div>
      ) : null}

      <label className="flex flex-col gap-0.5">
        <span>Betrag (IOTA)</span>
        <Input
          className="h-8 font-mono text-[11px]"
          value={amountIota}
          disabled={p.disabled || busy}
          onChange={(e) => setAmountIota(e.target.value)}
          placeholder="0.01"
        />
      </label>

      {!hasVault ? (
        <Button
          type="button"
          size="sm"
          className="h-8 w-full text-[11px]"
          disabled={p.disabled || busy || !msgPkg}
          onClick={() => {
            const mist = parseMist()
            if (mist == null) return
            void run(async () => {
              if (effectiveMode === 'guarded') {
                return createNftGuardedPurse({
                  messagingPackageId: vaultPkg,
                  nftObjectId: p.nftObjectId,
                  amountMist: mist,
                })
              }
              return createNftBearerTreasury({
                messagingPackageId: vaultPkg,
                nftObjectId: p.nftObjectId,
                amountMist: mist,
              })
            })
          }}
        >
          Guthaben anlegen
        </Button>
      ) : (
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground">
            Mehr Guthaben: Einzahlen. Auszahlen: Wallet → Überweisen → NFT gesichert. Bei 0 wird der leere Vault
            automatisch entfernt.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-[11px]"
            disabled={p.disabled || busy}
            onClick={() => {
              const mist = parseMist()
              if (mist == null) return
              void run(async () => {
                if (effectiveMode === 'guarded') {
                  return depositNftGuardedPurse({
                    messagingPackageId: vaultPkg,
                    purseObjectId: activeId,
                    amountMist: mist,
                  })
                }
                return depositNftBearerTreasury({
                  messagingPackageId: vaultPkg,
                  treasuryObjectId: activeId,
                  amountMist: mist,
                })
              })
            }}
          >
            Einzahlen
          </Button>
        </div>
      )}

      {effectiveMode === 'bearer' && hasVault ? (
        <div className="space-y-1.5 rounded border border-amber-800/30 bg-amber-950/10 px-2.5 py-2">
          <p className="text-[11px] font-medium text-foreground">Admin (Karteninhaber)</p>
          <p className="text-[10px] text-muted-foreground">
            On-chain als Vault-Admin: (1) Auszahlen durch den NFT-Halter sperren/erlauben, (2) gesamtes
            Restguthaben in deine Wallet holen (eine TX: einfrieren → zurückholen → auftauen). Danach bei 0
            Auto-Remove. Kein NFT-Transfer, kein Moduswechsel.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-[11px]"
              disabled={p.disabled || busy}
              onClick={() =>
                void run(() =>
                  adminSetFrozenNftBearerTreasury({
                    messagingPackageId: vaultPkg,
                    treasuryObjectId: activeId,
                    frozen: !treasury?.frozen,
                  })
                )
              }
            >
              {treasury?.frozen ? 'Auszahlen wieder erlauben' : 'Auszahlen sperren'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-[11px]"
              disabled={p.disabled || busy}
              onClick={() =>
                void run(() =>
                  adminReclaimNftBearerTreasuryToSelf({
                    messagingPackageId: vaultPkg,
                    treasuryObjectId: activeId,
                  })
                )
              }
            >
              Coins zur Admin-Wallet holen
            </Button>
          </div>
        </div>
      ) : null}

      {err ? <p className="text-destructive">{err}</p> : null}
      {info ? <p className="whitespace-pre-wrap break-all text-foreground">{info}</p> : null}
    </div>
  )
}
