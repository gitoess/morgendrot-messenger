'use client'

/**
 * Gesichertes Guthaben — Live-Balance, klare Modi, Vault-ID sichtbar, IDs unter Erweitert.
 */

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MESSAGING_MODULES_PACKAGE_ID } from '@/frontend/lib/messaging-modules-package'
import {
  adminReclaimNftBearerTreasury,
  adminSetFrozenNftBearerTreasury,
  createNftBearerTreasury,
  depositNftBearerTreasury,
  destroyEmptyNftBearerTreasury,
  withdrawNftBearerTreasury,
} from '@/frontend/lib/nft-bearer-treasury-actions'
import {
  findNftBearerTreasuryByNft,
  NFT_BEARER_TREASURY_CHANGED,
  patchNftBearerTreasuryLocal,
  upsertNftBearerTreasuryLocal,
  type NftBearerTreasuryLocalEntry,
} from '@/frontend/lib/nft-bearer-treasury-local-store'
import {
  createNftGuardedPurse,
  depositNftGuardedPurse,
  destroyEmptyNftGuardedPurse,
  spendNftGuardedPurse,
} from '@/frontend/lib/nft-guarded-purse-actions'
import {
  findNftGuardedPurseByNft,
  iotaDecimalToMist,
  NFT_GUARDED_PURSE_CHANGED,
  patchNftGuardedPurseLocal,
  upsertNftGuardedPurseLocal,
  type NftGuardedPurseLocalEntry,
} from '@/frontend/lib/nft-guarded-purse-local-store'
import {
  bindVaultToNftKeycard,
  getNftKeycard,
} from '@/frontend/lib/nft-keycard-local-store'
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
import {
  applyNftVaultHandoff,
  buildNftVaultHandoffFromLocal,
  hydrateLocalIndexFromKeycardBoundVault,
} from '@/frontend/lib/nft-vault-handoff'
import {
  encodeNftVaultHandoffSigned,
  nftVaultHandoffToQrDataUrl,
  parseAnyNftVaultHandoff,
  preferOfflineHandoffText,
} from '@/frontend/lib/nft-vault-handoff-offline'
import {
  getNftSpendPolicy,
  isNftSpendCapabilityConsumed,
  NFT_SPEND_POLICY_CHANGED,
  nftSpendPolicyBadgeParts,
  upsertNftSpendPolicy,
} from '@/frontend/lib/nft-spend-policy-local-store'
import { recoverNftVaultFromDigest } from '@/frontend/lib/nft-vault-recover-from-tx'
import { syncDiscoveredVaultsIntoLocalIndex } from '@/frontend/lib/nft-vault-discover-onchain'
import { scheduleNftVaultIndexPersist } from '@/frontend/lib/nft-vault-index-vault'
import { restoreParkedVaultsForOwnedNfts } from '@/frontend/lib/nft-vault-local-clear'
import { inferSpendModeForNft } from '@/frontend/lib/nft-secured-spend-options'
import { copyTextSafe } from '@/frontend/lib/copy-text-safe'
import { nftVaultSessionHint } from '@/frontend/lib/nft-vault-session-gate'
import { requestNftVaultBalanceRefresh } from '@/frontend/components/dashboard-nft-secured-balances'
import {
  hasVaultPasswordSession,
  VAULT_PASSWORD_SESSION_CHANGED,
} from '@/frontend/lib/vault-password-session'

const LS_PKG = 'morgendrot.nftTokenSpend.messagingPackageId.v1'
const API_BASE =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '')) || ''

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

function writePkg(v: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_PKG, v.trim())
  } catch {
    /* ignore */
  }
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

function shortId(id: string): string {
  const t = id.trim()
  if (t.length < 14) return t
  return `${t.slice(0, 10)}…${t.slice(-4)}`
}

