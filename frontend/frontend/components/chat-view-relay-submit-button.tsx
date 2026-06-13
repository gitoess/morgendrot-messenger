'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowUpCircle, CheckCircle2, Copy, Trash2, Upload, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { fetchStatus } from '@/frontend/lib/api/status'
import { sendMessage } from '@/frontend/lib/api/chat-commands'
import type { MessagingPersistenceMode } from '@/frontend/lib/messaging-persistence-mode'
import { revealVaultSignerImport } from '@/frontend/lib/api/vault-signer-import'
import {
  applyDirectIotaMnemonicSession,
  clearDirectIotaSessionSigner,
  getDirectIotaSessionSigner,
  getDirectIotaSessionSignerAddress,
} from '@/frontend/lib/direct-iota-mnemonic-session'
import {
  enqueueRelayEnvelope,
  loadTxRelayQueue,
  markRelayQueueAnchored,
  removeRelayQueueItem,
  updateRelayQueueReport,
  validateRelayEnvelope,
  type TxRelayQueueItem,
} from '@/frontend/lib/tx-relay-queue'
import { addTangleInventoryItem } from '@/frontend/lib/tangle-inventory'
import { maybeAutoSaveDigestToVault } from '@/frontend/lib/tangle-inventory-vault'
import { registerR1CourierDialogOpener, takeR1CourierPrefillPayload } from '@/frontend/lib/messenger-imperative-dialogs'

