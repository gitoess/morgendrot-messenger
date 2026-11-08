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
import { getNftKeycard } from '@/frontend/lib/nft-keycard-local-store'
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
  const [mode, setMode] = useState<NftTokenSpendMode>('guarded')
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

  const syncLocal = useCallback(() => {
    const pu = findNftGuardedPurseByNft(p.nftObjectId)
    const tr = findNftBearerTreasuryByNft(p.nftObjectId)
    setPurse(pu)
    setTreasury(tr)
    const fromVault = pu?.displayLabel || tr?.displayLabel || ''
    const fromCard = getNftKeycard(p.nftObjectId)?.label || ''
    setDisplayLabel((prev) => prev || fromVault || fromCard || '')
  }, [p.nftObjectId])

  const activeId =
    mode === 'guarded'
      ? purse?.purseObjectId || manualId.trim()
      : treasury?.treasuryObjectId || manualId.trim()
  const hasVault = Boolean(activeId)
  const vaultKindLabel = mode === 'guarded' ? 'Guarded-Purse' : 'Bearer-Treasury'
  const vaultPkg =
    (mode === 'guarded' ? purse?.messagingPackageId : treasury?.messagingPackageId)?.trim() ||
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
    syncMode()
    syncLocal()
    window.addEventListener(NFT_TOKEN_SPEND_MODE_CHANGED, syncMode)
    window.addEventListener(NFT_GUARDED_PURSE_CHANGED, syncLocal)
    window.addEventListener(NFT_BEARER_TREASURY_CHANGED, syncLocal)
    return () => {
      window.removeEventListener(NFT_TOKEN_SPEND_MODE_CHANGED, syncMode)
      window.removeEventListener(NFT_GUARDED_PURSE_CHANGED, syncLocal)
      window.removeEventListener(NFT_BEARER_TREASURY_CHANGED, syncLocal)
    }
  }, [syncLocal])

  useEffect(() => {
    void refreshBalance(activeId)
  }, [activeId, refreshBalance])

  const run = async (
    fn: () => Promise<{ ok: boolean; error?: string; digest?: string; purseObjectId?: string; treasuryObjectId?: string }>
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
        }`
      )
      syncLocal()
      const nextId =
        created ||
        (mode === 'guarded'
          ? findNftGuardedPurseByNft(p.nftObjectId)?.purseObjectId
          : findNftBearerTreasuryByNft(p.nftObjectId)?.treasuryObjectId) ||
        activeId
      if (nextId) await refreshBalance(nextId)
    } finally {
      setBusy(false)
    }
  }

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
        next === 'guarded'
          ? 'Hinweis: Im Bearer-Modus existiert schon eine Treasury — das ist ein anderes Objekt.'
          : 'Hinweis: Im Guarded-Modus existiert schon eine Purse — das ist ein anderes Objekt.'
      )
    } else if (otherVault && thisVault) {
      setModeNote('Beide Modi haben ein Guthaben-Objekt — getrennt voneinander.')
    } else {
      setModeNote('')
    }
  }

  const localFallback =
    mode === 'guarded'
      ? formatLocalMistHintAsIota(purse?.balanceMistHint)
      : formatLocalMistHintAsIota(treasury?.balanceMistHint)

  return (
    <div className="space-y-2 text-[11px] text-muted-foreground">
      <p>
        Coins hinter die gewählte Karte legen. Den <span className="text-foreground">Empfänger brauchst du
        erst beim Auszahlen</span> — Wallet für Coins, nicht das NFT.
      </p>

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
              if (mode === 'guarded' && purse) {
                patchNftGuardedPurseLocal(purse.purseObjectId, { displayLabel: v })
              } else if (mode === 'bearer' && treasury) {
                patchNftBearerTreasuryLocal(treasury.treasuryObjectId, { displayLabel: v })
              }
            }}
          />
        </label>
      </div>

      <label className="flex flex-col gap-0.5">
        <span className="text-foreground">Wer darf auszahlen?</span>
        <select
          className="h-8 rounded border border-border bg-background px-2 text-[11px] text-foreground"
          value={mode}
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

      {hasVault ? (
        <div
          className={
            mode === 'guarded'
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
              if (mode === 'guarded') {
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
                if (mode === 'guarded') {
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
            disabled={p.disabled || busy}
            onClick={() => setPayOpen((v) => !v)}
          >
            {payOpen ? 'Auszahlen schließen' : 'Auszahlen…'}
          </Button>
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
                if (mode === 'guarded') {
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
        <summary className="cursor-pointer text-[10px] text-muted-foreground">Erweitert</summary>
        <div className="mt-2 space-y-2">
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
            <span>
              {vaultKindLabel}-Object-ID manuell (nur wenn Auto-Erkennung fehlt)
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
                if (mode === 'guarded') {
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
          {mode === 'guarded' && hasVault ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-[10px]"
              disabled={p.disabled || busy}
              onClick={() =>
                void run(() =>
                  destroyEmptyNftGuardedPurse({
                    messagingPackageId: vaultPkg,
                    purseObjectId: activeId,
                  })
                )
              }
            >
              Leeres Guthaben löschen
            </Button>
          ) : null}
          {mode === 'bearer' && hasVault ? (
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
      {info ? <p className="text-foreground">{info}</p> : null}
    </div>
  )
}