export function NftTokenSpendPanel(p: { nftObjectId: string; disabled?: boolean }) {
  const [mode, setMode] = useState<NftTokenSpendMode>(() => inferSpendModeForNft(p.nftObjectId))
  const [msgPkg, setMsgPkg] = useState(MESSAGING_MODULES_PACKAGE_ID)
  const [editPkg, setEditPkg] = useState(false)
  const [amountIota, setAmountIota] = useState('0.01')
  const [recipient, setRecipient] = useState('')
  const [payOpen, setPayOpen] = useState(false)
  const [manualId, setManualId] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')
  const [err, setErr] = useState('')
  const [modeNote, setModeNote] = useState('')
  const [purse, setPurse] = useState<NftGuardedPurseLocalEntry | null>(null)
  const [treasury, setTreasury] = useState<NftBearerTreasuryLocalEntry | null>(null)
  const [liveIota, setLiveIota] = useState<string | null>(null)
  const [balErr, setBalErr] = useState('')
  const [balBusy, setBalBusy] = useState(false)
  const [displayLabel, setDisplayLabel] = useState('')
  const [digestEdit, setDigestEdit] = useState('')
  const [handoffIn, setHandoffIn] = useState('')
  const [handoffQr, setHandoffQr] = useState('')
  const [spendPolicyTick, setSpendPolicyTick] = useState(0)
  const [vaultHint, setVaultHint] = useState(() => nftVaultSessionHint())

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
    const pu = findNftGuardedPurseByNft(p.nftObjectId)
    const tr = findNftBearerTreasuryByNft(p.nftObjectId)
    setPurse(pu)
    setTreasury(tr)
    const fromVault = pu?.displayLabel || tr?.displayLabel || ''
    const fromCard = getNftKeycard(p.nftObjectId)?.label || ''
    setDisplayLabel(fromVault || fromCard || '')
    const dig =
      pu?.createDigest ||
      tr?.createDigest ||
      getNftKeycard(p.nftObjectId)?.boundVault?.createDigest ||
      ''
    setDigestEdit(dig)
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
    manualId.trim() ||
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
      } else {
        setLiveIota(null)
        setBalErr(r.error)
      }
    } finally {
      setBalBusy(false)
    }
  }, [])

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

  useEffect(() => {
    if (hasVault) setPayOpen(true)
  }, [p.nftObjectId, hasVault])

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
    setPayOpen(false)
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

  const createDigest =
    (effectiveMode === 'guarded' ? purse?.createDigest : treasury?.createDigest) ||
    getNftKeycard(p.nftObjectId)?.boundVault?.createDigest ||
    ''

  useEffect(() => {
    if (effectiveMode !== mode) {
      setMode(effectiveMode)
      writeNftTokenSpendMode(effectiveMode)
    }
  }, [effectiveMode, mode])

  const persistDigestMeta = (digest: string) => {
    const d = digest.trim()
    if (!d || !activeId) return
    if (effectiveMode === 'guarded') {
      patchNftGuardedPurseLocal(activeId, { createDigest: d })
      bindVaultToNftKeycard({
        objectId: p.nftObjectId,
        vault: {
          kind: 'guarded',
          vaultObjectId: activeId,
          createDigest: d,
          messagingPackageId: vaultPkg,
        },
      })
    } else {
      patchNftBearerTreasuryLocal(activeId, { createDigest: d })
      bindVaultToNftKeycard({
        objectId: p.nftObjectId,
        vault: {
          kind: 'bearer',
          vaultObjectId: activeId,
          createDigest: d,
          messagingPackageId: vaultPkg,
        },
      })
    }
    scheduleNftVaultIndexPersist()
    syncLocal()
    setInfo('Digest im Index + Schlüsselkarte / Tresor-Sidecar gemerkt.')
  }

  return (
    <div className="space-y-2 text-[11px] text-muted-foreground">
      {vaultHint ? (
        <p className="rounded border border-amber-800/40 bg-amber-950/20 px-2 py-1.5 text-[10px] text-amber-100/95">
          {vaultHint}
          {!hasVaultPasswordSession() ? (
            <span className="mt-0.5 block text-amber-50/80">
              Anlegen/Index speichern: Tresor entsperren. Auszahlen: Signer (Wallet-Session).
            </span>
          ) : null}
        </p>
      ) : null}
      {(() => {
        const badges = nftSpendPolicyBadgeParts(p.nftObjectId)
        if (!badges.length && !isNftSpendCapabilityConsumed(p.nftObjectId)) return null
        return (
          <p className="rounded border border-sky-800/30 bg-sky-950/15 px-2 py-1.5 text-[10px] text-sky-100/95">
            Modi: {badges.join(' · ') || 'One-Time · verbraucht'}
            {isNftSpendCapabilityConsumed(p.nftObjectId)
              ? ' — weitere Auszahlungen gesperrt.'
              : spendPolicy?.oneTimeUse
                ? ' — nach erstem Spend verbraucht (+ Burn).'
                : ''}
          </p>
        )
      })()}

      {!hasVault ? (
        <div className="space-y-1.5 rounded border border-border/50 bg-background/40 px-2 py-2">
          <p className="text-[10px] font-medium text-foreground">Index empfangen</p>
          <p className="text-[10px] text-muted-foreground">Bundle einfügen oder Vaults laden.</p>
          <div className="flex gap-1.5">
            <Input
              className="h-7 flex-1 font-mono text-[10px]"
              value={handoffIn}
              disabled={p.disabled || busy}
              onChange={(e) => setHandoffIn(e.target.value)}
              placeholder="Ctrl+V: Bundle oder MORG_NFT_V1C:…"
              spellCheck={false}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 shrink-0 text-[10px]"
              disabled={p.disabled || busy || !handoffIn.trim()}
              onClick={() => {
                const pack = parseAnyNftVaultHandoff(handoffIn)
                if (!pack) {
                  setErr('Ungültiger Index-Text.')
                  return
                }
                if (pack.nftObjectId !== p.nftObjectId.trim().toLowerCase()) {
                  setErr(`Gehört zu NFT ${pack.nftObjectId.slice(0, 10)}… — andere Karte wählen.`)
                  return
                }
                const r = applyNftVaultHandoff(pack)
                setHandoffIn('')
                setInfo(r.note)
                syncLocal()
                void refreshBalance(pack.vaultObjectId)
              }}
            >
              Übernehmen
            </Button>
          </div>
        </div>
      ) : null}

      <div className="rounded border border-border/60 bg-background/40 px-2 py-1.5 space-y-1">
        <p className="text-[10px] text-foreground/90">
          Gebunden an NFT:{' '}
          <span className="font-mono">{shortId(p.nftObjectId)}</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-1 h-6 px-1.5 text-[10px]"
            disabled={busy}
            onClick={() => {
              void navigator.clipboard.writeText(p.nftObjectId)
              setInfo('NFT-Object-ID kopiert.')
            }}
          >
            Kopieren
          </Button>
        </p>
        <label className="flex flex-col gap-0.5">
          <span>Anzeigename (optional, nur lokal)</span>
          <Input
            className="h-7 text-[11px]"
            value={displayLabel}
            disabled={p.disabled || busy}
            placeholder="z. B. Team-Karte Nord"
            onChange={(e) => setDisplayLabel(e.target.value)}
            onBlur={() => {
              const v = displayLabel.trim()
              if (effectiveMode === 'guarded' && purse) {
                patchNftGuardedPurseLocal(purse.purseObjectId, { displayLabel: v })
              } else if (effectiveMode === 'bearer' && treasury) {
                patchNftBearerTreasuryLocal(treasury.treasuryObjectId, { displayLabel: v })
              }
            }}
          />
        </label>
      </div>

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
      {modeNote ? (
        <p className="rounded border border-amber-800/30 bg-amber-950/15 px-2 py-1 text-[10px] text-amber-100/90">
          {modeNote}
        </p>
      ) : null}

      <details className="rounded border border-border/50 bg-background/40 px-2 py-2">
        <summary className="cursor-pointer text-[10px] font-medium text-foreground">Optionen</summary>
        <div className="mt-1.5 space-y-1.5">
          <label className="flex items-start gap-2 text-[10px] text-foreground">
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
              One-Time — nach erstem Spend ungültig
              {spendPolicy?.consumedAtMs ? ' · verbraucht' : ''}
            </span>
          </label>
          <label className="flex items-start gap-2 text-[10px] text-foreground">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={Boolean(spendPolicy?.offlineHandoff)}
              disabled={p.disabled || busy}
              onChange={(e) => {
                upsertNftSpendPolicy({
                  nftObjectId: p.nftObjectId,
                  oneTimeUse: spendPolicy?.oneTimeUse,
                  burnAfterSpend: spendPolicy?.burnAfterSpend,
                  offlineHandoff: e.target.checked,
                })
                setSpendPolicyTick((n) => n + 1)
              }}
            />
            <span>Offline-Weitergabe (Index-Bundle beim NFT-Senden)</span>
          </label>
        </div>
      </details>

      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 text-[11px]"
          disabled={p.disabled || busy}
          title="Scannt deine Adresse on-chain und schreibt gefundene Purses/Treasuries in den lokalen Index"
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
                syncLocal()
                requestNftVaultBalanceRefresh()
                setInfo(
                  r.guarded + r.bearer > 0
                    ? `Vaults geladen: ${r.guarded + r.bearer} neu.`
                    : 'Keine neuen Vaults on-chain.'
                )
                if (activeId) void refreshBalance(activeId)
              } finally {
                setBusy(false)
              }
            })()
          }}
        >
          Vaults laden
        </Button>
      </div>

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
            {treasury?.frozen ? ' · EINGEFROREN' : ''}
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
          <p className="text-[10px] text-muted-foreground">
            Lose Wallet-Coins außerhalb bleiben ungeschützt.
          </p>
          {createDigest ? (
            <p className="text-[10px] text-muted-foreground">
              Create-Digest:{' '}
              <button
                type="button"
                className="font-mono text-foreground underline underline-offset-2"
                onClick={() => {
                  void (async () => {
                    const r = await copyTextSafe(createDigest)
                    setInfo(r.ok ? 'Digest in Zwischenablage.' : r.error)
                  })()
                }}
              >
                {shortId(createDigest)}
              </button>
            </p>
          ) : null}
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
            Pro NFT und Modus nur ein Vault — mehr Guthaben nur per Einzahlen (kein zweites Anlegen).
          </p>
          <div className="flex flex-wrap gap-1.5">
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
            <Button
              type="button"
              size="sm"
              className="h-8 text-[11px]"
              disabled={
                p.disabled || busy || isNftSpendCapabilityConsumed(p.nftObjectId)
              }
              title={
                isNftSpendCapabilityConsumed(p.nftObjectId)
                  ? 'One-Time bereits verbraucht'
                  : undefined
              }
              onClick={() => setPayOpen((v) => !v)}
            >
              {payOpen ? 'Auszahlen schließen' : 'Auszahlen…'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-[11px] text-destructive border-destructive/40"
              disabled={p.disabled || busy}
              title="Nur bei Balance 0 — Vault-Objekt on-chain zerstören und lokalen Index räumen"
              onClick={() => {
                if (
                  !window.confirm(
                    'Leeres Guthaben löschen?\n\nNur möglich bei Balance 0. Zerstört das Purse/Treasury on-chain (destroy_empty) und entfernt den lokalen Index an dieser Karte. Coins vorher auszahlen. NFT bleibt bestehen.'
                  )
                ) {
                  return
                }
                void run(() =>
                  effectiveMode === 'guarded'
                    ? destroyEmptyNftGuardedPurse({
                        messagingPackageId: vaultPkg,
                        purseObjectId: activeId,
                      })
                    : destroyEmptyNftBearerTreasury({
                        messagingPackageId: vaultPkg,
                        treasuryObjectId: activeId,
                      })
                )
              }}
            >
              Leeres Guthaben löschen
            </Button>
          </div>
        </div>
      )}

      {hasVault && payOpen ? (
        <div className="space-y-2 rounded border border-border/60 bg-background/50 px-2 py-2">
          <p className="text-[10px] text-foreground/90">
            Wohin sollen die Coins? (Adresse — später änderbar, nicht die NFT-Object-ID)
          </p>
          <div className="flex gap-1.5">
            <Input
              className="h-8 flex-1 font-mono text-[11px]"
              value={recipient}
              disabled={p.disabled || busy}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x… Empfänger-Wallet"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 shrink-0 text-[10px]"
              disabled={p.disabled || busy}
              onClick={() => {
                void (async () => {
                  const me = await fetchMyAddress()
                  if (!me) {
                    setErr('Eigene Adresse nicht geladen — manuell eintragen.')
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
          <Button
            type="button"
            size="sm"
            className="h-8 w-full text-[11px]"
            disabled={p.disabled || busy || !recipient.trim()}
            onClick={() => {
              const mist = parseMist()
              if (mist == null) return
              void run(async () => {
                if (effectiveMode === 'guarded') {
                  return spendNftGuardedPurse({
                    messagingPackageId: vaultPkg,
                    purseObjectId: activeId,
                    nftObjectId: p.nftObjectId,
                    amountMist: mist,
                    recipientAddress: recipient,
                  })
                }
                return withdrawNftBearerTreasury({
                  messagingPackageId: vaultPkg,
                  treasuryObjectId: activeId,
                  nftObjectId: p.nftObjectId,
                  amountMist: mist,
                  recipientAddress: recipient,
                })
              })
            }}
          >
            Jetzt auszahlen
          </Button>
        </div>
      ) : null}

      <details className="rounded border border-border/40 px-2 py-1">
        <summary className="cursor-pointer text-[10px] text-muted-foreground">
          Erweitert / Notfall · Digest · manuelle ID · Index neu senden
        </summary>
        <div className="mt-2 space-y-2">
          <p className="text-[10px] text-muted-foreground">
            Nur wenn der Index fehlt: Digest nachtragen, manuelle ID oder Bundle einfügen.
          </p>
          <div className="space-y-1.5 rounded border border-amber-800/25 bg-amber-950/10 px-2 py-2">
            <p className="text-[10px] font-medium text-foreground">Notfall · Index einfügen / neu senden</p>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 text-[11px]"
                disabled={busy || !hasVault}
                onClick={() => {
                  void (async () => {
                    const pack = buildNftVaultHandoffFromLocal(p.nftObjectId)
                    if (!pack) {
                      setErr('Kein Vault — zuerst Guthaben anlegen.')
                      return
                    }
                    const { bundle } = preferOfflineHandoffText(pack)
                    const r = await copyTextSafe(bundle)
                    if (!r.ok) {
                      setErr(r.error)
                      setInfo(`Zum manuellen Kopieren:\n${bundle}`)
                      return
                    }
                    setErr('')
                    setInfo(
                      'Bundle (NFT+Vault) in Zwischenablage — Empfänger: unten einfügen → Übernehmen oder Chat/Mesh.'
                    )
                  })()
                }}
              >
                Bundle neu kopieren
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-[11px]"
                disabled={busy || !hasVault}
                onClick={() => {
                  void (async () => {
                    const pack = buildNftVaultHandoffFromLocal(p.nftObjectId)
                    if (!pack) {
                      setErr('Kein Vault — zuerst Guthaben anlegen.')
                      return
                    }
                    const { compact } = preferOfflineHandoffText(pack)
                    try {
                      const url = await nftVaultHandoffToQrDataUrl(compact)
                      setHandoffQr(url)
                      setErr('')
                      setInfo('QR (Compact = NFT+Vault). Empfänger scannt und fügt Text ein.')
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : String(e))
                    }
                  })()
                }}
              >
                QR zeigen
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-[11px]"
                disabled={busy || !hasVault}
                onClick={() => {
                  void (async () => {
                    const pack = buildNftVaultHandoffFromLocal(p.nftObjectId)
                    if (!pack) {
                      setErr('Kein Vault — zuerst Guthaben anlegen.')
                      return
                    }
                    const signed = await encodeNftVaultHandoffSigned(pack)
                    if (!signed.ok) {
                      setErr(signed.error)
                      return
                    }
                    const r = await copyTextSafe(signed.text)
                    if (!r.ok) {
                      setErr(r.error)
                      setInfo(`Zum manuellen Kopieren:\n${signed.text}`)
                      return
                    }
                    setErr('')
                    setInfo('Signierter Index kopiert (Issuer = Session-Wallet).')
                  })()
                }}
              >
                Signiert kopieren
              </Button>
            </div>
            {handoffQr ? (
              <img
                src={handoffQr}
                alt="Vault-Index QR"
                className="mx-auto h-40 w-40 rounded border border-border bg-white p-1"
              />
            ) : null}
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground">
                Empfangen: Bundle / Compact / V1 hier einfügen → Übernehmen
              </span>
              <div className="flex gap-1.5">
                <Input
                  className="h-7 flex-1 font-mono text-[10px]"
                  value={handoffIn}
                  disabled={p.disabled || busy}
                  onChange={(e) => setHandoffIn(e.target.value)}
                  placeholder="Ctrl+V: Bundle oder MORG_NFT_V1C:…"
                  spellCheck={false}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 text-[10px]"
                  disabled={p.disabled || busy || !handoffIn.trim()}
                  onClick={() => {
                    const pack = parseAnyNftVaultHandoff(handoffIn)
                    if (!pack) {
                      setErr('Ungültiger Index-Text.')
                      return
                    }
                    if (pack.nftObjectId !== p.nftObjectId.trim().toLowerCase()) {
                      setErr(
                        `Gehört zu NFT ${pack.nftObjectId.slice(0, 10)}… — andere Karte wählen.`
                      )
                      return
                    }
                    const r = applyNftVaultHandoff(pack)
                    setHandoffIn('')
                    setHandoffQr('')
                    setInfo(r.note)
                    syncLocal()
                    void refreshBalance(pack.vaultObjectId)
                  }}
                >
                  Übernehmen
                </Button>
              </div>
            </label>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-foreground/90">
              Notfall · Create-Digest nachtragen (wenn Anlegen den Index nicht gesetzt hat)
            </p>
            <div className="flex gap-1.5">
              <Input
                className="h-7 flex-1 font-mono text-[10px]"
                value={digestEdit}
                disabled={p.disabled || busy}
                onChange={(e) => setDigestEdit(e.target.value)}
                placeholder="TX-Digest"
                spellCheck={false}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 shrink-0 text-[10px]"
                disabled={p.disabled || busy || !digestEdit.trim()}
                onClick={() => {
                  if (hasVault) {
                    persistDigestMeta(digestEdit)
                    return
                  }
                  void (async () => {
                    setBusy(true)
                    setErr('')
                    try {
                      const r = await recoverNftVaultFromDigest(digestEdit.trim())
                      if (!r.ok) {
                        setErr(r.error)
                        return
                      }
                      setInfo(
                        r.vault.kind === 'bearer'
                          ? `Bearer nachgetragen · ${r.vault.treasuryObjectId.slice(0, 12)}…`
                          : `Guarded nachgetragen · ${r.vault.purseObjectId.slice(0, 12)}…`
                      )
                      syncLocal()
                      const id =
                        r.vault.kind === 'bearer' ? r.vault.treasuryObjectId : r.vault.purseObjectId
                      await refreshBalance(id)
                    } finally {
                      setBusy(false)
                    }
                  })()
                }}
              >
                Speichern
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-foreground/90">
              Messaging-Module-Package (Guthaben / Zeitkapsel / Seal) — nicht der Chat-Stamm
            </p>
            {!editPkg ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[10px]">bereits gesetzt · {shortId(msgPkg)}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5 text-[10px]"
                  disabled={p.disabled || busy}
                  onClick={() => setEditPkg(true)}
                >
                  Ändern
                </Button>
              </div>
            ) : (
              <Input
                className="h-7 font-mono text-[10px]"
                value={msgPkg}
                disabled={p.disabled || busy}
                onChange={(e) => {
                  setMsgPkg(e.target.value)
                  writePkg(e.target.value)
                }}
                onBlur={() => setEditPkg(false)}
              />
            )}
          </div>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-foreground/90">
              Notfall · {vaultKindLabel}-Object-ID manuell
            </span>
            <Input
              className="h-7 font-mono text-[10px]"
              value={manualId}
              disabled={p.disabled || busy}
              onChange={(e) => setManualId(e.target.value)}
              placeholder="0x…"
            />
          </label>
          {manualId.trim() ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-[10px]"
              disabled={busy}
              onClick={() => {
                if (effectiveMode === 'guarded') {
                  upsertNftGuardedPurseLocal({
                    purseObjectId: manualId,
                    nftObjectId: p.nftObjectId,
                    owner: '0x' + '00'.repeat(32),
                    balanceMistHint: '?',
                    status: 'active',
                  })
                } else {
                  upsertNftBearerTreasuryLocal({
                    treasuryObjectId: manualId,
                    nftObjectId: p.nftObjectId,
                    admin: '0x' + '00'.repeat(32),
                    balanceMistHint: '?',
                    frozen: false,
                    status: 'active',
                  })
                }
                syncLocal()
                setInfo('Lokaler Vault-Index gesetzt.')
                void refreshBalance(manualId.trim())
              }}
            >
              Lokal merken
            </Button>
          ) : null}
          {hasVault ? (
            <p className="text-[10px] text-muted-foreground">
              „Leeres Guthaben löschen“ (oben): nur bei Balance 0 — zerstört das Vault-Objekt on-chain und
              räumt den lokalen Index. Coins vorher auszahlen.
            </p>
          ) : null}
          {effectiveMode === 'bearer' && hasVault ? (
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-[10px]"
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
                {treasury?.frozen ? 'Auftauen' : 'Einfrieren'} (Admin)
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-[10px]"
                disabled={p.disabled || busy}
                onClick={() =>
                  void run(() =>
                    adminReclaimNftBearerTreasury({
                      messagingPackageId: vaultPkg,
                      treasuryObjectId: activeId,
                    })
                  )
                }
              >
                Admin zurückholen
              </Button>
            </div>
          ) : null}
        </div>
      </details>

      {err ? <p className="text-destructive">{err}</p> : null}
      {info ? <p className="whitespace-pre-wrap break-all text-foreground">{info}</p> : null}
    </div>
  )
}