export function ChatViewRelaySubmitButton(p?: { hideMenuTrigger?: boolean }) {
  const hideMenuTrigger = p?.hideMenuTrigger === true
  const [open, setOpen] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const [rawText, setRawText] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [builderSender, setBuilderSender] = useState('')
  const [builderRecipient, setBuilderRecipient] = useState('')
  const [builderNetworkId, setBuilderNetworkId] = useState('testnet')
  const [builderTtlMinutes, setBuilderTtlMinutes] = useState('120')
  const [builderPayload, setBuilderPayload] = useState('')
  const [builderSenderSig, setBuilderSenderSig] = useState('')
  const [allowUnsignedDraft, setAllowUnsignedDraft] = useState(false)
  const [transportMode, setTransportMode] = useState<MessagingPersistenceMode>('event')
  const [showExpertTransport, setShowExpertTransport] = useState(false)
  const [showExpertForwarding, setShowExpertForwarding] = useState(false)
  const [expertQueueItemId, setExpertQueueItemId] = useState<string | null>(null)
  const [mnemoInput, setMnemoInput] = useState('')
  const [showManualSignerInput, setShowManualSignerInput] = useState(false)
  const [sessionSignerAddr, setSessionSignerAddr] = useState<string | null>(null)
  const [signerHint, setSignerHint] = useState<string | null>(null)
  const [signerMode, setSignerMode] = useState<string>('unknown')
  const [signerConfigSource, setSignerConfigSource] = useState<'env' | 'runtime' | 'unknown'>('unknown')
  const [knownAddressSuggestions, setKnownAddressSuggestions] = useState<string[]>([])

  const items = useMemo(() => {
    void refreshTick
    return loadTxRelayQueue()
  }, [refreshTick])

  const refresh = useCallback(() => setRefreshTick((x) => x + 1), [])

  const hexToBytes = (hex: string): Uint8Array => {
    const h = hex.trim().toLowerCase()
    if (!/^[a-f0-9]+$/.test(h) || h.length % 2 !== 0) throw new Error('Ungültiges Hex.')
    const out = new Uint8Array(h.length / 2)
    for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(h.slice(i * 2, i * 2 + 2), 16)
    return out
  }

  const sha256HexUtf8 = async (input: string): Promise<string> => {
    const data = new TextEncoder().encode(input)
    const digest = await crypto.subtle.digest('SHA-256', data)
    const arr = Array.from(new Uint8Array(digest))
    return arr.map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  const buildEnvelope = async () => {
    setMsg(null)
    const sender = builderSender.trim()
    if (!/^0x[a-fA-F0-9]{64}$/.test(sender)) {
      setMsg('Builder: sender muss eine gültige 0x-Adresse sein.')
      return
    }
    const recipient = builderRecipient.trim()
    if (recipient && !/^0x[a-fA-F0-9]{64}$/.test(recipient)) {
      setMsg('Builder: Empfängeradresse muss leer oder gültige 0x-Adresse sein.')
      return
    }
    const payload = builderPayload.trim()
    if (!payload) {
      setMsg('Builder: Nachricht fehlt.')
      return
    }
    const senderSig = builderSenderSig.trim()
    if (!senderSig && !allowUnsignedDraft) {
      setMsg('Bitte zuerst „Digest signieren“ ausführen (oder Entwurf explizit als unsigniert erlauben).')
      return
    }
    const ttlMin = Math.min(1440, Math.max(1, Number.parseInt(builderTtlMinutes, 10) || 120))
    const createdAt = Date.now()
    const expiresAt = createdAt + ttlMin * 60_000
    const nonce = `${createdAt}-${Math.random().toString(36).slice(2, 10)}`
    const payloadHash = await sha256HexUtf8(payload)
    const envelope = {
      version: 'MORG_TX_RELAY_V1' as const,
      mode: 'submit_ready' as const,
      networkId: builderNetworkId.trim() || 'testnet',
      sender,
      createdAt,
      expiresAt,
      nonce,
      payloadEncoding: 'base64',
      payload,
      payloadHash,
      senderSig: senderSig || 'UNSIGNED_PLACEHOLDER',
      recipient: recipient || undefined,
    }
    const asJson = JSON.stringify(envelope, null, 2)
    setRawText(asJson)
    const item = enqueueRelayEnvelope(envelope)
    if ((envelope.senderSig || '').trim() === 'UNSIGNED_PLACEHOLDER') {
      updateRelayQueueReport(item.id, {
        rpcStatus: 'error',
        errorCode: 'DRAFT_UNSIGNED',
        note: 'Eigenentwurf ohne Signatur: für Transport/Review, Submit erst nach Signierung.',
        statusOverride: 'draft_unsigned',
      })
      refresh()
      setMsg('Paket erzeugt und automatisch als Entwurf in die lokale Warteliste übernommen.')
      return
    }
    refresh()
    setMsg('Paket erzeugt und automatisch in die lokale Warteliste übernommen.')
  }

  const markSubmittedByEnvelope = (rawEnvelopeJson: string, noteSuffix: string) => {
    try {
      const parsed = JSON.parse(rawEnvelopeJson)
      const v = validateRelayEnvelope(parsed)
      if (!v.ok) return
      const target = loadTxRelayQueue().find(
        (x) =>
          x.envelope.nonce === v.envelope.nonce &&
          x.envelope.sender.toLowerCase() === v.envelope.sender.toLowerCase()
      )
      if (!target) return
      const prev = (target.relayReport?.note || '').trim()
      const nextNote = prev ? `${prev}\n${noteSuffix}` : noteSuffix
      updateRelayQueueReport(target.id, {
        rpcStatus: 'submitted',
        note: nextNote,
      })
      refresh()
    } catch {
      // ignore auto-mark errors for helper paths
    }
  }

  const sendEnvelopeAsText = async () => {
    const rec = builderRecipient.trim()
    if (!/^0x[a-fA-F0-9]{64}$/.test(rec)) {
      setMsg('Für Event/Mailbox-Test bitte eine gültige Empfängeradresse setzen.')
      return
    }
    if (!rawText.trim()) {
      setMsg('Bitte zuerst ein Paket erzeugen.')
      return
    }
    const r = await sendMessage(rec, rawText, false, { messagingPersistenceMode: transportMode })
    if (r.ok) {
      markSubmittedByEnvelope(
        rawText,
        `Auto: weitergegeben über Experten-Transport (${transportMode === 'mailbox' ? 'Mailbox' : 'Event'}).`
      )
      setMsg(
        transportMode === 'mailbox'
          ? 'Paket als Klartext über Mailbox gesendet.'
          : 'Paket als Klartext-Event gesendet.'
      )
    } else {
      setMsg(r.error || r.message || 'Senden fehlgeschlagen.')
    }
  }

  const sendToLoraShortcut = async () => {
    if (!rawText.trim()) {
      setMsg('Bitte zuerst ein Paket erzeugen.')
      return
    }
    try {
      await navigator.clipboard.writeText(rawText)
      setMsg(
        'Paket für LoRa vorbereitet: JSON ist in der Zwischenablage. Jetzt im normalen Chat „funk“ wählen und als Klartext senden.'
      )
    } catch {
      setMsg('Zwischenablage nicht verfügbar. JSON manuell kopieren und über Funk senden.')
    }
  }

  const signDigestMerged = async () => {
    setMsg(null)
    setSessionSignerAddr(getDirectIotaSessionSignerAddress())
    const sender = builderSender.trim().toLowerCase()
    if (!/^0x[a-fA-F0-9]{64}$/.test(sender)) {
      setMsg('Bitte zuerst eine gültige sender-Adresse setzen.')
      return
    }
    const payload = builderPayload.trim()
    if (!payload) {
      setMsg('Bitte zuerst eine Nachricht eingeben.')
      return
    }
    let signer = getDirectIotaSessionSigner() as unknown as {
      signPersonalMessage?: (msg: Uint8Array) => Promise<{ signature?: string }>
    } | null
    if ((!signer || typeof signer.signPersonalMessage !== 'function') && signerMode === 'cli' && !mnemoInput.trim()) {
      const m =
        'SIGNER=cli aktiv: Automatischer Tresor-Import ist deaktiviert. Bitte „Anderen Signer verwenden“ öffnen oder als unsignierten Entwurf fortfahren.'
      setMsg(m)
      setSignerHint(m)
      return
    }
    if (!signer || typeof signer.signPersonalMessage !== 'function') {
      const rawMn = mnemoInput.trim()
      if (rawMn) {
        const applied = applyDirectIotaMnemonicSession(mnemoInput)
        if (!applied.ok) {
          setMsg(applied.error)
          setSignerHint(applied.error)
          return
        }
        setSessionSignerAddr(applied.address)
        setMnemoInput('')
        setSignerHint(`Signer geladen: ${applied.address.slice(0, 10)}…`)
        signer = getDirectIotaSessionSigner() as unknown as {
          signPersonalMessage?: (msg: Uint8Array) => Promise<{ signature?: string }>
        } | null
      } else {
        const wantVault = window.confirm(
          'Kein aktiver Signer in dieser Session.\n\nJetzt aus dem Tresor laden und danach direkt signieren?'
        )
        if (!wantVault) {
          const m =
            'Kein aktiver Signer gefunden. Klicke „Signer aus Tresor laden“ oder nutze optional „Anderen Signer verwenden“.'
          setMsg(m)
          setSignerHint(m)
          return
        }
        const pw = window.prompt('Vault-Passwort:')
        if (!pw) return
        const r = await revealVaultSignerImport(pw)
        if (!r.ok || !r.signerImport?.trim()) {
          const base = r.error || r.message || 'Signer konnte nicht aus dem Tresor geladen werden.'
          const m = `${base} Bitte unten „Anderen Signer verwenden“ öffnen und Mnemonic/Secret eintragen.`
          setMsg(m)
          setSignerHint(m)
          setShowManualSignerInput(true)
          return
        }
        const applied = applyDirectIotaMnemonicSession(r.signerImport)
        if (!applied.ok) {
          setMsg(applied.error)
          setSignerHint(applied.error)
          return
        }
        setSessionSignerAddr(applied.address)
        setSignerHint(`Signer geladen: ${applied.address.slice(0, 10)}…`)
        signer = getDirectIotaSessionSigner() as unknown as {
          signPersonalMessage?: (msg: Uint8Array) => Promise<{ signature?: string }>
        } | null
      }
      if (!signer || typeof signer.signPersonalMessage !== 'function') {
        setMsg('Signer konnte nicht geladen werden.')
        setSignerHint('Signer konnte nicht geladen werden.')
        return
      }
    }
    const signerAddr = (getDirectIotaSessionSignerAddress() || '').trim().toLowerCase()
    if (signerAddr && signerAddr !== sender) {
      setMsg(`Signer-Adresse passt nicht zum Sender.\nSigner: ${signerAddr}\nSender: ${sender}`)
      return
    }
    try {
      const digestHex = await sha256HexUtf8(payload)
      const digestBytes = hexToBytes(digestHex)
      const res = await signer.signPersonalMessage(digestBytes)
      const sig = String(res?.signature ?? '').trim()
      if (!sig) {
        setMsg('Signatur fehlgeschlagen.')
        return
      }
      setBuilderSenderSig(sig)
      setAllowUnsignedDraft(false)
      setMsg('Digest signiert. Beim Erzeugen wird senderSig genutzt.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    }
  }

  const loadSignerFromVault = async () => {
    if (signerMode === 'cli') {
      const m =
        'Signer-Modus ist CLI. „Signer aus Tresor laden“ geht nur mit SIGNER=sdk. Bitte „Anderen Signer verwenden“ nutzen oder unsignierten Entwurf erlauben.'
      setMsg(m)
      setSignerHint(m)
      return
    }
    const pw = window.prompt('Vault-Passwort eingeben, um den Signer in diese Session zu laden:')
    if (!pw) return
    const r = await revealVaultSignerImport(pw)
    if (!r.ok || !r.signerImport?.trim()) {
      const base = r.error || r.message || 'Signer konnte nicht aus dem Tresor geladen werden.'
      const m = `${base} Bitte unten „Anderen Signer verwenden“ öffnen und Mnemonic/Secret eintragen.`
      setMsg(m)
      setSignerHint(m)
      setShowManualSignerInput(true)
      return
    }
    const applied = applyDirectIotaMnemonicSession(r.signerImport)
    if (!applied.ok) {
      setMsg(applied.error)
      setSignerHint(applied.error)
      return
    }
    setSessionSignerAddr(applied.address)
    setMnemoInput('')
    const okMsg = `Signer geladen: ${applied.address.slice(0, 10)}…`
    setMsg(okMsg)
    setSignerHint(okMsg)
  }

  const openR1Dialog = useCallback(() => {
    const pf = takeR1CourierPrefillPayload()
    if (pf) {
      if (pf.builderSender?.trim()) setBuilderSender(pf.builderSender.trim())
      if (pf.builderRecipient != null) setBuilderRecipient(String(pf.builderRecipient).trim())
      if (pf.builderPayload != null) setBuilderPayload(String(pf.builderPayload))
    }
    void fetchStatus().then((s) => {
      if ('network' in s && typeof s.network === 'string' && s.network.trim()) {
        setBuilderNetworkId(s.network.trim())
      }
      if ('signer' in s && typeof s.signer === 'string' && s.signer.trim()) {
        setSignerMode(s.signer.trim().toLowerCase())
      } else {
        setSignerMode('unknown')
      }
      if ('signerConfigSource' in s && (s.signerConfigSource === 'env' || s.signerConfigSource === 'runtime')) {
        setSignerConfigSource(s.signerConfigSource)
      } else {
        setSignerConfigSource('unknown')
      }
      const next = new Set<string>()
      const own = 'myAddress' in s && typeof s.myAddress === 'string' ? s.myAddress.trim() : ''
      if (/^0x[a-fA-F0-9]{64}$/.test(own)) next.add(own)
      if ('connectedAddresses' in s && Array.isArray(s.connectedAddresses)) {
        for (const a of s.connectedAddresses) {
          const t = String(a || '').trim()
          if (/^0x[a-fA-F0-9]{64}$/.test(t)) next.add(t)
        }
      }
      setKnownAddressSuggestions(Array.from(next))
    })
    setSessionSignerAddr(getDirectIotaSessionSignerAddress())
    refresh()
    setOpen(true)
  }, [refresh])

  useEffect(() => {
    registerR1CourierDialogOpener(() => {
      openR1Dialog()
    })
    return () => registerR1CourierDialogOpener(null)
  }, [openR1Dialog])

  const onImport = () => {
    setMsg(null)
    let parsed: unknown
    try {
      parsed = JSON.parse(rawText)
    } catch {
      setMsg('Ungültiges JSON.')
      return
    }
    const v = validateRelayEnvelope(parsed)
    if (!v.ok) {
      setMsg(v.error)
      return
    }
    if (v.envelope.mode !== 'submit_ready') {
      setMsg('Dieses Paketformat wird aktuell noch nicht unterstützt (nur R1-Standardpaket ist aktiv).')
      return
    }
    const item = enqueueRelayEnvelope(v.envelope)
    setBuilderSender(v.envelope.sender)
    setBuilderRecipient(v.envelope.recipient ?? '')
    setBuilderPayload(v.envelope.payload)
    setBuilderSenderSig(v.envelope.senderSig ?? '')
    setBuilderTtlMinutes(String(Math.max(1, Math.round((v.envelope.expiresAt - v.envelope.createdAt) / 60000))))
    if ((v.envelope.senderSig || '').trim() === 'UNSIGNED_PLACEHOLDER') {
      updateRelayQueueReport(item.id, {
        rpcStatus: 'error',
        errorCode: 'DRAFT_UNSIGNED',
        note: 'Eigenentwurf ohne Signatur: für Transport/Review, Submit erst nach Signierung.',
        statusOverride: 'draft_unsigned',
      })
      refresh()
      setMsg('Paket als Entwurf übernommen (ohne Signatur). Das ist im Auto-Modus erwartet.')
      return
    }
    refresh()
    setMsg(`Paket übernommen. Lokaler Status: ${item.status}.`)
  }

  const markAnchored = async (it: TxRelayQueueItem) => {
    const fromReport = (it.relayReport?.note || '').match(/0x[a-fA-F0-9]{64}/)?.[0]
    let digest = (fromReport || it.txDigest || '').trim()
    if (!digest) {
      const asked = window.prompt('Nachweis (txDigest) einfügen (0x...)')
      if (!asked) return
      digest = asked.trim()
    } else {
      const ok = window.confirm(`Gefundenen txDigest verwenden?\n\n${digest}`)
      if (!ok) {
        const asked = window.prompt('Anderen txDigest einfügen (0x...)', digest)
        if (!asked) return
        digest = asked.trim()
      }
    }
    if (!/^0x[a-fA-F0-9]{64}$/.test(digest)) {
      setMsg('Ungültiger txDigest. Erwartet: 0x + 64 Hex.')
      return
    }
    markRelayQueueAnchored(it.id, digest)
    const inv = {
      digest,
      type: 'text' as const,
      status: 'anchored' as const,
      origin: 'relay' as const,
      timestamp: Date.now(),
    }
    addTangleInventoryItem(inv)
    await maybeAutoSaveDigestToVault(inv)
    refresh()
    setMsg('Als anchored markiert und Digest ins Inventory übernommen.')
  }

  const updateReportSimple = (it: TxRelayQueueItem, rpcStatus: 'submitted' | 'reject' | 'error') => {
    const needsDetail = rpcStatus === 'reject' || rpcStatus === 'error'
    let note = needsDetail
      ? (window.prompt('Kurzgrund (optional):', it.relayReport?.note ?? '') ?? '').trim()
      : (it.relayReport?.note || '').trim()
    if (rpcStatus === 'submitted') {
      const digestInput =
        window.prompt(
          'Optional: txDigest einfügen, falls der Relayer ihn bereits geliefert hat (0x...).',
          it.txDigest || ''
        ) ?? ''
      const digest = digestInput.trim()
      if (digest) {
        if (!/^0x[a-fA-F0-9]{64}$/.test(digest)) {
          setMsg('Ungültiger txDigest. Erwartet: 0x + 64 Hex.')
          return
        }
        note = note ? `${note}\n${digest}` : digest
      }
    }
    updateRelayQueueReport(it.id, {
      rpcStatus,
      errorCode: rpcStatus === 'submitted' ? undefined : it.relayReport?.errorCode,
      note: note || undefined,
    })
    refresh()
    setMsg(`Relay-Protokoll: ${rpcStatus}.`)
  }

  return (
    <>
      {hideMenuTrigger ? null : (
        <button
          type="button"
          onClick={openR1Dialog}
          className="w-full rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-sm hover:bg-accent"
        >
          R1 Kurier-Paket (Beta)
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>R1 Kurier-Paket (Offline {'->'} Relayer {'->'} Submit)</DialogTitle>
            <DialogDescription>Kurier-Paket für den Offline/Relay-Workflow.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border/70 bg-muted/10 p-3 text-xs">
            <p className="font-medium text-foreground">Ablauf</p>
            <ol className="mt-1 list-decimal space-y-1 pl-4 text-muted-foreground">
              <li>Paket erzeugen (und bei Bedarf Digest signieren).</li>
              <li>Paket lokal übernehmen (Queue) und Relayer-Ergebnis setzen.</li>
              <li>Nachweis in den Tangle übernehmen.</li>
              <li>Paket optional weitergeben (LoRa/Copy/Export).</li>
            </ol>
          </div>
          <div className="space-y-2 rounded-lg border border-border/70 bg-muted/10 p-3">
            <p className="text-xs font-medium text-foreground">Schritt 1: Paket erzeugen</p>
            <div className="grid gap-2 md:grid-cols-2">
              <input
                value={builderSender}
                onChange={(e) => setBuilderSender(e.target.value)}
                list="r1-known-addresses"
                placeholder="sender (0x...)"
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const addr = (getDirectIotaSessionSignerAddress() || '').trim()
                  if (!addr) {
                    setMsg('Kein aktiver Signer vorhanden.')
                    return
                  }
                  setBuilderSender(addr)
                  setMsg('Sender auf aktive Signer-Adresse gesetzt.')
                }}
              >
                Sender = aktiver Signer
              </Button>
              <input
                value={builderRecipient}
                onChange={(e) => setBuilderRecipient(e.target.value)}
                list="r1-known-addresses"
                placeholder="Empfänger (optional 0x...)"
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono"
              />
              <datalist id="r1-known-addresses">
                {knownAddressSuggestions.map((addr) => (
                  <option key={addr} value={addr} />
                ))}
              </datalist>
              <label className="rounded-md border border-border bg-background px-2 py-1.5 text-xs">
                TTL (max 24h)
                <select
                  value={builderTtlMinutes}
                  onChange={(e) => setBuilderTtlMinutes(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                >
                  <option value="30">30 Minuten (kurz)</option>
                  <option value="120">2 Stunden (empfohlen)</option>
                  <option value="360">6 Stunden</option>
                  <option value="720">12 Stunden</option>
                  <option value="1440">24 Stunden (maximal)</option>
                </select>
              </label>
              <div className="rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs">
                Sender-Signatur wird automatisch gesetzt (Digest-Signieren) oder aus importiertem Paket übernommen.
              </div>
            </div>
            <textarea
              value={builderPayload}
              onChange={(e) => setBuilderPayload(e.target.value)}
              rows={3}
              placeholder="Nachrichtentext (wird intern als submit-ready Datenblock gespeichert)"
              className="w-full rounded-md border border-border bg-background px-2 py-2 text-xs font-mono"
            />
            <div className="rounded-md border border-border/70 bg-muted/20 p-2 text-xs">
              <p className="text-xs font-medium text-foreground">Session-Signer (nur RAM)</p>
              <div className="mt-1 inline-flex items-center rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-foreground">
                Signer-Modus: {signerMode === 'cli' ? 'Legacy CLI' : signerMode === 'sdk' ? 'SDK (empfohlen)' : 'unbekannt'}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Quelle: {signerConfigSource === 'runtime' ? 'Runtime-Konfig' : signerConfigSource === 'env' ? '.env' : 'unbekannt'}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Standard: aktiver Session-Signer wird automatisch genutzt. Nur falls für eine andere Adresse signiert werden soll, unten manuell eingeben.
              </p>
              {signerMode === 'cli' ? (
                <p className="mt-1 text-[11px] text-amber-600">
                  Diese Instanz läuft mit SIGNER=cli. Tresor-Import für den Signer ist hier nicht verfügbar.
                </p>
              ) : null}
              {sessionSignerAddr ? (
                <p className="mt-1 font-mono text-[11px] text-emerald-600">Aktiver Signer: {sessionSignerAddr}</p>
              ) : (
                <p className="mt-1 text-[11px] text-amber-600">Kein Session-Signer aktiv.</p>
              )}
              <button
                type="button"
                className="mt-2 text-[11px] text-muted-foreground underline underline-offset-2"
                onClick={() => setShowManualSignerInput((v) => !v)}
              >
                {showManualSignerInput ? 'Manuelle Signer-Eingabe ausblenden' : 'Anderen Signer verwenden (optional)'}
              </button>
              {showManualSignerInput ? (
                <textarea
                  value={mnemoInput}
                  onChange={(e) => setMnemoInput(e.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                  rows={2}
                  placeholder="Mnemonic / Bech32-Secret / 64-Hex (32 Byte)"
                  className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px]"
                />
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="default" onClick={() => void signDigestMerged()}>
                  Digest signieren
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void loadSignerFromVault()}
                  disabled={signerMode === 'cli'}
                >
                  Signer aus Tresor laden
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    clearDirectIotaSessionSigner()
                    setSessionSignerAddr(null)
                    setMsg('Session-Signer gelöscht.')
                  }}
                >
                  Signer löschen
                </Button>
                <span className="text-xs text-muted-foreground">
                  {builderSenderSig ? `senderSig gesetzt (${builderSenderSig.slice(0, 12)}…)` : 'Noch keine Signatur.'}
                </span>
                <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={allowUnsignedDraft}
                    onChange={(e) => setAllowUnsignedDraft(e.target.checked)}
                  />
                  unsignierten Entwurf erlauben
                </label>
              </div>
              {signerHint ? (
                <p className="mt-2 rounded-md border border-border/60 bg-background px-2 py-1.5 text-[11px] text-foreground">
                  {signerHint}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => void buildEnvelope()}>
                <WandSparkles className="mr-2 h-3.5 w-3.5" />
                Paket erzeugen
              </Button>
            </div>
          </div>
          <div className="space-y-2 rounded-lg border border-border/70 bg-muted/10 p-3">
            <p className="text-xs font-medium text-foreground">Schritt 2: Paket im lokalen Ablauf übernehmen</p>
            <p className="text-[11px] text-muted-foreground">
                Hier landet das erzeugte oder empfangene Paket in der lokalen R1-Warteliste.
            </p>
            <div className="rounded-md border border-border/70 bg-muted/20 p-2 text-xs">
              <button
                type="button"
                className="text-xs text-muted-foreground underline underline-offset-2"
                onClick={() => setShowExpertTransport((v) => !v)}
              >
                {showExpertTransport
                  ? 'Experten-Transport ausblenden'
                  : 'Experten-Transport anzeigen (nur Debug: Paket als Chat-Text)'}
              </button>
              {showExpertTransport ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">Nur Debug/Bypass: Paket als Klartext-Chat senden:</span>
                  <select
                    value={transportMode}
                    onChange={(e) => setTransportMode((e.target.value as MessagingPersistenceMode) || 'event')}
                    className="rounded-md border border-border bg-background px-2 py-1"
                  >
                    <option value="event">Event (flüchtig)</option>
                    <option value="mailbox">Mailbox (persistenter)</option>
                  </select>
                  <Button type="button" size="sm" variant="outline" onClick={() => void sendEnvelopeAsText()}>
                    Paket als Text senden
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
          <div className="space-y-2 rounded-lg border border-border/70 bg-muted/10 p-3">
            <p className="text-xs font-medium text-foreground">Optional: Paket von Funk/Relayer uebernehmen</p>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={6}
              placeholder='Kurier-Paket JSON importieren (z. B. vom Relayer/Funkweg)'
              className="w-full rounded-md border border-border bg-background px-2 py-2 text-xs font-mono"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onImport}>
                <Upload className="mr-2 h-3.5 w-3.5" />
                Externes Paket prüfen & übernehmen
              </Button>
            </div>
            {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">Schritt 3: Nachweis / Tangle</p>
            <p className="text-[11px] text-muted-foreground">
              Erst „Relayer: erfolgreich gesendet“ setzen, wenn dein Paket den Relayer wirklich verlassen hat. Danach
              bei vorhandener TX den Button „In Tangle uebernehmen“ nutzen.
            </p>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine R1-Pakete in der lokalen Warteliste.</p>
            ) : (
              items.map((it) => (
                <div key={it.id} className="rounded-lg border border-border/70 bg-muted/10 p-3">
                  <p className="text-sm font-medium">
                    {it.status} · nonce {it.envelope.nonce}
                  </p>
                  <p className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground">
                    {it.envelope.sender} {'->'} {it.envelope.networkId}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Ablauf: {new Date(it.envelope.expiresAt).toLocaleString('de-DE')}
                    {it.txDigest ? ` · tx ${it.txDigest}` : ''}
                  </p>
                  {it.relayReport ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Relayer-Status: {it.relayReport.rpcStatus ?? '—'}
                      {it.relayReport.errorCode ? ` · ${it.relayReport.errorCode}` : ''}
                      {it.relayReport.note ? ` · ${it.relayReport.note}` : ''}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => updateReportSimple(it, 'submitted')}>
                      Relayer: erfolgreich gesendet
                    </Button>
                    {it.status !== 'anchored' ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => void markAnchored(it)}>
                        <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                        In Tangle uebernehmen
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!window.confirm('Diesen Eintrag aus der lokalen Relay-Warteliste löschen?')) return
                        removeRelayQueueItem(it.id)
                        refresh()
                        setMsg('Eintrag aus der lokalen Warteliste gelöscht.')
                      }}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Eintrag löschen
                    </Button>
                  </div>
                  <button
                    type="button"
                    className="mt-2 text-xs text-muted-foreground underline underline-offset-2"
                    onClick={() => setExpertQueueItemId((cur) => (cur === it.id ? null : it.id))}
                  >
                    {expertQueueItemId === it.id ? 'Expertenaktionen ausblenden' : 'Expertenaktionen anzeigen'}
                  </button>
                  {expertQueueItemId === it.id ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => updateReportSimple(it, 'reject')}>
                        Relayer: abgelehnt (reject)
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => updateReportSimple(it, 'error')}>
                        Relayer: Fehler (error)
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Expertenmodus: nur nutzen, wenn der Relayer ein reject/error gemeldet hat. Wenn in der Notiz ein
                        0x-Digest steht, wird er bei „In Tangle uebernehmen“ automatisch vorgeschlagen.
                      </span>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
          <div className="space-y-2 rounded-lg border border-border/70 bg-muted/10 p-3">
            <p className="text-xs font-medium text-foreground">Schritt 4: Paket weitergeben (optional)</p>
            <p className="text-[11px] text-muted-foreground">
              Für LoRa, E-Mail, SD oder andere Übergabewege: fertig erzeugtes Paket einmal kopieren.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (!rawText.trim()) {
                    setMsg('Bitte zuerst ein Paket erzeugen oder importieren.')
                    return
                  }
                  try {
                    await navigator.clipboard.writeText(rawText)
                    setMsg('Paket für Weitergabe in Zwischenablage kopiert.')
                  } catch {
                    setMsg('Kopieren fehlgeschlagen.')
                  }
                }}
              >
                <Copy className="mr-2 h-3.5 w-3.5" />
                Paket kopieren (Weitergabe)
              </Button>
            </div>
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-2"
              onClick={() => setShowExpertForwarding((v) => !v)}
            >
              {showExpertForwarding ? 'Experten-Weitergabe ausblenden' : 'Experten-Weitergabe anzeigen'}
            </button>
            {showExpertForwarding ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => void sendToLoraShortcut()}>
                  LoRa-Weitergabe Hinweis
                </Button>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setOpen(false)}>
              <ArrowUpCircle className="mr-2 h-4 w-4" />
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
