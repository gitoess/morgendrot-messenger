'use client'

import { useEffect, useState } from 'react'
import { generatePassphraseMessageSharePassphrase } from '@/frontend/lib/passphrase-message-crypto'
import {
  clearDefaultPassphraseMessagePassphrase,
  getDefaultPassphraseMessagePassphrase,
  PASSPHRASE_MESSAGE_VAULT_CHANGED_EVENT,
  readPassphraseNftKeycardBindObjectId,
  readPassphraseNftKeycardBindSlotId,
  readPassphraseNftDualWalletGateEnabled,
  readPassphraseNftRequiredWallets,
  readPassphraseNftStrongGateEnabled,
  readPassphraseProtectEnabled,
  readPassphraseRememberOnDeviceEnabled,
  readPassphraseReuseEnabled,
  readPassphraseZeitkapselModeEnabled,
  readZeitkapselLastNftObjectId,
  requestOpenZeitkapselLease,
  setDefaultPassphraseMessagePassphrase,
  writePassphraseNftDualWalletGateEnabled,
  writePassphraseNftKeycardBindObjectId,
  writePassphraseNftKeycardBindSlotId,
  writePassphraseNftRequiredWallets,
  writePassphraseNftStrongGateEnabled,
  writePassphraseProtectEnabled,
  writePassphraseRememberOnDeviceEnabled,
  writePassphraseReuseEnabled,
  writePassphraseZeitkapselModeEnabled,
  writeZeitkapselLastNftObjectId,
} from '@/frontend/lib/passphrase-message-local-store'
import { NftKeycardImagePreview } from '@/frontend/components/nft-keycard-image-preview'
import {
  listNftKeycards,
  normalizeNftObjectIdInput,
  NFT_KEYCARD_VAULT_CHANGED_EVENT,
} from '@/frontend/lib/nft-keycard-local-store'
import { NFT_ACTIVITY_CHANGED_EVENT } from '@/frontend/lib/nft-activity-local-log'
import {
  buildSecuredSpendOptions,
  type SecuredSpendOption,
} from '@/frontend/lib/nft-secured-spend-options'
import { MESSENGER_INBOX_FORCE_REFRESH_EVENT } from '@/frontend/lib/messenger-inbox-force-refresh'
import { getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import { PRIVACY_SOFT_LOCK_CHANGED_EVENT } from '@/frontend/lib/privacy-soft-lock'
import { hasVaultPasswordSession } from '@/frontend/lib/vault-password-session'

function shortOid(id: string): string {
  const t = id.trim()
  if (t.length < 14) return t
  return `${t.slice(0, 10)}…${t.slice(-4)}`
}

/**
 * Composer: zwei getrennte Modi (nicht ECDH):
 * - NFT-Leserecht → MORG_NFTGATE_V1
 * - Passphrase → MORG_PWMSG (+ optional NFT-Besitz zusätzlich)
 * Seal/Key-Broker (P4b) und Pubkey-Wrap: UI aus — Boss-Broker später (IDEEN-BACKLOG).
 */
export function PassphraseProtectComposerToggle(p: {
  encrypted: boolean
  onEncryptedChange?: (encrypted: boolean) => void
  onRequestVaultSession?: () => void
}) {
  const [on, setOn] = useState(false)
  const [zeitkapsel, setZeitkapsel] = useState(false)
  const [reuse, setReuse] = useState(() => readPassphraseReuseEnabled())
  const [sharedPass, setSharedPass] = useState('')
  const [bindOid, setBindOid] = useState('')
  const [bindSlot, setBindSlot] = useState('default')
  const [strongGate, setStrongGate] = useState(false)
  const [dualWallet, setDualWallet] = useState(false)
  const [requiredWalletsText, setRequiredWalletsText] = useState('')
  const [rememberOnDevice, setRememberOnDevice] = useState(true)
  const [vaultSessionOpen, setVaultSessionOpen] = useState(() => hasVaultPasswordSession())
  const [cards, setCards] = useState<{ objectId: string; label?: string; slotIds: string[] }[]>([])
  const [nftOptions, setNftOptions] = useState<SecuredSpendOption[]>([])
  const [lastZeitkapselNft, setLastZeitkapselNft] = useState<string | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [manualOidDraft, setManualOidDraft] = useState('')
  const [manualOidOpen, setManualOidOpen] = useState(false)

  useEffect(() => {
    const sync = () => {
      setOn(readPassphraseProtectEnabled())
      setZeitkapsel(readPassphraseZeitkapselModeEnabled())
      setReuse(readPassphraseReuseEnabled())
      setRememberOnDevice(readPassphraseRememberOnDeviceEnabled())
      setVaultSessionOpen(hasVaultPasswordSession())
      setSharedPass(getDefaultPassphraseMessagePassphrase() ?? '')
      const bound = readPassphraseNftKeycardBindObjectId() ?? ''
      setBindOid(bound)
      if (bound) setManualOidDraft(bound)
      setBindSlot(readPassphraseNftKeycardBindSlotId())
      setStrongGate(readPassphraseNftStrongGateEnabled())
      setDualWallet(readPassphraseNftDualWalletGateEnabled())
      setRequiredWalletsText(readPassphraseNftRequiredWallets().join('\n'))
      setLastZeitkapselNft(readZeitkapselLastNftObjectId())
      setCards(
        listNftKeycards().map(({ objectId, entry }) => ({
          objectId,
          label: entry.label,
          slotIds: entry.slots.map((s) => s.id),
        }))
      )
      setNftOptions(buildSecuredSpendOptions())
    }
    sync()
    window.addEventListener(PASSPHRASE_MESSAGE_VAULT_CHANGED_EVENT, sync)
    window.addEventListener(PRIVACY_SOFT_LOCK_CHANGED_EVENT, sync)
    window.addEventListener(NFT_KEYCARD_VAULT_CHANGED_EVENT, sync)
    window.addEventListener(NFT_ACTIVITY_CHANGED_EVENT, sync)
    window.addEventListener(MESSENGER_INBOX_FORCE_REFRESH_EVENT, sync)
    return () => {
      window.removeEventListener(PASSPHRASE_MESSAGE_VAULT_CHANGED_EVENT, sync)
      window.removeEventListener(PRIVACY_SOFT_LOCK_CHANGED_EVENT, sync)
      window.removeEventListener(NFT_KEYCARD_VAULT_CHANGED_EVENT, sync)
      window.removeEventListener(NFT_ACTIVITY_CHANGED_EVENT, sync)
      window.removeEventListener(MESSENGER_INBOX_FORCE_REFRESH_EVENT, sync)
    }
  }, [])

  useEffect(() => {
    if (p.encrypted && on) {
      setOn(false)
      writePassphraseProtectEnabled(false)
    }
    if (p.encrypted && zeitkapsel) {
      setZeitkapsel(false)
      writePassphraseZeitkapselModeEnabled(false)
    }
  }, [p.encrypted, on, zeitkapsel])

  const ensureSharedPass = () => {
    const existing = getDefaultPassphraseMessagePassphrase()?.trim() || ''
    if (existing.length >= 8) {
      setSharedPass(existing)
      return existing
    }
    const fresh = generatePassphraseMessageSharePassphrase()
    setDefaultPassphraseMessagePassphrase(fresh)
    setSharedPass(fresh)
    return fresh
  }

  const pickNft = (v: string, opts?: { enableStrongGate?: boolean }) => {
    const oid = v ? normalizeNftObjectIdInput(v) : ''
    const ok = Boolean(oid && /^0x[a-f0-9]{64}$/.test(oid))
    setBindOid(ok ? oid : '')
    setManualOidDraft(ok ? oid : v)
    writePassphraseNftKeycardBindObjectId(ok ? oid : null)
    if (opts?.enableStrongGate !== false) {
      setStrongGate(ok)
      writePassphraseNftStrongGateEnabled(ok)
    }
    if (ok) {
      writeZeitkapselLastNftObjectId(oid)
      setLastZeitkapselNft(oid)
    }
    const card = cards.find((c) => c.objectId === oid)
    const nextSlot = card?.slotIds.includes(bindSlot) ? bindSlot : card?.slotIds[0] || 'default'
    setBindSlot(nextSlot)
    writePassphraseNftKeycardBindSlotId(ok ? nextSlot : null)
  }

  const clearNftBind = () => {
    pickNft('')
    setStrongGate(false)
    writePassphraseNftStrongGateEnabled(false)
    setDualWallet(false)
    writePassphraseNftDualWalletGateEnabled(false)
  }

  const nftSelect = (
    <div className="flex flex-col gap-1.5">
      {nftOptions.length > 0 ? (
        <select
          className="rounded border border-border bg-background px-2 py-1.5 text-[11px] text-foreground"
          value={nftOptions.some((o) => o.objectId === bindOid) ? bindOid : ''}
          onChange={(e) => pickNft(e.target.value)}
          aria-label="NFT auswählen"
        >
          <option value="">— NFT wählen —</option>
          {nftOptions.map((o) => (
            <option key={o.objectId} value={o.objectId}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-[11px] text-muted-foreground">Keine NFTs — zuerst Galerie laden oder minten.</p>
      )}
      <button
        type="button"
        className="self-start text-[10px] text-muted-foreground underline hover:no-underline"
        onClick={() => setManualOidOpen((v) => !v)}
      >
        {manualOidOpen ? 'Object-ID ausblenden' : 'Object-ID tippen'}
      </button>
      {manualOidOpen ? (
        <input
          className="rounded border border-border bg-background px-2 py-1.5 font-mono text-[11px] text-foreground"
          value={manualOidDraft}
          placeholder="0x…"
          aria-label="NFT Object-ID"
          onChange={(e) => {
            const raw = e.target.value
            setManualOidDraft(raw)
            const oid = normalizeNftObjectIdInput(raw)
            if (/^0x[a-f0-9]{64}$/.test(oid)) pickNft(oid)
            else if (!raw.trim()) pickNft('')
          }}
        />
      ) : null}
      {bindOid ? <p className="text-[10px] text-foreground">Aktiv: {shortOid(bindOid)}</p> : null}
      {bindOid ? <NftKeycardImagePreview objectId={bindOid} compact /> : null}
    </div>
  )

  const dualWalletBlock = (
    <div className="space-y-1.5">
      <label className="flex flex-wrap items-start gap-2">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={dualWallet}
          onChange={(e) => {
            const next = e.target.checked
            setDualWallet(next)
            writePassphraseNftDualWalletGateEnabled(next)
            if (next && !requiredWalletsText.trim()) {
              const me = getDirectIotaSessionSignerAddress()?.trim() || ''
              if (me) {
                setRequiredWalletsText(me)
                writePassphraseNftRequiredWallets([me])
              }
            }
          }}
        />
        <span className="font-medium text-foreground">Wallet + NFT</span>
      </label>
      {dualWallet ? (
        <textarea
          className="min-h-[3.5rem] w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground"
          value={requiredWalletsText}
          placeholder={'0x…\n0x…'}
          aria-label="Erlaubte Wallets"
          onChange={(e) => {
            const raw = e.target.value
            setRequiredWalletsText(raw)
            const list = raw
              .split(/[\s,;]+/)
              .map((x) => x.trim().toLowerCase())
              .filter((x) => /^0x[a-f0-9]{64}$/.test(x))
            writePassphraseNftRequiredWallets(list.length ? [...new Set(list)] : null)
          }}
        />
      ) : null}
    </div>
  )

  return (
    <div className="space-y-4 text-xs text-muted-foreground">
      <section className="space-y-2">
        <label className="flex flex-wrap items-center gap-2">
          <input
            type="checkbox"
            checked={zeitkapsel}
            onChange={(e) => {
              const next = e.target.checked
              setZeitkapsel(next)
              writePassphraseZeitkapselModeEnabled(next)
              if (next) {
                setOn(false)
                writePassphraseProtectEnabled(false)
                setStrongGate(true)
                writePassphraseNftStrongGateEnabled(true)
                if (p.encrypted) p.onEncryptedChange?.(false)
                const opts = buildSecuredSpendOptions()
                setNftOptions(opts)
                if (!bindOid && opts[0]) pickNft(opts[0].objectId)
              } else {
                clearNftBind()
              }
            }}
          />
          <span className="text-sm font-semibold text-foreground">NFT-Leserecht</span>
        </label>

        {zeitkapsel ? (
          <div className="ml-5 space-y-2 rounded-md border border-border/70 bg-muted/20 px-2.5 py-2">
            {nftSelect}
            <button
              type="button"
              className="text-[11px] font-medium text-foreground underline hover:no-underline"
              onClick={() => setAdvancedOpen((v) => !v)}
            >
              {advancedOpen ? 'Weniger' : 'Erweitert'}
            </button>
            {advancedOpen ? dualWalletBlock : null}
          </div>
        ) : null}

        {lastZeitkapselNft ? (
          <div className="ml-5 flex flex-wrap items-center gap-2 rounded-md border border-border/70 bg-muted/10 px-2.5 py-2">
            <span className="text-[11px] text-foreground">Zuletzt: {shortOid(lastZeitkapselNft)}</span>
            <button
              type="button"
              className="rounded border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
              onClick={() => requestOpenZeitkapselLease(lastZeitkapselNft)}
            >
              Verleihen…
            </button>
            <button
              type="button"
              className="text-[11px] text-muted-foreground underline hover:no-underline"
              onClick={() => {
                writeZeitkapselLastNftObjectId(null)
                setLastZeitkapselNft(null)
              }}
            >
              Weg
            </button>
          </div>
        ) : null}
      </section>

      <section className="space-y-2 border-t border-border/60 pt-3">
        <label className="flex flex-wrap items-center gap-2">
          <input
            type="checkbox"
            checked={on}
            disabled={zeitkapsel}
            onChange={(e) => {
              const next = e.target.checked
              setOn(next)
              writePassphraseProtectEnabled(next)
              if (next && p.encrypted) p.onEncryptedChange?.(false)
              if (next) {
                setZeitkapsel(false)
                writePassphraseZeitkapselModeEnabled(false)
                clearNftBind()
                ensureSharedPass()
              } else {
                clearNftBind()
              }
            }}
          />
          <span className="text-sm font-semibold text-foreground">Passphrase-Schutz</span>
        </label>

        {on && !zeitkapsel ? (
          <div className="ml-5 space-y-2 rounded-md border border-border/70 bg-muted/20 px-2.5 py-2">
            <label className="flex flex-wrap items-center gap-2">
              <input
                type="checkbox"
                checked={rememberOnDevice}
                disabled={strongGate}
                onChange={(e) => {
                  const next = e.target.checked
                  setRememberOnDevice(next)
                  writePassphraseRememberOnDeviceEnabled(next)
                }}
              />
              <span className="font-medium text-foreground">Auf diesem Gerät merken</span>
            </label>
            {rememberOnDevice && !vaultSessionOpen && !strongGate && p.onRequestVaultSession ? (
              <button
                type="button"
                className="text-[11px] font-semibold text-foreground underline hover:no-underline"
                onClick={() => p.onRequestVaultSession?.()}
              >
                Tresor entsperren (Dauer-Speicher)
              </button>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={sharedPass}
                autoComplete="off"
                spellCheck={false}
                placeholder="Passphrase (min. 8)"
                aria-label="Passphrase"
                onChange={(e) => {
                  const v = e.target.value
                  setSharedPass(v)
                  if (v.trim().length >= 8) setDefaultPassphraseMessagePassphrase(v)
                  else clearDefaultPassphraseMessagePassphrase()
                }}
                className="min-w-[12rem] flex-1 rounded border border-border bg-background px-2 py-1.5 font-mono text-[11px] text-foreground"
              />
              <button
                type="button"
                className="rounded border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
                onClick={() => {
                  const fresh = generatePassphraseMessageSharePassphrase()
                  setDefaultPassphraseMessagePassphrase(fresh)
                  setSharedPass(fresh)
                }}
              >
                Neu würfeln
              </button>
              <button
                type="button"
                className="rounded border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
                disabled={sharedPass.trim().length < 8}
                onClick={() => {
                  void navigator.clipboard?.writeText(sharedPass.trim())
                }}
              >
                Kopieren
              </button>
            </div>

            <label className="flex flex-wrap items-center gap-2">
              <input
                type="checkbox"
                checked={reuse}
                onChange={(e) => {
                  const next = e.target.checked
                  setReuse(next)
                  writePassphraseReuseEnabled(next)
                  ensureSharedPass()
                }}
              />
              <span className="font-medium text-foreground">Passphrase wiederverwenden</span>
            </label>

            <label className="flex flex-wrap items-center gap-2">
              <input
                type="checkbox"
                checked={strongGate}
                onChange={(e) => {
                  const next = e.target.checked
                  setStrongGate(next)
                  writePassphraseNftStrongGateEnabled(next)
                  if (next) {
                    setRememberOnDevice(false)
                    writePassphraseRememberOnDeviceEnabled(false)
                    const opts = buildSecuredSpendOptions()
                    setNftOptions(opts)
                    if (!bindOid && opts[0]) pickNft(opts[0].objectId, { enableStrongGate: true })
                  } else {
                    clearNftBind()
                  }
                }}
              />
              <span className="font-medium text-foreground">Zusätzlich NFT-Besitz</span>
            </label>

            {strongGate ? (
              <div className="space-y-2 border-t border-border/50 pt-2">
                {nftSelect}
                {bindOid && cards.find((c) => c.objectId === bindOid)?.slotIds.length ? (
                  <select
                    className="rounded border border-border bg-background px-2 py-1.5 text-[11px] text-foreground"
                    value={bindSlot}
                    aria-label="Schlüsselkarten-Slot"
                    onChange={(e) => {
                      const v = e.target.value
                      setBindSlot(v)
                      writePassphraseNftKeycardBindSlotId(v)
                    }}
                  >
                    {(cards.find((c) => c.objectId === bindOid)?.slotIds || ['default']).map((sid) => (
                      <option key={sid} value={sid}>
                        Slot: {sid}
                      </option>
                    ))}
                  </select>
                ) : null}
                <button
                  type="button"
                  className="text-[11px] font-medium text-foreground underline hover:no-underline"
                  onClick={() => setAdvancedOpen((v) => !v)}
                >
                  {advancedOpen ? 'Weniger' : 'Erweitert'}
                </button>
                {advancedOpen ? dualWalletBlock : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  )
}
