'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, FileText, Square, Volume2 } from 'lucide-react'
import {
  normalizeMessengerWireContent,
  parseCompactImageMessage,
  parseCompactTextMessage,
  parseFileTxtMessage,
  parseMorgAudioV1Message,
} from '@/frontend/lib/compact-image-wire'
import {
  reconstructCompactImageToDataUrlWithMeta,
} from '@/frontend/lib/compact-image-canvas'
import type { Message } from '@/frontend/lib/types'
import {
  parseLoraProgressiveMessage,
  findPartnerChromaJpeg,
  fuseLoraProgressivePreferSharpBackend,
  uint8ToObjectUrl,
  revokeObjectUrlSafe,
  downloadUint8AsFile,
  downloadDataUrlAsFile,
  LORA_CHROMA_WAIT_MS,
} from '@/frontend/lib/lora-progressive-image-client'
import { messageLooksLikePath4ImageTransferWire } from '@/frontend/lib/lora-sarq-parser'
import { MorgSegV1ChatSink } from '@/frontend/components/morg-seg-v1-chat-sink'
import {
  decryptPassphraseMessageWire,
  isPassphraseMessageWire,
} from '@/frontend/lib/passphrase-message-crypto'
import {
  decryptNftGateMessageWire,
  isNftGateMessageWire,
  peekNftGateMeta,
  peekNftGateObjectId,
} from '@/frontend/lib/nft-gate-dek-capsule'
import {
  findNftTimeLeaseByNft,
  isNftTimeLeaseBorrowerActive,
  NFT_TIME_LEASE_CHANGED,
  nftTimeLeaseBadgeText,
} from '@/frontend/lib/nft-time-lease-local-store'
import {
  fingerprintPassphraseMessageWire,
  flushPassphraseMessageVaultPersist,
  forgetPassphraseMessagePassphrase,
  lookupPassphraseMessagePassphrase,
  PASSPHRASE_MESSAGE_VAULT_CHANGED_EVENT,
  rememberPassphraseMessagePassphrase,
} from '@/frontend/lib/passphrase-message-local-store'
import {
  bindWireToNftKeycard,
  findNftKeycardBindingForWireFingerprint,
  flushNftKeycardVaultPersist,
  listNftKeycards,
  lookupPassphraseForNftKeycard,
  NFT_KEYCARD_VAULT_CHANGED_EVENT,
  unbindWireFromNftKeycard,
} from '@/frontend/lib/nft-keycard-local-store'
import { checkNftKeycardOwnedBySigner } from '@/frontend/lib/nft-keycard-ownership'
import { getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import { cn } from '@/lib/utils'

const TXT_PREVIEW_CHARS = 480
const TXT_COLLAPSE_MAX_H = 'max-h-36' /* 9rem */

/** B2-P4a: DEK-Capsule — kein Passphrase-Feld; nur Owner-Check. */
function NftGateMessageBody(p: {
  content: string
  onCopyRaw: () => void
  copiedRaw: boolean
}) {
  const nftOid = peekNftGateObjectId(p.content)
  const [plain, setPlain] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [owned, setOwned] = useState<boolean | null>(null)
  const [leaseBadge, setLeaseBadge] = useState('')
  const [hidden, setHidden] = useState(false)

  const tryUnlock = async () => {
    if (!nftOid) {
      setErr('Keine NFT Object-ID im Wire.')
      return
    }
    setBusy(true)
    setErr('')
    try {
      const me = getDirectIotaSessionSignerAddress()
      if (!me) throw new Error('Kein Session-Signer — Wallet laden.')
      const lease = findNftTimeLeaseByNft(nftOid)
      setLeaseBadge(lease ? nftTimeLeaseBadgeText(lease) : '')
      const meta = peekNftGateMeta(p.content)
      const borrowerOk = isNftTimeLeaseBorrowerActive(lease, me)
      const own = await checkNftKeycardOwnedBySigner(nftOid, me)
      const addressOwned = own.ok && own.owned
      const nftAccessOk = Boolean(addressOwned || borrowerOk)
      setOwned(nftAccessOk ? true : own.ok ? false : null)
      const { getDirectChatEcdhPrivateKey } = await import(
        '@/frontend/lib/direct-chat-ecdh-session'
      )
      let sealWrapKeyRaw: Uint8Array | null = null
      if (meta?.gate === 'nft_seal_p4b') {
        const { fetchNftSealUnwrapKey } = await import('@/frontend/lib/nft-gate-seal-client')
        const ur = await fetchNftSealUnwrapKey({
          nftObjectId: nftOid,
          requesterAddress: me,
          requiredWallet: meta.requiredWallet || null,
        })
        if (!ur.ok) throw new Error(ur.error)
        sealWrapKeyRaw = ur.wrapKeyRaw
      }
      const t = await decryptNftGateMessageWire(p.content, {
        nftAccessOk: meta?.gate === 'nft_seal_p4b' ? true : nftAccessOk,
        signerAddress: me,
        ecdhPrivateKey:
          meta?.gate === 'nft_and_wallet_pubkey_p4a2' ? getDirectChatEcdhPrivateKey() : null,
        sealWrapKeyRaw,
      })
      if (
        meta?.gate === 'nft_and_wallet_p4a' ||
        meta?.gate === 'nft_and_wallet_pubkey_p4a2' ||
        meta?.gate === 'nft_seal_p4b'
      ) {
        const label =
          meta.gate === 'nft_seal_p4b'
            ? `P4b Seal: Broker + NFT ${nftOid.slice(0, 10)}…`
            : meta.gate === 'nft_and_wallet_pubkey_p4a2'
              ? `P4a2: Wallet ${meta.requiredWallet?.slice(0, 12) ?? '—'}… + NFT + Pubkey`
              : `Dual-Gate: Wallet ${meta.requiredWallet?.slice(0, 12) ?? '—'}… + NFT`
        setLeaseBadge((prev) => [prev, label].filter(Boolean).join(' · '))
      }
      setPlain(t)
      setHidden(false)
    } catch (e) {
      setPlain(null)
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void tryUnlock()
    const sync = () => void tryUnlock()
    window.addEventListener(NFT_TIME_LEASE_CHANGED, sync)
    return () => window.removeEventListener(NFT_TIME_LEASE_CHANGED, sync)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Wire + Lease-Events
  }, [p.content])

  return (
    <div className="space-y-2 text-xs">
      <p className="rounded border border-amber-700/40 bg-amber-950/20 px-2 py-1.5 text-[11px] text-amber-100/90">
        NFT-Gate (App-Check). Kein Blank-DEK. Einmal Klartext = kopierbar. Ohne Seal: nur ehrliche App.
        Karte: {nftOid ? `${nftOid.slice(0, 14)}…` : '—'}
        {owned === true ? ' · Leserecht ok' : owned === false ? ' · kein Leserecht' : ''}
      </p>
      {leaseBadge ? (
        <p className="rounded border border-sky-800/30 bg-sky-950/15 px-2 py-1 text-[11px] text-sky-100/90">
          {leaseBadge}
        </p>
      ) : null}
      {err ? <p className="text-destructive">{err}</p> : null}
      {plain && !hidden ? (
        <div className="space-y-1.5">
          <pre className="whitespace-pre-wrap break-words rounded border border-border/60 bg-muted/30 p-2 text-[12px] text-foreground">
            {plain}
          </pre>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="underline" onClick={() => { setPlain(null); setHidden(true) }}>
              Ausblenden
            </button>
            <button type="button" className="underline" disabled={busy} onClick={() => void tryUnlock()}>
              Besitz erneut prüfen
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-border px-2 py-1 text-foreground disabled:opacity-50"
            disabled={busy}
            onClick={() => void tryUnlock()}
          >
            {busy ? 'Prüfe…' : hidden ? 'Mit NFT-Besitz anzeigen' : 'Mit NFT-Besitz entschlüsseln'}
          </button>
          <button type="button" className="underline text-muted-foreground" onClick={p.onCopyRaw}>
            {p.copiedRaw ? 'Wire kopiert' : 'Wire kopieren'}
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Per-Wire-Vault („merken“) und ggf. Schlüsselkarten-Slot.
 * Bei Wire-Bindung an NFT: Auto nur wenn Signer die Karte **aktuell besitzt**
 * (Komfort-Gate — Passphrase manuell bleibt möglich).
 */
async function resolveAutoPassphraseForWire(wire: string): Promise<{
  pass: string
  gatedByKeycard: boolean
  owned: boolean | null
  cardObjectId?: string
}> {
  const fp = fingerprintPassphraseMessageWire(wire)
  const binding = findNftKeycardBindingForWireFingerprint(fp)
  const remembered = lookupPassphraseMessagePassphrase(wire)?.trim() || ''
  const fromCard = binding
    ? lookupPassphraseForNftKeycard({ wireFingerprint: fp })?.trim() || ''
    : ''
  const candidate = remembered || fromCard
  if (!binding) {
    return { pass: remembered, gatedByKeycard: false, owned: null }
  }
  const me = getDirectIotaSessionSignerAddress()
  if (!me) {
    return { pass: '', gatedByKeycard: true, owned: false, cardObjectId: binding.cardObjectId }
  }
  const own = await checkNftKeycardOwnedBySigner(binding.cardObjectId, me)
  if (!own.ok || !own.owned) {
    return { pass: '', gatedByKeycard: true, owned: false, cardObjectId: binding.cardObjectId }
  }
  return {
    pass: candidate,
    gatedByKeycard: true,
    owned: true,
    cardObjectId: binding.cardObjectId,
  }
}

function PassphraseMessageBody(p: {
  content: string
  onCopyRaw: () => void
  copiedRaw: boolean
}) {
  const [known, setKnown] = useState('')
  const [pass, setPass] = useState('')
  const [plain, setPlain] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [autoBusy, setAutoBusy] = useState(false)
  /** Weiches Verbergen: Klartext weg, Key bleibt (Schulterblick). */
  const [hidden, setHidden] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [copiedPass, setCopiedPass] = useState(false)
  const [keycardGateHint, setKeycardGateHint] = useState('')
  const [boundCardOid, setBoundCardOid] = useState<string | null>(null)
  const [bindPickOid, setBindPickOid] = useState('')
  const [cardsTick, setCardsTick] = useState(0)
  const keycards = listNftKeycards()

  const effectivePass = (pass.trim() || known).trim()

  const refreshBindingMeta = () => {
    const fp = fingerprintPassphraseMessageWire(p.content)
    const b = findNftKeycardBindingForWireFingerprint(fp)
    setBoundCardOid(b?.cardObjectId ?? null)
    if (b?.cardObjectId) setBindPickOid(b.cardObjectId)
  }

  const bindToKeycard = () => {
    const oid = (bindPickOid || keycards[0]?.objectId || '').trim()
    if (!oid) {
      setErr('Keine Schlüsselkarte — zuerst unter On-Chain / NFT „Als Schlüsselkarte merken“.')
      return
    }
    const card = keycards.find((c) => c.objectId === oid)
    const slotId = card?.entry.slots[0]?.id || 'default'
    const r = bindWireToNftKeycard({
      objectId: oid,
      wireFingerprint: fingerprintPassphraseMessageWire(p.content),
      slotId,
    })
    if (!r.ok) {
      setErr(r.error)
      return
    }
    if (effectivePass.length >= 8) {
      rememberPassphraseMessagePassphrase(p.content, effectivePass)
      void flushPassphraseMessageVaultPersist()
    }
    void flushNftKeycardVaultPersist()
    setCardsTick((n) => n + 1)
    refreshBindingMeta()
    setErr('')
  }

  const unbindFromKeycard = () => {
    if (!boundCardOid) return
    const r = unbindWireFromNftKeycard({
      objectId: boundCardOid,
      wireFingerprint: fingerprintPassphraseMessageWire(p.content),
    })
    if (!r.ok) {
      setErr(r.error)
      return
    }
    void flushNftKeycardVaultPersist()
    setCardsTick((n) => n + 1)
    refreshBindingMeta()
  }

  const copyPassphrase = () => {
    const v = effectivePass
    if (v.length < 8) return
    void navigator.clipboard.writeText(v).then(() => {
      setCopiedPass(true)
      window.setTimeout(() => setCopiedPass(false), 2000)
    })
  }

  useEffect(() => {
    let alive = true
    const sync = () => {
      void resolveAutoPassphraseForWire(p.content).then((r) => {
        if (!alive) return
        if (r.gatedByKeycard && r.owned === false) {
          setKeycardGateHint(
            'An NFT-Schlüsselkarte gebunden — Auto-Lesen nur mit aktuellem Besitz. Passphrase manuell bleibt möglich (Komfort-Modus, kein starkes Crypto-Gate).'
          )
          setKnown('')
          setPlain(null)
          return
        }
        setKeycardGateHint(
          r.gatedByKeycard
            ? 'Schlüsselkarte: Besitz ok — Auto aus Slot/Merker.'
            : ''
        )
        setBoundCardOid(r.cardObjectId ?? null)
        if (r.cardObjectId) setBindPickOid(r.cardObjectId)
        setKnown((prev) => (prev === r.pass ? prev : r.pass))
        setPass((prev) => (prev.trim().length >= 8 ? prev : r.pass))
        if (!r.pass) {
          setPlain(null)
          setHidden(false)
        }
      })
    }
    refreshBindingMeta()
    sync()
    window.addEventListener(PASSPHRASE_MESSAGE_VAULT_CHANGED_EVENT, sync)
    window.addEventListener(NFT_KEYCARD_VAULT_CHANGED_EVENT, sync)
    return () => {
      alive = false
      window.removeEventListener(PASSPHRASE_MESSAGE_VAULT_CHANGED_EVENT, sync)
      window.removeEventListener(NFT_KEYCARD_VAULT_CHANGED_EVENT, sync)
    }
  }, [p.content, cardsTick])

  useEffect(() => {
    if (!known || plain || hidden) return
    let alive = true
    setAutoBusy(true)
    void decryptPassphraseMessageWire(p.content, known)
      .then((t) => {
        if (!alive) return
        // Schon im Vault gemerkt — kein erneutes Remember nötig (vermeidet Event-Flackern).
        setPass(known)
        setPlain(t)
        setErr('')
      })
      .catch(() => {
        /* known wrong — user enters manually */
      })
      .finally(() => {
        if (alive) setAutoBusy(false)
      })
    return () => {
      alive = false
    }
  }, [p.content, known, plain, hidden])

  const onUnlock = async () => {
    setBusy(true)
    setErr('')
    try {
      const t = await decryptPassphraseMessageWire(p.content, pass)
      // Manuelle Eingabe = bewusst merken (wie Absender-Remember an).
      rememberPassphraseMessagePassphrase(p.content, pass.trim())
      await flushPassphraseMessageVaultPersist()
      setKnown(pass.trim())
      setHidden(false)
      setPlain(t)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const hidePlain = () => {
    setPlain(null)
    setShowPass(false)
    setHidden(true)
  }

  const revealAgain = () => {
    setHidden(false)
    setPlain(null)
  }

  const forgetLocal = () => {
    forgetPassphraseMessagePassphrase(p.content)
    void flushPassphraseMessageVaultPersist()
    setPass('')
    setKnown('')
    setShowPass(false)
    setPlain(null)
    setHidden(false)
  }

  const confirmForgetVault = () => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        'Passphrase aus dem Vault auf diesem Gerät löschen? Die Nachricht bleibt on-chain verschlüsselt — zum Lesen Passphrase erneut eingeben.'
      )
    ) {
      return
    }
    forgetLocal()
  }

  const vaultForgetButton = known ? (
    <button
      type="button"
      className="text-xs text-muted-foreground hover:underline"
      onClick={confirmForgetVault}
      title="Merker für diese Nachricht aus dem lokalen Vault entfernen"
    >
      Im Vault löschen
    </button>
  ) : null

  return (
    <div className="space-y-2 rounded-lg border border-amber-600/40 bg-amber-500/10 p-3">
      {plain ? (
        <>
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">{plain}</p>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={copyPassphrase}
              disabled={effectivePass.length < 8}
            >
              {copiedPass ? 'Kopiert' : 'Passphrase kopieren'}
            </button>
            <button
              type="button"
              className="text-xs font-medium text-muted-foreground hover:underline"
              onClick={hidePlain}
              title="Klartext ausblenden (Key bleibt lokal — ein Klick zum Wiederanzeigen)"
            >
              Verbergen
            </button>
            <button
              type="button"
              className="text-xs font-medium text-muted-foreground hover:underline"
              onClick={() => setShowPass((v) => !v)}
            >
              {showPass ? 'Passphrase verbergen' : 'Passphrase anzeigen'}
            </button>
            {showPass ? (
              <code className="max-w-full break-all rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                {effectivePass}
              </code>
            ) : null}
            {vaultForgetButton}
            <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={p.onCopyRaw}>
              {p.copiedRaw ? 'Kopiert' : 'Wire kopieren'}
            </button>
          </div>
          {keycards.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {boundCardOid ? (
                <>
                  <span className="text-[10px] text-muted-foreground">
                    An Karte {boundCardOid.slice(0, 10)}… gebunden
                  </span>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:underline"
                    onClick={unbindFromKeycard}
                  >
                    Bindung lösen
                  </button>
                </>
              ) : (
                <>
                  <select
                    className="max-w-[14rem] rounded border border-border bg-background px-1.5 py-1 text-[10px]"
                    value={bindPickOid || keycards[0]?.objectId || ''}
                    onChange={(e) => setBindPickOid(e.target.value)}
                  >
                    {keycards.map((c) => (
                      <option key={c.objectId} value={c.objectId}>
                        {(c.entry.label || 'Karte') + ' · ' + c.objectId.slice(0, 10) + '…'}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={bindToKeycard}
                    title="Keine Object-ID der Nachricht nötig — Fingerprint des Wires"
                  >
                    An Schlüsselkarte binden
                  </button>
                </>
              )}
            </div>
          ) : null}
        </>
      ) : autoBusy && known && !hidden ? (
        <p className="text-xs text-muted-foreground">Entschlüssele…</p>
      ) : hidden && known ? (
        <>
          <p className="text-xs font-medium text-amber-900 dark:text-amber-100">
            Inhalt verborgen (Ciphertext on-chain). Key noch lokal — Absender und Empfänger gleich.
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
              onClick={revealAgain}
            >
              Wieder anzeigen
            </button>
            {vaultForgetButton}
            <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={p.onCopyRaw}>
              {p.copiedRaw ? 'Kopiert' : 'Wire kopieren'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs font-medium text-amber-900 dark:text-amber-100">
            Passphrase nötig — ohne Key nur Ciphertext (gilt für Absender und Empfänger).
          </p>
          {keycardGateHint ? (
            <p className="text-[11px] text-amber-800/90 dark:text-amber-100/90">{keycardGateHint}</p>
          ) : null}
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="Passphrase eingeben (≥8)"
            className="w-full rounded-md border border-border bg-input px-3 py-2 font-mono text-xs"
            autoComplete="off"
          />
          {err ? <p className="text-xs text-destructive">{err}</p> : null}
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              disabled={busy || pass.trim().length < 8}
              onClick={() => void onUnlock()}
              className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              {busy ? '…' : 'Entschlüsseln'}
            </button>
            <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={p.onCopyRaw}>
              {p.copiedRaw ? 'Kopiert' : 'Wire kopieren'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function IncompleteMediaBadge({ title }: { title: string }) {
  return (
    <span
      className="pointer-events-none absolute left-2 top-2 z-[1] rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black shadow-sm"
      title={title}
      role="status"
    >
      Unvollständig
    </span>
  )
}

function downloadTextFile(fileName: string, utf8Text: string) {
  const blob = new Blob([utf8Text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function CollapsiblePlainText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const long = text.length > TXT_PREVIEW_CHARS || text.split('\n').length > 8
  const [open, setOpen] = useState(!long)
  const preview = long && !open ? text.slice(0, TXT_PREVIEW_CHARS).trimEnd() + '…' : text

  return (
    <div className="space-y-1.5">
      <pre
        className={cn(
          'overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-2.5 text-sm text-foreground leading-relaxed',
          !open && long ? `${TXT_COLLAPSE_MAX_H}` : 'max-h-96',
          className
        )}
      >
        {preview}
      </pre>
      {long ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {open ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" aria-hidden />
              Weniger
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              Volltext ({text.length.toLocaleString('de-DE')} Zeichen)
            </>
          )}
        </button>
      ) : null}
    </div>
  )
}

function TextToSpeechButton({ text }: { text: string }) {
  const [supported, setSupported] = useState(false)
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    const ok =
      typeof window !== 'undefined' &&
      typeof window.speechSynthesis !== 'undefined' &&
      typeof SpeechSynthesisUtterance !== 'undefined'
    setSupported(ok)
  }, [])

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined') {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  if (!supported || !text.trim()) return null

  const onToggle = () => {
    const synth = window.speechSynthesis
    if (speaking || synth.speaking) {
      synth.cancel()
      setSpeaking(false)
      return
    }
    const maxChars = 2400
    const speakable = text.trim().slice(0, maxChars)
    const utter = new SpeechSynthesisUtterance(speakable)
    utter.lang = 'de-DE'
    utter.rate = 1
    utter.pitch = 1
    utter.onend = () => setSpeaking(false)
    utter.onerror = () => setSpeaking(false)
    synth.cancel()
    setSpeaking(true)
    synth.speak(utter)
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
      title={speaking ? 'Vorlesen stoppen' : 'Text vorlesen'}
    >
      {speaking ? <Square className="h-3.5 w-3.5" aria-hidden /> : <Volume2 className="h-3.5 w-3.5" aria-hidden />}
      {speaking ? 'Stopp' : 'Vorlesen'}
    </button>
  )
}

/** Opus in Ogg: Blob-URL + &lt;audio controls&gt; – zuverlässiger als data:-URL in Chromium/Safari. */
function MorgAudioPlayer({ blobBase64 }: { blobBase64: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setErr(null)
    let alive = true
    const b64 = blobBase64.replace(/\s/g, '')
    try {
      const bin = atob(b64)
      const u8 = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
      if (u8.length < 4 || String.fromCharCode(u8[0]!, u8[1]!, u8[2]!, u8[3]!) !== 'OggS') {
        if (alive) setErr('Kein Ogg-Container (erwartet Magic „OggS“).')
        return
      }
      const blob = new Blob([u8], { type: 'audio/ogg' })
      const u = URL.createObjectURL(blob)
      if (alive) setUrl(u)
      return () => {
        alive = false
        URL.revokeObjectURL(u)
      }
    } catch {
      if (alive) setErr('Base64/Ogg-Daten ungültig.')
    }
    return () => {
      alive = false
    }
  }, [blobBase64])

  if (err) {
    return <p className="text-xs text-amber-600 dark:text-amber-400">{err}</p>
  }

  if (!url) {
    return <p className="text-xs text-muted-foreground">Audio wird vorbereitet…</p>
  }

  return (
    <audio controls className="h-10 w-full max-w-md rounded-md" src={url} preload="metadata">
      Dein Browser unterstützt kein HTML-Audio.
    </audio>
  )
}

/**
 * MORG_LUMA_V1 / MORG_CHROMA_V1 (gleiche msgId): S/W sofort, Hinweis unter dem Bild, Fusion ersetzt Anzeige.
 * 60 s ab erster Anzeige ohne Chroma → Fehlertext. Fusion: Backend sharp `over`, sonst Canvas-Fallback.
 */
function revokeBlobUrlIfNeeded(url: string | null): void {
  if (url?.startsWith('blob:')) revokeObjectUrlSafe(url)
}

function LoRaProgressiveLumaBody({
  content,
  inboxMessages,
  selfMessage,
  copyRaw,
  copiedRaw,
}: {
  content: string
  inboxMessages: readonly Message[]
  selfMessage: Message
  copyRaw: () => void
  copiedRaw: boolean
}) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null)
  const [decErr, setDecErr] = useState<string | null>(null)
  /** Formales Parsing ok, <img> kann JPEG nicht darstellen (korrupt / kein JPEG). */
  const [imgSurfaceErr, setImgSurfaceErr] = useState<string | null>(null)
  const [chromaTimedOut, setChromaTimedOut] = useState(false)
  /** Wallclock-Start für 60 s Timeout – wird nicht bei jedem anderen Inbox-Eintrag zurückgesetzt. */
  const chromaWaitStartedAtRef = useRef<number | null>(null)

  const parsed = useMemo(() => parseLoraProgressiveMessage(content), [content])
  const msgId = parsed?.kind === 'luma' ? parsed.msgId : ''
  const caption = parsed?.kind === 'luma' ? parsed.caption : undefined
  const lumaJpeg = parsed?.kind === 'luma' ? parsed.jpeg : null

  const inboxSig = useMemo(
    () => inboxMessages.map((m) => `${m.id}:${(m.content ?? '').length}`).join('|'),
    [inboxMessages]
  )

  const hasChroma = useMemo(() => {
    if (!msgId) return false
    return (
      findPartnerChromaJpeg(inboxMessages, selfMessage.from, msgId, selfMessage.timestamp) != null
    )
  }, [inboxMessages, selfMessage.from, selfMessage.id, selfMessage.timestamp, msgId])

  useEffect(() => {
    let alive = true
    let lumaObjUrl: string | null = null
    setDecErr(null)
    setImgSurfaceErr(null)
    setDisplayUrl(null)
    const p = parseLoraProgressiveMessage(content)
    if (!p || p.kind !== 'luma' || !msgId) return
    const chroma = findPartnerChromaJpeg(
      inboxMessages,
      selfMessage.from,
      msgId,
      selfMessage.timestamp
    )
    void (async () => {
      try {
        if (chroma) {
          const u = await fuseLoraProgressivePreferSharpBackend(p.jpeg, chroma)
          if (alive) setDisplayUrl(u)
        } else {
          lumaObjUrl = uint8ToObjectUrl(p.jpeg)
          if (alive) setDisplayUrl(lumaObjUrl)
        }
      } catch (e) {
        if (alive) setDecErr(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      alive = false
      revokeObjectUrlSafe(lumaObjUrl)
    }
  }, [content, inboxSig, selfMessage.from, selfMessage.id, selfMessage.timestamp, msgId])

  useEffect(() => {
    if (!msgId) return
    const chroma = findPartnerChromaJpeg(
      inboxMessages,
      selfMessage.from,
      msgId,
      selfMessage.timestamp
    )
    if (chroma) {
      setChromaTimedOut(false)
      chromaWaitStartedAtRef.current = null
      return
    }
    if (chromaWaitStartedAtRef.current === null) {
      chromaWaitStartedAtRef.current = Date.now()
    }
    const elapsed = Date.now() - chromaWaitStartedAtRef.current
    const remaining = Math.max(0, LORA_CHROMA_WAIT_MS - elapsed)
    const t = window.setTimeout(() => setChromaTimedOut(true), remaining)
    return () => window.clearTimeout(t)
  }, [inboxSig, selfMessage.from, selfMessage.id, selfMessage.timestamp, msgId])

  if (!lumaJpeg || !msgId) {
    return (
      <p className="text-xs text-muted-foreground">LoRa Luma-Wire ungültig.</p>
    )
  }

  return (
    <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3">
      {decErr && <p className="text-xs text-red-400">{decErr}</p>}
      {imgSurfaceErr && <p className="text-xs text-amber-700 dark:text-amber-300">{imgSurfaceErr}</p>}
      {!displayUrl && !decErr && !imgSurfaceErr && (
        <p className="text-xs text-muted-foreground">Bild wird dekodiert…</p>
      )}
      {displayUrl ? (
        <div className="relative inline-block max-w-full">
          {!hasChroma ? (
            <IncompleteMediaBadge title="Nur S/W (Luma); Farbphase (Chroma) fehlt oder steht noch aus." />
          ) : null}
          <img
            src={displayUrl}
            alt={hasChroma ? 'LoRa Bild (Luma+Chroma)' : 'LoRa S/W (Luma)'}
            className="max-h-96 max-w-full rounded-lg border border-border object-contain"
            onError={() => {
              setDisplayUrl((prev) => {
                revokeBlobUrlIfNeeded(prev)
                return null
              })
              setImgSurfaceErr(
                'JPEG-Anzeige fehlgeschlagen (Datei beschädigt oder kein gültiges Bild). S/W-Export unten bleibt möglich.'
              )
            }}
          />
        </div>
      ) : null}
      {displayUrl && !hasChroma && !chromaTimedOut ? (
        <p className="text-xs text-muted-foreground">Farbübertragung läuft…</p>
      ) : null}
      {displayUrl && chromaTimedOut && !hasChroma ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Farbübertragung fehlgeschlagen – S/W-Bild angezeigt.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => downloadUint8AsFile(lumaJpeg, `lora-${msgId}-luma.jpg`)}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          S/W-Bild speichern/exportieren
        </button>
      </div>
      {caption ? (
        <p className="whitespace-pre-wrap break-words text-sm text-foreground">{caption}</p>
      ) : null}
      <button
        type="button"
        onClick={() => void copyRaw()}
        className="text-xs font-medium text-primary hover:underline"
      >
        {copiedRaw ? 'Kopiert' : 'Wire kopieren'}
      </button>
    </div>
  )
}

/** Nur sichtbar wenn kein passendes Luma in der Inbox (verwaiste Phase 2). */
function LoRaChromaOrphanBody({
  content,
  copyRaw,
  copiedRaw,
}: {
  content: string
  copyRaw: () => void
  copiedRaw: boolean
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [imgSurfaceErr, setImgSurfaceErr] = useState<string | null>(null)
  const parsed = useMemo(() => parseLoraProgressiveMessage(content), [content])
  const msgId = parsed?.kind === 'chroma' ? parsed.msgId : ''
  useEffect(() => {
    const p = parseLoraProgressiveMessage(content)
    if (!p || p.kind !== 'chroma') {
      setUrl(null)
      setImgSurfaceErr(null)
      return
    }
    setImgSurfaceErr(null)
    const u = uint8ToObjectUrl(p.jpeg)
    setUrl(u)
    return () => revokeObjectUrlSafe(u)
  }, [content])
  if (!parsed || parsed.kind !== 'chroma') {
    return <p className="text-xs text-muted-foreground">LoRa Chroma-Wire ungültig.</p>
  }
  return (
    <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3">
      <p className="text-xs text-amber-700 dark:text-amber-300">
        LoRa Farbphase ohne zugehöriges S/W (msgId {msgId}) – nur Chroma-JPEG.
      </p>
      {imgSurfaceErr ? <p className="text-xs text-amber-700 dark:text-amber-300">{imgSurfaceErr}</p> : null}
      {url ? (
        <img
          src={url}
          alt="LoRa Chroma (verwaist)"
          className="max-h-48 max-w-full rounded-lg border border-border object-contain"
          onError={() => {
            setUrl((prev) => {
              revokeBlobUrlIfNeeded(prev)
              return null
            })
            setImgSurfaceErr('Chroma-JPEG-Anzeige fehlgeschlagen — Export unten bleibt möglich.')
          }}
        />
      ) : null}
      <button
        type="button"
        onClick={() => downloadUint8AsFile(parsed.jpeg, `lora-${msgId}-chroma.jpg`)}
        className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
      >
        Chroma-JPEG speichern
      </button>
      <button
        type="button"
        onClick={() => void copyRaw()}
        className="text-xs font-medium text-primary hover:underline"
      >
        {copiedRaw ? 'Kopiert' : 'Wire kopieren'}
      </button>
    </div>
  )
}

export function ChatMessageBody({
  content,
  inboxMessages = [],
  selfMessage,
  onSarqNakWire,
}: {
  content: string
  /** Für LoRa Luma/Chroma-Zusammenführung (gleiche Inbox). */
  inboxMessages?: readonly Message[]
  /** Aktuelle Nachrichtenzeile (Absender, Zeitstempel). */
  selfMessage?: Message
  /** Optional: S-ARQ NAK über Meshtastic (`MORG_NAK_V1`). */
  onSarqNakWire?: (wire: string) => void | Promise<void>
}) {
  const raw = String(content ?? '')
  /** Anzeige: einmal voll normalisiert. Parser bekommen `raw` und probieren mehrere Varianten (JSON-Hülle, Slice ab `[[`, …). */
  const wire = useMemo(() => normalizeMessengerWireContent(raw), [content])

  const parsedImg = parseCompactImageMessage(raw)
  const parsedFile = parsedImg ? null : parseFileTxtMessage(raw)
  const parsedAudio = parsedImg || parsedFile ? null : parseMorgAudioV1Message(raw)
  const parsedTxt = parsedImg || parsedFile || parsedAudio ? null : parseCompactTextMessage(raw)
  const parsedLora =
    parsedImg || parsedFile || parsedAudio || parsedTxt ? null : parseLoraProgressiveMessage(raw)

  const looksSarqSeg = useMemo(() => messageLooksLikePath4ImageTransferWire(raw), [raw])

  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [imgIncomplete, setImgIncomplete] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState<'raw' | 'plain' | false>(false)

  useEffect(() => {
    if (!parsedImg) {
      setImgUrl(null)
      setImgIncomplete(false)
      setErr(null)
      return
    }
    let alive = true
    setImgUrl(null)
    setImgIncomplete(false)
    setErr(null)
    void reconstructCompactImageToDataUrlWithMeta(parsedImg.blobBase64)
      .then((r) => {
        if (alive) {
          setImgUrl(r.dataUrl)
          setImgIncomplete(r.incomplete)
        }
      })
      .catch((e) => {
        if (alive) setErr(e instanceof Error ? e.message : String(e))
      })
    return () => {
      alive = false
    }
  }, [parsedImg?.blobBase64, content])

  const copyRaw = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied('raw')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const copyPlainTxt = async () => {
    const body = parsedTxt?.text ?? parsedFile?.text
    if (body == null) return
    try {
      const cap = (parsedTxt?.caption ?? parsedFile?.caption)?.trim()
      const out = cap ? `${body}\n\n${cap}` : body
      await navigator.clipboard.writeText(out)
      setCopied('plain')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  if (isNftGateMessageWire(raw) || isNftGateMessageWire(wire)) {
    return (
      <NftGateMessageBody
        content={isNftGateMessageWire(wire) ? wire : raw}
        onCopyRaw={() => void copyRaw()}
        copiedRaw={copied === 'raw'}
      />
    )
  }

  if (isPassphraseMessageWire(raw) || isPassphraseMessageWire(wire)) {
    return (
      <PassphraseMessageBody
        content={isPassphraseMessageWire(wire) ? wire : raw}
        onCopyRaw={() => void copyRaw()}
        copiedRaw={copied === 'raw'}
      />
    )
  }

  if (looksSarqSeg && selfMessage) {
    return (
      <MorgSegV1ChatSink
        raw={raw}
        inboxMessages={inboxMessages}
        selfMessage={selfMessage}
        onNakWire={onSarqNakWire}
        copyRaw={copyRaw}
        copiedRaw={copied === 'raw'}
      />
    )
  }

  if (parsedImg) {
    return (
      <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3">
        {err && <p className="text-xs text-red-400">{err}</p>}
        {!imgUrl && !err && <p className="text-xs text-muted-foreground">Bild wird dekodiert…</p>}
        {imgUrl ? (
          <div className="relative inline-block max-w-full">
            {imgIncomplete ? (
              <IncompleteMediaBadge title="Nur Graustufen-WebP oder abgeschnittener Blob; Farbe/Chroma fehlt oder war defekt." />
            ) : null}
            <img
              src={imgUrl}
              alt={imgIncomplete ? 'Kompaktes Bild (Luma, unvollständig)' : 'Kompaktes Bild (Luma+Chroma)'}
              className="max-h-96 max-w-full rounded-lg border border-border object-contain"
            />
          </div>
        ) : null}
        {parsedImg.caption ? (
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">{parsedImg.caption}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {imgUrl ? (
            <button
              type="button"
              onClick={() => downloadDataUrlAsFile(imgUrl, 'morg-compact-img.jpg')}
              className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              Bild speichern
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void copyRaw()}
            className="rounded-md border border-border bg-transparent px-2.5 py-1.5 text-xs font-medium text-primary hover:underline"
          >
            {copied === 'raw' ? 'Kopiert' : 'Wire kopieren'}
          </button>
        </div>
      </div>
    )
  }

  if (parsedAudio) {
    return (
      <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
          <span className="rounded bg-primary/15 px-2 py-0.5 text-xs text-primary">Sprache</span>
          <span className="text-muted-foreground">Opus/Ogg</span>
        </div>
        <MorgAudioPlayer blobBase64={parsedAudio.blobBase64} />
        {parsedAudio.caption ? (
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">{parsedAudio.caption}</p>
        ) : null}
        <button
          type="button"
          onClick={() => void copyRaw()}
          className="text-xs font-medium text-primary hover:underline"
        >
          {copied === 'raw' ? 'Kopiert' : 'Wire kopieren'}
        </button>
      </div>
    )
  }

  if (parsedFile) {
    const lines = parsedFile.text.split('\n').length
    const speakText = parsedFile.caption?.trim()
      ? `${parsedFile.text}\n\n${parsedFile.caption.trim()}`
      : parsedFile.text
    return (
      <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="break-all text-sm font-medium text-foreground">{parsedFile.fileName}</span>
          <span className="text-xs text-muted-foreground">
            .txt · {parsedFile.text.length.toLocaleString('de-DE')} Zeichen · {lines} Zeilen
          </span>
        </div>
        <CollapsiblePlainText text={parsedFile.text} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadTextFile(parsedFile.fileName, parsedFile.text)}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            Datei speichern…
          </button>
          <TextToSpeechButton text={speakText} />
        </div>
        {parsedFile.caption ? (
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">{parsedFile.caption}</p>
        ) : null}
        <div className="flex flex-wrap gap-3 border-t border-border/60 pt-2">
          <button
            type="button"
            onClick={() => void copyRaw()}
            className="text-xs font-medium text-primary hover:underline"
          >
            {copied === 'raw' ? 'Kopiert' : 'Wire kopieren'}
          </button>
          <button
            type="button"
            onClick={() => void copyPlainTxt()}
            className="text-xs font-medium text-primary hover:underline"
          >
            {copied === 'plain' ? 'Kopiert' : 'Inhalt kopieren'}
          </button>
        </div>
      </div>
    )
  }

  if (parsedTxt) {
    const speakText = parsedTxt.caption?.trim()
      ? `${parsedTxt.text}\n\n${parsedTxt.caption.trim()}`
      : parsedTxt.text
    return (
      <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3">
        <div className="text-xs font-medium text-muted-foreground">Eingebetteter Text (MORG_TXT_V1)</div>
        <CollapsiblePlainText text={parsedTxt.text} />
        {parsedTxt.caption ? (
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">{parsedTxt.caption}</p>
        ) : null}
        <div className="flex flex-wrap gap-3 border-t border-border/60 pt-2">
          <TextToSpeechButton text={speakText} />
          <button
            type="button"
            onClick={() => void copyRaw()}
            className="text-xs font-medium text-primary hover:underline"
          >
            {copied === 'raw' ? 'Kopiert' : 'Wire kopieren'}
          </button>
          <button
            type="button"
            onClick={() => void copyPlainTxt()}
            className="text-xs font-medium text-primary hover:underline"
          >
            {copied === 'plain' ? 'Kopiert' : 'Klartext kopieren'}
          </button>
        </div>
      </div>
    )
  }

  if (parsedLora?.kind === 'luma' && selfMessage) {
    return (
      <LoRaProgressiveLumaBody
        content={raw}
        inboxMessages={inboxMessages}
        selfMessage={selfMessage}
        copyRaw={copyRaw}
        copiedRaw={copied === 'raw'}
      />
    )
  }

  if (parsedLora?.kind === 'chroma') {
    return (
      <LoRaChromaOrphanBody
        content={raw}
        copyRaw={copyRaw}
        copiedRaw={copied === 'raw'}
      />
    )
  }

  const looksLikeWire =
    wire.startsWith('[[') ||
    (wire.length > 200 && /^[A-Za-z0-9+/=\s]+$/.test(wire.slice(0, 400)))
  const hasCompactImgMarker = raw.includes('MORG_COMPACT_IMG_V1:')
  const hasCompactImgPrefix =
    raw.includes('[[MORG_COMPACT_IMG_V1:') || wire.includes('[[MORG_COMPACT_IMG_V1:')
  const hasLoraMarker =
    raw.includes('MORG_LUMA_V1:') ||
    raw.includes('MORG_CHROMA_V1:') ||
    wire.includes('[[MORG_LUMA_V1:') ||
    wire.includes('[[MORG_CHROMA_V1:')
  const hasSarqSegMarker =
    raw.includes('MORG_SEG_V1:') || wire.includes('[[MORG_SEG_V1:')
  return (
    <div className="space-y-2 rounded-lg border border-border/80 bg-muted/15 p-3">
      {hasLoraMarker ? (
        <p className="text-xs text-amber-700 dark:text-amber-300/90">
          LoRa-Bild-Wire erkannt, Dekodierung fehlgeschlagen — Länge/Base64/Ende{' '}
          <span className="font-mono">]]</span> prüfen oder Nachricht unvollständig.
        </p>
      ) : null}
      {hasCompactImgMarker ? (
        <p className="text-xs text-amber-700 dark:text-amber-300/90">
          {hasCompactImgPrefix ? (
            <>
              Kompakt-Bild erkannt, Dekodierung fehlgeschlagen — Wire oft abgeschnitten (fehlendes{' '}
              <span className="font-mono">]]</span>) oder Base64 beschädigt.
            </>
          ) : (
            <>
              Marker <span className="font-mono">MORG_COMPACT_IMG_V1</span> ohne korrektes Präfix{' '}
              <span className="font-mono">[[MORG_COMPACT_IMG_V1:</span> — Klartext vermutlich beschädigt.
            </>
          )}
        </p>
      ) : null}
      {hasSarqSegMarker ? (
        <p className="text-xs text-amber-700 dark:text-amber-300/90">
          S-ARQ-Segment-Wire erkannt, aber nicht dekodierbar — Prüfung auf vollständiges <span className="font-mono">]]</span>
          , CRC und Länge. Sonst erscheint die S-ARQ-Kachel nur auf der <strong>Leit-Zeile</strong> der Session im Posteingang.
        </p>
      ) : null}
      {!hasCompactImgMarker && !hasLoraMarker && !hasSarqSegMarker && looksLikeWire ? (
        <p className="text-xs text-amber-700 dark:text-amber-300/90">
          Inhalt wirkt wie Roh-Wire oder Base64 – kein bekannter Marker (Bild/Text/Audio). Online-Bild:{' '}
          <span className="font-mono">[[MORG_COMPACT_IMG_V1:</span> … Funk LoRa:{' '}
          <span className="font-mono">[[MORG_LUMA_V1:</span> / <span className="font-mono">[[MORG_CHROMA_V1:</span> / S-ARQ{' '}
          <span className="font-mono">[[MORG_SEG_V1:</span>.
        </p>
      ) : null}
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{wire}</p>
      <div className="flex flex-wrap gap-2">
        {!looksLikeWire ? <TextToSpeechButton text={wire} /> : null}
        <button
          type="button"
          onClick={() => void copyRaw()}
          className="text-xs font-medium text-primary hover:underline"
        >
          {copied === 'raw' ? 'Kopiert' : 'Text kopieren'}
        </button>
      </div>
    </div>
  )
}
