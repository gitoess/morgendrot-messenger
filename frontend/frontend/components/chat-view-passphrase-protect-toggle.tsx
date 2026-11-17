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
  readPassphraseNftPubkeyWrapP4a2Enabled,
  readPassphraseNftRequiredWallets,
  readPassphraseNftSealP4bEnabled,
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
  writePassphraseNftPubkeyWrapP4a2Enabled,
  writePassphraseNftRequiredWallets,
  writePassphraseNftSealP4bEnabled,
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

/** Composer: Passphrase-Nachricht + Zeitkapsel-Nachricht (NFTGATE). */
export function PassphraseProtectComposerToggle(p: {
  encrypted: boolean
  onEncryptedChange?: (encrypted: boolean) => void
  /** Öffnet Dialog „Session-Signer laden“ (Vault-Passwort). */
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
  const [pubkeyWrapP4a2, setPubkeyWrapP4a2] = useState(false)
  const [sealP4b, setSealP4b] = useState(false)
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
      setPubkeyWrapP4a2(readPassphraseNftPubkeyWrapP4a2Enabled())
      setSealP4b(readPassphraseNftSealP4bEnabled())
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
    /** Mint/Galerie „als Schlüsselkarte merken“ — sonst bleibt Composer bei „Keine … gemerkt“. */
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

  /** Bestehende Default behalten; sonst neu würfeln (RAM/Tab — Vault optional für Dauerpersistenz). */
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

  const pickNft = (v: string) => {
    const oid = v ? normalizeNftObjectIdInput(v) : ''
    const ok = Boolean(oid && /^0x[a-f0-9]{64}$/.test(oid))
    setBindOid(ok ? oid : '')
    setManualOidDraft(ok ? oid : v)
    writePassphraseNftKeycardBindObjectId(ok ? oid : null)
    writePassphraseNftStrongGateEnabled(ok)
    if (ok) {
      writeZeitkapselLastNftObjectId(oid)
      setLastZeitkapselNft(oid)
    }
    const card = cards.find((c) => c.objectId === oid)
    const nextSlot = card?.slotIds.includes(bindSlot) ? bindSlot : card?.slotIds[0] || 'default'
    setBindSlot(nextSlot)
    writePassphraseNftKeycardBindSlotId(ok ? nextSlot : null)
  }

  const nftSelect = (
    <div className="flex flex-col gap-1.5">
      {nftOptions.length > 0 ? (
        <>
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
          <ul className="max-h-36 space-y-0.5 overflow-y-auto rounded border border-border/60 bg-background/60 p-1">
            {nftOptions.map((o) => {
              const active = o.objectId === bindOid
              return (
                <li key={`list-${o.objectId}`}>
                  <button
                    type="button"
                    className={
                      active
                        ? 'flex w-full items-center gap-2 rounded bg-muted px-2 py-1.5 text-left text-[11px] font-medium text-foreground'
                        : 'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] text-foreground hover:bg-muted/60'
                    }
                    onClick={() => pickNft(o.objectId)}
                  >
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {active ? <span className="shrink-0 text-[10px] text-muted-foreground">aktiv</span> : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Noch keine NFTs in der Liste — On-Chain → Tab „Eigene“ einmal laden (oder minten). Dann
          erscheinen sie hier zum Anklicken.
        </p>
      )}
      <button
        type="button"
        className="self-start text-[10px] text-muted-foreground underline hover:no-underline"
        onClick={() => setManualOidOpen((v) => !v)}
      >
        {manualOidOpen ? 'Object-ID ausblenden' : 'Oder Object-ID eintippen'}
      </button>
      {manualOidOpen ? (
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] font-medium text-foreground">NFT Object-ID (0x…)</span>
          <input
            className="rounded border border-border bg-background px-2 py-1.5 font-mono text-[11px] text-foreground"
            value={manualOidDraft}
            placeholder="0x… aus Galerie / Explorer kopieren"
            onChange={(e) => {
              const raw = e.target.value
              setManualOidDraft(raw)
              const oid = normalizeNftObjectIdInput(raw)
              if (/^0x[a-f0-9]{64}$/.test(oid)) pickNft(oid)
              else if (!raw.trim()) pickNft('')
            }}
          />
        </label>
      ) : null}
      {bindOid ? (
        <p className="text-[10px] text-foreground">Aktiv: {shortOid(bindOid)}</p>
      ) : manualOidOpen && manualOidDraft.trim() ? (
        <p className="text-[10px] text-amber-800 dark:text-amber-200">Ungültige Object-ID (0x + 64 Hex).</p>
      ) : null}
      {bindOid ? <NftKeycardImagePreview objectId={bindOid} compact /> : null}
    </div>
  )

  const advancedGate = (
    <div className="ml-1 space-y-1.5 border-l border-border/60 pl-2">
      <label className="flex flex-wrap items-start gap-2">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={sealP4b}
          onChange={(e) => {
            const next = e.target.checked
            setSealP4b(next)
            writePassphraseNftSealP4bEnabled(next)
            if (next) {
              setPubkeyWrapP4a2(false)
              writePassphraseNftPubkeyWrapP4a2Enabled(false)
            }
          }}
        />
        <span>
          <span className="font-medium text-foreground">Seal / Key-Broker (P4b)</span>
          {' — '}
          Extra-Schloss: der Textschlüssel liegt nicht im Wire. Zum Lesen fragt die App den
          Boss-Key-Broker; der gibt den Schlüssel nur, wenn die Chain sagt „diese Wallet besitzt
          das NFT jetzt“. Ohne Broker/Boss kein Klartext — auch mit Wire-Kopie. Für Solo-Tests
          meist auslassen.
        </span>
      </label>
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
        <span>
          <span className="font-medium text-foreground">Wallet + NFT (Dual)</span>
          {' — '}
          Lesen nur wenn Signer = eine der erlaubten Adressen <em>und</em> NFT-Leserecht.
        </span>
      </label>
      {dualWallet ? (
        <>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-foreground">Erlaubte Wallets (eine pro Zeile oder Komma)</span>
            <textarea
              className="min-h-[3.5rem] w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground"
              value={requiredWalletsText}
              placeholder={'0x…\n0x…'}
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
          </label>
          <label className="flex flex-wrap items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={pubkeyWrapP4a2}
              onChange={(e) => {
                const next = e.target.checked
                setPubkeyWrapP4a2(next)
                writePassphraseNftPubkeyWrapP4a2Enabled(next)
                if (next) {
                  setSealP4b(false)
                  writePassphraseNftSealP4bEnabled(false)
                }
              }}
              disabled={sealP4b}
            />
            <span>
              <span className="font-medium text-foreground">Pubkey-Wrap (P4a2)</span>
              {' — '}
              Nur mit <strong>genau einer</strong> Wallet: Textschlüssel zusätzlich mit deren
              ECDH-Pubkey. Später.
              {sealP4b ? ' (aus: P4b aktiv)' : ''}
            </span>
          </label>
        </>
      ) : null}
    </div>
  )

  return (
    <div className="space-y-2 text-xs text-muted-foreground">
      <label className="flex flex-wrap items-start gap-2">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={zeitkapsel}
          onChange={(e) => {
            const next = e.target.checked
            setZeitkapsel(next)
            writePassphraseZeitkapselModeEnabled(next)
            if (next) {
              setOn(false)
              setStrongGate(true)
              if (p.encrypted) p.onEncryptedChange?.(false)
              const opts = buildSecuredSpendOptions()
              setNftOptions(opts)
              if (!bindOid && opts[0]) pickNft(opts[0].objectId)
            }
          }}
        />
        <span>
          <span className="font-medium text-foreground">Zeitkapsel-Nachricht</span>
          {' — '}
          nur mit NFT-Besitz/Leihe lesbar (Ciphertext on-chain). Verleihen ist ein{' '}
          <em>eigener</em> Schritt (CTA unten oder On-Chain → Tab Zeitkapsel) — nicht dasselbe wie
          Senden. Geht nicht zusammen mit Composer-„Verschlüsselt“ (ECDH).
        </span>
      </label>

      {zeitkapsel ? (
        <div className="ml-5 space-y-2 rounded-md border border-border/70 bg-muted/20 px-2.5 py-2">
          <p className="text-[11px] font-medium text-foreground">NFT wählen</p>
          {nftSelect}
          <button
            type="button"
            className="text-[11px] font-medium text-foreground underline hover:no-underline"
            onClick={() => setAdvancedOpen((v) => !v)}
          >
            {advancedOpen ? 'Erweitert aus' : 'Erweitert'}
          </button>
          {advancedOpen ? advancedGate : null}
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

      <label className="flex flex-wrap items-start gap-2">
        <input
          type="checkbox"
          className="mt-0.5"
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
              // Rest-OID von Zeitkapsel nicht stillschweigend mit PWMSG verknüpfen
              pickNft('')
              ensureSharedPass()
            }
          }}
        />
        <span>
          <span className="font-medium text-foreground">Passphrase-Schutz</span>
          {' — '}
          eigenes Nachrichten-Passwort (ohne Handshake). Nicht zusammen mit ECDH „Verschlüsselt“.
        </span>
      </label>

      {on && !zeitkapsel ? (
        <div className="ml-5 space-y-2 rounded-md border border-border/70 bg-muted/20 px-2.5 py-2">
          <label className="flex flex-wrap items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={rememberOnDevice}
              onChange={(e) => {
                const next = e.target.checked
                setRememberOnDevice(next)
                writePassphraseRememberOnDeviceEnabled(next)
              }}
            />
            <span>
              <span className="font-medium text-foreground">
                Für mich auf diesem Gerät merken (Absender)
              </span>
              {' — '}
              Nur <em>deine</em> lokale Lesepforte: An → Passphrase hier speichern, Posteingang öffnet Klartext ohne
              Tippen. Optional mit Vault-Session dauerhaft über Neuladen. Aus (bewusst) → nur Ciphertext, Passphrase
              jedes Mal manuell. Wird <strong>nicht</strong> an den Empfänger gesendet.
            </span>
          </label>
          {rememberOnDevice && !vaultSessionOpen ? (
            <p className="text-[11px] text-amber-800 dark:text-amber-200">
              Merken geht auch ohne Vault (dieser Tab). Badge{' '}
              <span className="font-semibold text-foreground">„Vault: Passwort“</span> ={' '}
              <em>Tresor</em>-Passwort für Dauer-Speicher — nicht die Nachrichten-Passphrase unten.
              {p.onRequestVaultSession ? (
                <>
                  {' '}
                  <button
                    type="button"
                    className="font-semibold text-foreground underline hover:no-underline"
                    onClick={() => p.onRequestVaultSession?.()}
                  >
                    Tresor entsperren
                  </button>
                </>
              ) : null}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <p className="text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">Passphrase für den nächsten Send</span>
              {' — '}
              {reuse
                ? 'bleibt gleich, bis du neu würfelst.'
                : 'nach dem Send wird automatisch neu gewürfelt (oder selbst ändern).'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={sharedPass}
                autoComplete="off"
                spellCheck={false}
                placeholder="Mindestens 8 Zeichen"
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
          </div>

          <label className="flex flex-wrap items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={reuse}
              onChange={(e) => {
                const next = e.target.checked
                setReuse(next)
                writePassphraseReuseEnabled(next)
                ensureSharedPass()
              }}
            />
            <span>
              <span className="font-medium text-foreground">Passphrase wiederverwenden</span>
              {' — '}
              An: Feld bleibt nach jedem Send (gleiche PW lokal). Aus: nach Send neu würfeln. Verbindet
              Nachrichten <em>nicht</em> on-chain mit einem NFT.
            </span>
          </label>

          {nftOptions.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <span className="font-medium text-foreground">
                Key an NFT binden (optional, nur lokal)
              </span>
              <span className="text-[11px] text-muted-foreground">
                Nur bei Passphrase-Nachrichten (PWMSG). Klartext, ECDH „Verschlüsselt“ und Telegram
                haben keinen PWMSG-Wire — deshalb kein Bind im Postausgang. Soft-Bind = lokal
                Fingerprint↔Karte, kein starkes On-Chain-Gate (dafür Zeitkapsel-Modus).
              </span>
              <select
                className="rounded border border-border bg-background px-2 py-1.5 text-[11px] text-foreground"
                value={nftOptions.some((o) => o.objectId === bindOid) ? bindOid : ''}
                onChange={(e) => pickNft(e.target.value)}
              >
                <option value="">— keine Bindung —</option>
                {nftOptions.map((o) => (
                  <option key={o.objectId} value={o.objectId}>
                    {o.label}
                  </option>
                ))}
              </select>
              {bindOid ? (
                <>
                  <NftKeycardImagePreview objectId={bindOid} compact />
                  <select
                    className="rounded border border-border bg-background px-2 py-1.5 text-[11px] text-foreground"
                    value={bindSlot}
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
                  <label className="flex flex-wrap items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={strongGate}
                      onChange={(e) => {
                        const next = e.target.checked
                        setStrongGate(next)
                        writePassphraseNftStrongGateEnabled(next)
                        if (next) {
                          setRememberOnDevice(false)
                          writePassphraseRememberOnDeviceEnabled(false)
                        } else {
                          setDualWallet(false)
                          writePassphraseNftDualWalletGateEnabled(false)
                        }
                      }}
                    />
                    <span>
                      <span className="font-medium text-foreground">Starkes NFT-Besitz-Gate (P4a)</span>
                      {' — '}
                      wie Zeitkapsel-Nachricht; bevorzugter Einstieg ist der Modus oben.
                    </span>
                  </label>
                  {strongGate ? advancedGate : null}
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
