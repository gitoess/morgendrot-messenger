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
  readPassphraseNftRequiredWallet,
  readPassphraseNftSealP4bEnabled,
  readPassphraseNftStrongGateEnabled,
  readPassphraseProtectEnabled,
  readPassphraseRememberOnDeviceEnabled,
  readPassphraseReuseEnabled,
  setDefaultPassphraseMessagePassphrase,
  writePassphraseNftDualWalletGateEnabled,
  writePassphraseNftKeycardBindObjectId,
  writePassphraseNftKeycardBindSlotId,
  writePassphraseNftPubkeyWrapP4a2Enabled,
  writePassphraseNftRequiredWallet,
  writePassphraseNftSealP4bEnabled,
  writePassphraseNftStrongGateEnabled,
  writePassphraseProtectEnabled,
  writePassphraseRememberOnDeviceEnabled,
  writePassphraseReuseEnabled,
} from '@/frontend/lib/passphrase-message-local-store'
import { NftKeycardImagePreview } from '@/frontend/components/nft-keycard-image-preview'
import { listNftKeycards } from '@/frontend/lib/nft-keycard-local-store'
import { getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import {
  isPrivacySoftLocked,
  PRIVACY_SOFT_LOCK_CHANGED_EVENT,
} from '@/frontend/lib/privacy-soft-lock'
import { hasVaultPasswordSession } from '@/frontend/lib/vault-password-session'

/** Composer: Passphrase-Nachricht ohne Handshake (Ciphertext on-chain, Key teilen). */
export function PassphraseProtectComposerToggle(p: {
  encrypted: boolean
  onEncryptedChange?: (encrypted: boolean) => void
  /** Öffnet Dialog „Session-Signer laden“ (Vault-Passwort). */
  onRequestVaultSession?: () => void
}) {
  const [on, setOn] = useState(false)
  const [reuse, setReuse] = useState(() => readPassphraseReuseEnabled())
  const [sharedPass, setSharedPass] = useState('')
  const [bindOid, setBindOid] = useState('')
  const [bindSlot, setBindSlot] = useState('default')
  const [strongGate, setStrongGate] = useState(false)
  const [dualWallet, setDualWallet] = useState(false)
  const [pubkeyWrapP4a2, setPubkeyWrapP4a2] = useState(false)
  const [sealP4b, setSealP4b] = useState(false)
  const [requiredWallet, setRequiredWallet] = useState('')
  const [rememberOnDevice, setRememberOnDevice] = useState(true)
  const [vaultSessionOpen, setVaultSessionOpen] = useState(() => hasVaultPasswordSession())
  const [cards, setCards] = useState<{ objectId: string; label?: string; slotIds: string[] }[]>([])

  useEffect(() => {
    const sync = () => {
      setOn(readPassphraseProtectEnabled())
      setReuse(readPassphraseReuseEnabled())
      setRememberOnDevice(readPassphraseRememberOnDeviceEnabled())
      setVaultSessionOpen(hasVaultPasswordSession())
      setSharedPass(getDefaultPassphraseMessagePassphrase() ?? '')
      setBindOid(readPassphraseNftKeycardBindObjectId() ?? '')
      setBindSlot(readPassphraseNftKeycardBindSlotId())
      setStrongGate(readPassphraseNftStrongGateEnabled())
      setDualWallet(readPassphraseNftDualWalletGateEnabled())
      setPubkeyWrapP4a2(readPassphraseNftPubkeyWrapP4a2Enabled())
      setSealP4b(readPassphraseNftSealP4bEnabled())
      setRequiredWallet(readPassphraseNftRequiredWallet() ?? '')
      setCards(
        listNftKeycards().map(({ objectId, entry }) => ({
          objectId,
          label: entry.label,
          slotIds: entry.slots.map((s) => s.id),
        }))
      )
    }
    sync()
    window.addEventListener(PASSPHRASE_MESSAGE_VAULT_CHANGED_EVENT, sync)
    window.addEventListener(PRIVACY_SOFT_LOCK_CHANGED_EVENT, sync)
    return () => {
      window.removeEventListener(PASSPHRASE_MESSAGE_VAULT_CHANGED_EVENT, sync)
      window.removeEventListener(PRIVACY_SOFT_LOCK_CHANGED_EVENT, sync)
    }
  }, [])

  useEffect(() => {
    if (p.encrypted && on) {
      setOn(false)
      writePassphraseProtectEnabled(false)
    }
  }, [p.encrypted, on])

  /** Wiederverwenden: bestehende Vault-Default behalten — nie still neu würfeln nach Lock. */
  const ensureSharedPass = () => {
    const existing = getDefaultPassphraseMessagePassphrase()
    if (existing) {
      setSharedPass(existing)
      return existing
    }
    if (isPrivacySoftLocked() || !hasVaultPasswordSession()) {
      setSharedPass('')
      return ''
    }
    const fresh = generatePassphraseMessageSharePassphrase()
    setDefaultPassphraseMessagePassphrase(fresh)
    setSharedPass(fresh)
    return fresh
  }

  return (
    <div className="space-y-2 text-xs text-muted-foreground">
      <label className="flex flex-wrap items-start gap-2">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={on}
          onChange={(e) => {
            const next = e.target.checked
            setOn(next)
            writePassphraseProtectEnabled(next)
            if (next && p.encrypted) p.onEncryptedChange?.(false)
            if (next) ensureSharedPass()
          }}
        />
        <span>
          <span className="font-medium text-foreground">Passphrase-Schutz</span>
          {' — '}
          eigenes Nachrichten-Passwort (ohne Handshake). Schaltet „Verschlüsselt“ (ECDH) aus — beides
          gleichzeitig geht nicht: entweder Partner-Schlüssel oder Passphrase zum Teilen. Ciphertext
          on-chain; Speichern auf diesem Gerät steuerst du unten.
        </span>
      </label>

      {on ? (
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
              <span className="font-medium text-foreground">Auf diesem Gerät merken</span>
              {' — '}
              An: diese Nachricht nach Unlock wieder Klartext. Aus: nach Lock/Unlock nur Ciphertext,
              bis du die Passphrase manuell eingibst (auch wenn „Wiederverwenden“ an ist).
            </span>
          </label>
          {rememberOnDevice && !vaultSessionOpen ? (
            <p className="text-[11px] text-amber-800 dark:text-amber-200">
              Vault-Sitzung fehlt — oben rechts Badge{' '}
              <span className="font-semibold text-foreground">„Vault: Passwort“</span> tippen, Passwort
              eingeben, dann „Signer laden“. Ohne das ist Senden mit Merken blockiert.
              {p.onRequestVaultSession ? (
                <>
                  {' '}
                  <button
                    type="button"
                    className="font-semibold text-foreground underline hover:no-underline"
                    onClick={() => p.onRequestVaultSession?.()}
                  >
                    Jetzt Passwort eingeben
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
              An: Feld bleibt nach jedem Send. Aus: nach Send automatisch neu würfeln. Entschlüsselt
              Posteingang nicht automatisch.
            </span>
          </label>

          {cards.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <span className="font-medium text-foreground">Key an NFT-Schlüsselkarte binden (optional)</span>
              <span className="text-[11px] text-muted-foreground">
                Beim Senden wird diese Nachricht (Wire-Fingerprint) an die Karte gehängt — keine Object-ID der
                Nachricht nötig. Beliebig viele PWMSG an dieselbe Karte. Später auch in der Bubble nachbinden.
                Auto-Lesen nur bei Karten-Besitz; Passphrase bleibt der Crypto-Key (kein starkes Gate).
              </span>
              <select
                className="rounded border border-border bg-background px-2 py-1.5 text-[11px] text-foreground"
                value={bindOid}
                onChange={(e) => {
                  const v = e.target.value
                  setBindOid(v)
                  writePassphraseNftKeycardBindObjectId(v || null)
                  const card = cards.find((c) => c.objectId === v)
                  const nextSlot = card?.slotIds.includes(bindSlot)
                    ? bindSlot
                    : card?.slotIds[0] || 'default'
                  setBindSlot(nextSlot)
                  writePassphraseNftKeycardBindSlotId(v ? nextSlot : null)
                }}
              >
                <option value="">— keine Bindung —</option>
                {cards.map((c) => (
                  <option key={c.objectId} value={c.objectId}>
                    {(c.label || 'Karte') + ' · ' + c.objectId.slice(0, 12) + '…'}
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
                      Zufalls-DEK + Capsule; Lesen nur bei Karten-Besitz/Leihe (App-Check). Kein Blank-DEK
                      im Vault. Einmal Klartext = kopierbar. Ohne Seal: nur ehrliche App.
                    </span>
                  </label>
                  {strongGate ? (
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
                          DEK nur mit Broker-Key nach NFT-AddressOwner. Wire allein reicht nicht.
                          Einzelner API-Broker, kein Mysten-Seal. „Unter Zwang“ nur wenn Broker remote/unabhängig.
                          Gesichertes Guthaben (Tab „Guthaben“) ist getrennt und optional.
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
                            if (next && !requiredWallet) {
                              const me = getDirectIotaSessionSignerAddress()?.trim() || ''
                              if (me) {
                                setRequiredWallet(me)
                                writePassphraseNftRequiredWallet(me)
                              }
                            }
                          }}
                        />
                        <span>
                          <span className="font-medium text-foreground">Wallet + NFT (Dual)</span>
                          {' — '}
                          Lesen nur wenn Signer = festgelegte Adresse <em>und</em> NFT-Leserecht. Capsule
                          an beide Felder gebunden; Adresse allein ist kein Geheimnis — dafür P4a2.
                        </span>
                      </label>
                      {dualWallet ? (
                        <>
                          <input
                            className="w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground"
                            value={requiredWallet}
                            placeholder="0x… erlaubte Wallet"
                            onChange={(e) => {
                              setRequiredWallet(e.target.value)
                              writePassphraseNftRequiredWallet(e.target.value || null)
                            }}
                          />
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
                              DEK zusätzlich an ECDH-Pubkey der erlaubten Wallet; Wire allein entschlüsselt
                              nicht. Braucht Peer-Pub (Handshake) für diese Adresse.
                              {sealP4b ? ' (aus: P4b aktiv)' : ''}
                            </span>
                          </label>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
