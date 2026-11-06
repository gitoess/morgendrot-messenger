'use client'

import { useEffect, useState } from 'react'
import { generatePassphraseMessageSharePassphrase } from '@/frontend/lib/passphrase-message-crypto'
import {
  clearDefaultPassphraseMessagePassphrase,
  getDefaultPassphraseMessagePassphrase,
  readPassphraseNftKeycardBindObjectId,
  readPassphraseProtectEnabled,
  readPassphraseReuseEnabled,
  setDefaultPassphraseMessagePassphrase,
  writePassphraseNftKeycardBindObjectId,
  writePassphraseProtectEnabled,
  writePassphraseReuseEnabled,
} from '@/frontend/lib/passphrase-message-local-store'
import { listNftKeycards } from '@/frontend/lib/nft-keycard-local-store'

/** Composer: Passphrase-Nachricht ohne Handshake (Ciphertext on-chain, Key teilen). */
export function PassphraseProtectComposerToggle(p: {
  encrypted: boolean
  onEncryptedChange?: (encrypted: boolean) => void
}) {
  const [on, setOn] = useState(false)
  const [reuse, setReuse] = useState(false)
  const [sharedPass, setSharedPass] = useState('')
  const [bindOid, setBindOid] = useState('')
  const [cards, setCards] = useState<{ objectId: string; label?: string }[]>([])

  useEffect(() => {
    setOn(readPassphraseProtectEnabled())
    setReuse(readPassphraseReuseEnabled())
    setSharedPass(getDefaultPassphraseMessagePassphrase() ?? '')
    setBindOid(readPassphraseNftKeycardBindObjectId() ?? '')
    setCards(
      listNftKeycards().map(({ objectId, entry }) => ({
        objectId,
        label: entry.label,
      }))
    )
  }, [])

  useEffect(() => {
    if (p.encrypted && on) {
      setOn(false)
      writePassphraseProtectEnabled(false)
    }
  }, [p.encrypted, on])

  const ensureSharedPass = () => {
    const existing = getDefaultPassphraseMessagePassphrase()
    if (existing) {
      setSharedPass(existing)
      return existing
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
            if (next && reuse) ensureSharedPass()
          }}
        />
        <span>
          <span className="font-medium text-foreground">Passphrase-Schutz</span>
          {' — '}
          einzelnes Nachrichten-Passwort (nicht Gruppen-Geheimnis). Ciphertext on-chain; Passphrase zum
          Teilen separat. <span className="text-foreground/90">Für dich auf diesem Gerät</span> landet
          sie automatisch im Vault (entsperrt → Klartext wieder da; gesperrt → nur Ciphertext). Bei
          Wiederverwenden unten kopierbar.
        </span>
      </label>

      {on ? (
        <div className="ml-5 space-y-2 rounded-md border border-border/70 bg-muted/20 px-2.5 py-2">
          <label className="flex flex-wrap items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={reuse}
              onChange={(e) => {
                const next = e.target.checked
                setReuse(next)
                writePassphraseReuseEnabled(next)
                if (next) ensureSharedPass()
              }}
            />
            <span>
              <span className="font-medium text-foreground">Passphrase wiederverwenden</span>
              {' — '}
              dieselbe Passphrase für mehrere Nachrichten (weiterhin neuer Salt/IV pro Wire). Aus =
              neue Zufallspassphrase pro Sendung.
            </span>
          </label>

          {reuse ? (
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
          ) : null}

          {cards.length > 0 ? (
            <label className="flex flex-col gap-1">
              <span className="font-medium text-foreground">Key an NFT-Schlüsselkarte binden (optional)</span>
              <span className="text-[11px] text-muted-foreground">
                Zusätzlich zur Passphrase — nicht Alltags-Chat. Karte unter On-Chain / NFT anlegen.
              </span>
              <select
                className="rounded border border-border bg-background px-2 py-1.5 text-[11px] text-foreground"
                value={bindOid}
                onChange={(e) => {
                  const v = e.target.value
                  setBindOid(v)
                  writePassphraseNftKeycardBindObjectId(v || null)
                }}
              >
                <option value="">— keine Bindung —</option>
                {cards.map((c) => (
                  <option key={c.objectId} value={c.objectId}>
                    {(c.label || 'Karte') + ' · ' + c.objectId.slice(0, 12) + '…'}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
