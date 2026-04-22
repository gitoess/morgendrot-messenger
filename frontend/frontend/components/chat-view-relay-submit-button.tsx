'use client'

import { useMemo, useState } from 'react'
import { ArrowUpCircle, CheckCircle2, Copy, Upload, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { fetchStatus } from '@/frontend/lib/api/status'
import { sendMessage } from '@/frontend/lib/api/chat-commands'
import type { MessagingPersistenceMode } from '@/frontend/lib/messaging-persistence-mode'
import { getDirectIotaSessionSigner, getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import {
  enqueueRelayEnvelope,
  loadTxRelayQueue,
  markRelayQueueAnchored,
  updateRelayQueueReport,
  validateRelayEnvelope,
  type TxRelayQueueItem,
} from '@/frontend/lib/tx-relay-queue'
import { addTangleInventoryItem } from '@/frontend/lib/tangle-inventory'
import { maybeAutoSaveDigestToVault } from '@/frontend/lib/tangle-inventory-vault'

export function ChatViewRelaySubmitButton() {
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
  const [transportMode, setTransportMode] = useState<MessagingPersistenceMode>('event')
  const [showExpertTransport, setShowExpertTransport] = useState(false)
  const [showExpertQueueActions, setShowExpertQueueActions] = useState(false)

  const items = useMemo(() => {
    void refreshTick
    return loadTxRelayQueue()
  }, [refreshTick])

  const refresh = () => setRefreshTick((x) => x + 1)

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
      setMsg('Builder: payload fehlt.')
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
      senderSig: builderSenderSig.trim() || 'UNSIGNED_PLACEHOLDER',
      recipient: recipient || undefined,
    }
    const asJson = JSON.stringify(envelope, null, 2)
    setRawText(asJson)
    setMsg(
      envelope.senderSig === 'UNSIGNED_PLACEHOLDER'
        ? 'Envelope als Eigen-Entwurf erzeugt. Signatur folgt im echten Sendepfad (RAM-Vault/Signer).'
        : 'Envelope erzeugt und in die Import-Box übernommen.'
    )
  }

  const sendEnvelopeAsText = async () => {
    const rec = builderRecipient.trim()
    if (!/^0x[a-fA-F0-9]{64}$/.test(rec)) {
      setMsg('Für Event/Mailbox-Test bitte eine gültige Empfängeradresse setzen.')
      return
    }
    if (!rawText.trim()) {
      setMsg('Bitte zuerst Envelope erzeugen.')
      return
    }
    const r = await sendMessage(rec, rawText, false, { messagingPersistenceMode: transportMode })
    if (r.ok) {
      setMsg(
        transportMode === 'mailbox'
          ? 'Envelope als Klartext über Mailbox gesendet.'
          : 'Envelope als Klartext-Event gesendet.'
      )
    } else {
      setMsg(r.error || r.message || 'Senden fehlgeschlagen.')
    }
  }

  const sendToLoraShortcut = async () => {
    if (!rawText.trim()) {
      setMsg('Bitte zuerst Envelope erzeugen.')
      return
    }
    try {
      await navigator.clipboard.writeText(rawText)
      setMsg(
        'Envelope für LoRa vorbereitet: JSON ist in der Zwischenablage. Jetzt im normalen Chat „funk“ wählen und als Klartext senden.'
      )
    } catch {
      setMsg('Zwischenablage nicht verfügbar. JSON manuell kopieren und über Funk senden.')
    }
  }

  const signDigestNow = async () => {
    setMsg(null)
    const sender = builderSender.trim().toLowerCase()
    if (!/^0x[a-fA-F0-9]{64}$/.test(sender)) {
      setMsg('Bitte zuerst eine gültige sender-Adresse setzen.')
      return
    }
    const payload = builderPayload.trim()
    if (!payload) {
      setMsg('Bitte zuerst Nachricht/Payload eingeben.')
      return
    }
    const signer = getDirectIotaSessionSigner() as unknown as {
      signPersonalMessage?: (msg: Uint8Array) => Promise<{ signature?: string }>
    } | null
    const signerAddr = (getDirectIotaSessionSignerAddress() || '').trim().toLowerCase()
    if (!signer || typeof signer.signPersonalMessage !== 'function') {
      setMsg('Kein Session-Signer im RAM. In Einstellungen zuerst Signer anwenden.')
      return
    }
    if (signerAddr && signerAddr !== sender) {
      setMsg('Signer-Adresse passt nicht zu sender. Bitte sender oder Session-Signer korrigieren.')
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
      setMsg('Digest mit Session-Signer signiert. Beim Erzeugen wird senderSig genutzt.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    }
  }

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
      setMsg('Aktuell nur R1 submit_ready aktiv. R2 sponsored ist bewusst Backlog.')
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
      setMsg('Envelope als Draft übernommen (ohne Signatur). Das ist im Auto-Modus erwartet.')
      return
    }
    refresh()
    setMsg(`Envelope übernommen (${item.status}).`)
  }

  const markAnchored = async (it: TxRelayQueueItem) => {
    const digest = window.prompt('Nachweis (txDigest) aus Submit-Antwort einfügen (0x...)')
    if (!digest) return
    markRelayQueueAnchored(it.id, digest.trim())
    const inv = {
      digest: digest.trim(),
      type: 'text' as const,
      status: 'anchored' as const,
      timestamp: Date.now(),
    }
    addTangleInventoryItem(inv)
    await maybeAutoSaveDigestToVault(inv)
    refresh()
    setMsg('Als anchored markiert und Digest ins Inventory übernommen.')
  }

  const updateReport = (it: TxRelayQueueItem) => {
    const rpcStatusRaw = window.prompt('RPC-Status (submitted | reject | error):', it.relayReport?.rpcStatus ?? 'submitted')
    if (!rpcStatusRaw) return
    const rpcStatus = rpcStatusRaw.trim() as 'submitted' | 'reject' | 'error'
    if (rpcStatus !== 'submitted' && rpcStatus !== 'reject' && rpcStatus !== 'error') {
      setMsg('Ungültiger RPC-Status.')
      return
    }
    const errorCode = window.prompt('Fehlercode (optional, z. B. ERR_RPC_SUBMIT_FAILED):', it.relayReport?.errorCode ?? '') ?? ''
    const note = window.prompt('Notiz / RPC-Antwort (optional):', it.relayReport?.note ?? '') ?? ''
    updateRelayQueueReport(it.id, { rpcStatus, errorCode: errorCode.trim() || undefined, note: note.trim() || undefined })
    refresh()
    setMsg('Relay-Protokoll aktualisiert.')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void fetchStatus().then((s) => {
            if ('network' in s && typeof s.network === 'string' && s.network.trim()) {
              setBuilderNetworkId(s.network.trim())
            }
          })
          refresh()
          setOpen(true)
        }}
        className="w-full rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-sm hover:bg-accent"
      >
        R1 Kurier-Paket (Beta)
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>R1 Kurier-Paket (Offline {'->'} Relayer {'->'} Submit)</DialogTitle>
            <DialogDescription>
              Erstellen, transportieren und lokal protokollieren. `txDigest` entsteht erst nach echtem Submit an eine IOTA-RPC
              Node (durch Relayer oder dich selbst online).
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Fokus jetzt: R1 `submit_ready`. R2 sponsored bleibt bewusst später. Diese Ansicht dient dem kontrollierten
            Offline/Relay-Workflow mit manueller Bestätigung.
          </p>
          <div className="space-y-2 rounded-lg border border-border/70 bg-muted/10 p-3">
            <p className="text-xs font-medium text-foreground">Paket erzeugen (offline)</p>
            <div className="grid gap-2 md:grid-cols-2">
              <input
                value={builderSender}
                onChange={(e) => setBuilderSender(e.target.value)}
                placeholder="sender (0x...)"
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono"
              />
              <input
                value={builderRecipient}
                onChange={(e) => setBuilderRecipient(e.target.value)}
                placeholder="Empfänger (optional 0x...)"
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono"
              />
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
                Sender-Signatur wird automatisch gesetzt (Digest-Signieren) oder aus importiertem Envelope übernommen.
              </div>
            </div>
            <textarea
              value={builderPayload}
              onChange={(e) => setBuilderPayload(e.target.value)}
              rows={3}
              placeholder="Nachricht / Payload (submit-ready blob, base64)"
              className="w-full rounded-md border border-border bg-background px-2 py-2 text-xs font-mono"
            />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Digest wird im Builder berechnet. Eine echte `senderSig` entsteht nur mit dem privaten Schlüssel im
              kanonischen Signing-Pfad. Externe/fremde Envelopes bitte unten über „prüfen & übernehmen“ importieren.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => void signDigestNow()}>
                ✍️ Digest jetzt signieren
              </Button>
              <span className="text-xs text-muted-foreground">
                {builderSenderSig ? `senderSig gesetzt (${builderSenderSig.slice(0, 12)}...)` : 'Noch keine Signatur gesetzt.'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => void buildEnvelope()}>
                <WandSparkles className="mr-2 h-3.5 w-3.5" />
                Paket erzeugen
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (!rawText.trim()) {
                    setMsg('Nichts zum Kopieren.')
                    return
                  }
                  try {
                    await navigator.clipboard.writeText(rawText)
                    setMsg('Envelope JSON in Zwischenablage kopiert.')
                  } catch {
                    setMsg('Kopieren fehlgeschlagen.')
                  }
                }}
              >
                <Copy className="mr-2 h-3.5 w-3.5" />
                JSON kopieren
              </Button>
              <Button type="button" size="sm" onClick={() => void sendToLoraShortcut()}>
                Paket teilen (LoRa/Copy)
              </Button>
            </div>
            <div className="rounded-md border border-border/70 bg-muted/20 p-2 text-xs">
              <button
                type="button"
                className="text-xs text-muted-foreground underline underline-offset-2"
                onClick={() => setShowExpertTransport((v) => !v)}
              >
                {showExpertTransport ? 'Experten-Transport ausblenden' : 'Experten-Transport anzeigen (Event/Mailbox)'}
              </button>
              {showExpertTransport ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">Alternativ als Klartext-Envelope direkt senden:</span>
                  <select
                    value={transportMode}
                    onChange={(e) => setTransportMode((e.target.value as MessagingPersistenceMode) || 'event')}
                    className="rounded-md border border-border bg-background px-2 py-1"
                  >
                    <option value="event">Event (flüchtig)</option>
                    <option value="mailbox">Mailbox (persistenter)</option>
                  </select>
                  <Button type="button" size="sm" variant="outline" onClick={() => void sendEnvelopeAsText()}>
                    Envelope als Text senden
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
          <div className="space-y-2 rounded-lg border border-border/70 bg-muted/10 p-3">
            <p className="text-xs font-medium text-foreground">Paket importieren (vom Funk/Relayer)</p>
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
                Paket prüfen & übernehmen
              </Button>
            </div>
            {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
          </div>
          <div className="space-y-2">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Relay-Envelopes in der lokalen Warteliste.</p>
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
                      Relay: {it.relayReport.rpcStatus ?? '—'}
                      {it.relayReport.errorCode ? ` · ${it.relayReport.errorCode}` : ''}
                      {it.relayReport.note ? ` · ${it.relayReport.note}` : ''}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="mt-2 text-xs text-muted-foreground underline underline-offset-2"
                    onClick={() => setShowExpertQueueActions((v) => !v)}
                  >
                    {showExpertQueueActions ? 'Expertenaktionen ausblenden' : 'Expertenaktionen anzeigen'}
                  </button>
                  {showExpertQueueActions ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => updateReport(it)}>
                        Relayer-Submit protokollieren
                      </Button>
                      {it.status !== 'anchored' ? (
                        <>
                          <Button type="button" size="sm" variant="outline" onClick={() => void markAnchored(it)}>
                            <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                            Nachweis abrufen
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            Nach `Submit` liefert der Relayer den txDigest automatisch; hier nur in die lokale Liste übernehmen.
                          </span>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))
            )}
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
