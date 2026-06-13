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
    if (!/^[a-f0-9]+$/.test(h) || h.length % 2 !== 0) throw new Error('Invalid hex.')
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
      setMsg('Builder: sender must be a valid 0x address.')
      return
    }
    const recipient = builderRecipient.trim()
    if (recipient && !/^0x[a-fA-F0-9]{64}$/.test(recipient)) {
      setMsg('Builder: recipient must be empty or a valid 0x address.')
      return
    }
    const payload = builderPayload.trim()
    if (!payload) {
      setMsg('Builder: message is required.')
      return
    }
    const senderSig = builderSenderSig.trim()
    if (!senderSig && !allowUnsignedDraft) {
      setMsg('Run "Sign digest" first (or explicitly allow an unsigned draft).')
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
        note: 'Self-draft without signature: for transport/review; submit only after signing.',
        statusOverride: 'draft_unsigned',
      })
      refresh()
      setMsg('Package created and added to the local queue as a draft.')
      return
    }
    refresh()
    setMsg('Package created and added to the local queue.')
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
      setMsg('Set a valid recipient address for event/mailbox test.')
      return
    }
    if (!rawText.trim()) {
      setMsg('Create a package first.')
      return
    }
    const r = await sendMessage(rec, rawText, false, { messagingPersistenceMode: transportMode })
    if (r.ok) {
      markSubmittedByEnvelope(
        rawText,
        `Auto: forwarded via expert transport (${transportMode === 'mailbox' ? 'mailbox' : 'event'}).`
      )
      setMsg(
        transportMode === 'mailbox'
          ? 'Package sent as plaintext via mailbox.'
          : 'Package sent as plaintext event.'
      )
    } else {
      setMsg(r.error || r.message || 'Send failed.')
    }
  }

  const sendToLoraShortcut = async () => {
    if (!rawText.trim()) {
      setMsg('Create a package first.')
      return
    }
    try {
      await navigator.clipboard.writeText(rawText)
      setMsg(
        'Package prepared for LoRa: JSON is in the clipboard. In chat, choose "funk" and send as plaintext.'
      )
    } catch {
      setMsg('Clipboard unavailable. Copy JSON manually and send via radio.')
    }
  }

  const signDigestMerged = async () => {
    setMsg(null)
    setSessionSignerAddr(getDirectIotaSessionSignerAddress())
    const sender = builderSender.trim().toLowerCase()
    if (!/^0x[a-fA-F0-9]{64}$/.test(sender)) {
      setMsg('Set a valid sender address first.')
      return
    }
    const payload = builderPayload.trim()
    if (!payload) {
      setMsg('Enter a message first.')
      return
    }
    let signer = getDirectIotaSessionSigner() as unknown as {
      signPersonalMessage?: (msg: Uint8Array) => Promise<{ signature?: string }>
    } | null
    if ((!signer || typeof signer.signPersonalMessage !== 'function') && signerMode === 'cli' && !mnemoInput.trim()) {
      const m =
        'SIGNER=cli active: automatic vault import is disabled. Open "Use another signer" or continue as an unsigned draft.'
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
        setSignerHint(`Signer loaded: ${applied.address.slice(0, 10)}…`)
        signer = getDirectIotaSessionSigner() as unknown as {
          signPersonalMessage?: (msg: Uint8Array) => Promise<{ signature?: string }>
        } | null
      } else {
        const wantVault = window.confirm(
          'No active signer in this session.\n\nLoad from vault now and sign immediately?'
        )
        if (!wantVault) {
          const m =
            'No active signer found. Click "Load signer from vault" or optionally use "Use another signer".'
          setMsg(m)
          setSignerHint(m)
          return
        }
        const pw = window.prompt('Vault password:')
        if (!pw) return
        const r = await revealVaultSignerImport(pw)
        if (!r.ok || !r.signerImport?.trim()) {
          const base = r.error || r.message || 'Could not load signer from vault.'
          const m = `${base} Open "Use another signer" below and enter mnemonic/secret.`
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
        setSignerHint(`Signer loaded: ${applied.address.slice(0, 10)}…`)
        signer = getDirectIotaSessionSigner() as unknown as {
          signPersonalMessage?: (msg: Uint8Array) => Promise<{ signature?: string }>
        } | null
      }
      if (!signer || typeof signer.signPersonalMessage !== 'function') {
        setMsg('Could not load signer.')
        setSignerHint('Could not load signer.')
        return
      }
    }
    const signerAddr = (getDirectIotaSessionSignerAddress() || '').trim().toLowerCase()
    if (signerAddr && signerAddr !== sender) {
      setMsg(`Signer address does not match sender.\nSigner: ${signerAddr}\nSender: ${sender}`)
      return
    }
    try {
      const digestHex = await sha256HexUtf8(payload)
      const digestBytes = hexToBytes(digestHex)
      const res = await signer.signPersonalMessage(digestBytes)
      const sig = String(res?.signature ?? '').trim()
      if (!sig) {
        setMsg('Signing failed.')
        return
      }
      setBuilderSenderSig(sig)
      setAllowUnsignedDraft(false)
      setMsg('Digest signed. senderSig will be used when creating the package.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    }
  }

  const loadSignerFromVault = async () => {
    if (signerMode === 'cli') {
      const m =
        'Signer mode is CLI. "Load signer from vault" only works with SIGNER=sdk. Use "Use another signer" or allow an unsigned draft.'
      setMsg(m)
      setSignerHint(m)
      return
    }
    const pw = window.prompt('Enter vault password to load the signer into this session:')
    if (!pw) return
    const r = await revealVaultSignerImport(pw)
    if (!r.ok || !r.signerImport?.trim()) {
      const base = r.error || r.message || 'Could not load signer from vault.'
      const m = `${base} Open "Use another signer" below and enter mnemonic/secret.`
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
    const okMsg = `Signer loaded: ${applied.address.slice(0, 10)}…`
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
      setMsg('Invalid JSON.')
      return
    }
    const v = validateRelayEnvelope(parsed)
    if (!v.ok) {
      setMsg(v.error)
      return
    }
    if (v.envelope.mode !== 'submit_ready') {
      setMsg('This package format is not supported yet (only the R1 standard package is active).')
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
        note: 'Self-draft without signature: for transport/review; submit only after signing.',
        statusOverride: 'draft_unsigned',
      })
      refresh()
      setMsg('Package imported as draft (unsigned). This is expected in auto mode.')
      return
    }
    refresh()
    setMsg(`Package imported. Local status: ${item.status}.`)
  }

  const markAnchored = async (it: TxRelayQueueItem) => {
    const fromReport = (it.relayReport?.note || '').match(/0x[a-fA-F0-9]{64}/)?.[0]
    let digest = (fromReport || it.txDigest || '').trim()
    if (!digest) {
      const asked = window.prompt('Paste proof (txDigest) (0x...)')
      if (!asked) return
      digest = asked.trim()
    } else {
      const ok = window.confirm(`Use the found txDigest?\n\n${digest}`)
      if (!ok) {
        const asked = window.prompt('Paste a different txDigest (0x...)', digest)
        if (!asked) return
        digest = asked.trim()
      }
    }
    if (!/^0x[a-fA-F0-9]{64}$/.test(digest)) {
      setMsg('Invalid txDigest. Expected: 0x + 64 hex characters.')
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
    setMsg('Marked as anchored and digest added to inventory.')
  }

  const updateReportSimple = (it: TxRelayQueueItem, rpcStatus: 'submitted' | 'reject' | 'error') => {
    const needsDetail = rpcStatus === 'reject' || rpcStatus === 'error'
    let note = needsDetail
      ? (window.prompt('Brief reason (optional):', it.relayReport?.note ?? '') ?? '').trim()
      : (it.relayReport?.note || '').trim()
    if (rpcStatus === 'submitted') {
      const digestInput =
        window.prompt(
          'Optional: paste txDigest if the relayer already returned one (0x...).',
          it.txDigest || ''
        ) ?? ''
      const digest = digestInput.trim()
      if (digest) {
        if (!/^0x[a-fA-F0-9]{64}$/.test(digest)) {
          setMsg('Invalid txDigest. Expected: 0x + 64 hex characters.')
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
    setMsg(`Relay log: ${rpcStatus}.`)
  }

  return (
    <>
      {hideMenuTrigger ? null : (
        <button
          type="button"
          onClick={openR1Dialog}
          className="w-full rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-sm hover:bg-accent"
        >
          R1 courier package (beta)
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>R1 courier package (offline {'->'} relayer {'->'} submit)</DialogTitle>
            <DialogDescription>Courier package for the offline/relay workflow.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border/70 bg-muted/10 p-3 text-xs">
            <p className="font-medium text-foreground">Workflow</p>
            <ol className="mt-1 list-decimal space-y-1 pl-4 text-muted-foreground">
              <li>Create package (and sign digest if needed).</li>
              <li>Import locally (queue) and set relayer result.</li>
              <li>Add proof to the tangle.</li>
              <li>Optionally forward package (LoRa/copy/export).</li>
            </ol>
          </div>
          <div className="space-y-2 rounded-lg border border-border/70 bg-muted/10 p-3">
            <p className="text-xs font-medium text-foreground">Step 1: Create package</p>
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
                    setMsg('No active signer available.')
                    return
                  }
                  setBuilderSender(addr)
                  setMsg('Sender set to active signer address.')
                }}
              >
                Sender = active signer
              </Button>
              <input
                value={builderRecipient}
                onChange={(e) => setBuilderRecipient(e.target.value)}
                list="r1-known-addresses"
                placeholder="Recipient (optional 0x...)"
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
                  <option value="30">30 minutes (short)</option>
                  <option value="120">2 hours (recommended)</option>
                  <option value="360">6 hours</option>
                  <option value="720">12 hours</option>
                  <option value="1440">24 hours (max)</option>
                </select>
              </label>
              <div className="rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs">
                Sender signature is set automatically (sign digest) or taken from an imported package.
              </div>
            </div>
            <textarea
              value={builderPayload}
              onChange={(e) => setBuilderPayload(e.target.value)}
              rows={3}
              placeholder="Message text (stored internally as submit-ready data block)"
              className="w-full rounded-md border border-border bg-background px-2 py-2 text-xs font-mono"
            />
            <div className="rounded-md border border-border/70 bg-muted/20 p-2 text-xs">
              <p className="text-xs font-medium text-foreground">Session signer (RAM only)</p>
              <div className="mt-1 inline-flex items-center rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-foreground">
                Signer mode: {signerMode === 'cli' ? 'Legacy CLI' : signerMode === 'sdk' ? 'SDK (recommended)' : 'unknown'}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Source: {signerConfigSource === 'runtime' ? 'Runtime config' : signerConfigSource === 'env' ? '.env' : 'unknown'}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Default: active session signer is used automatically. Only enter manually below if signing for another address.
              </p>
              {signerMode === 'cli' ? (
                <p className="mt-1 text-[11px] text-amber-600">
                  This instance runs with SIGNER=cli. Vault import for the signer is not available here.
                </p>
              ) : null}
              {sessionSignerAddr ? (
                <p className="mt-1 font-mono text-[11px] text-emerald-600">Active signer: {sessionSignerAddr}</p>
              ) : (
                <p className="mt-1 text-[11px] text-amber-600">No session signer active.</p>
              )}
              <button
                type="button"
                className="mt-2 text-[11px] text-muted-foreground underline underline-offset-2"
                onClick={() => setShowManualSignerInput((v) => !v)}
              >
                {showManualSignerInput ? 'Hide manual signer input' : 'Use another signer (optional)'}
              </button>
              {showManualSignerInput ? (
                <textarea
                  value={mnemoInput}
                  onChange={(e) => setMnemoInput(e.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                  rows={2}
                  placeholder="Mnemonic / Bech32 secret / 64-char hex (32 bytes)"
                  className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px]"
                />
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="default" onClick={() => void signDigestMerged()}>
                  Sign digest
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void loadSignerFromVault()}
                  disabled={signerMode === 'cli'}
                >
                  Load signer from vault
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    clearDirectIotaSessionSigner()
                    setSessionSignerAddr(null)
                    setMsg('Session signer cleared.')
                  }}
                >
                  Clear signer
                </Button>
                <span className="text-xs text-muted-foreground">
                  {builderSenderSig ? `senderSig set (${builderSenderSig.slice(0, 12)}…)` : 'No signature yet.'}
                </span>
                <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={allowUnsignedDraft}
                    onChange={(e) => setAllowUnsignedDraft(e.target.checked)}
                  />
                  allow unsigned draft
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
                Create package
              </Button>
            </div>
          </div>
          <div className="space-y-2 rounded-lg border border-border/70 bg-muted/10 p-3">
            <p className="text-xs font-medium text-foreground">Step 2: Import into local workflow</p>
            <p className="text-[11px] text-muted-foreground">
                Created or received packages land in the local R1 queue here.
            </p>
            <div className="rounded-md border border-border/70 bg-muted/20 p-2 text-xs">
              <button
                type="button"
                className="text-xs text-muted-foreground underline underline-offset-2"
                onClick={() => setShowExpertTransport((v) => !v)}
              >
                {showExpertTransport
                  ? 'Hide expert transport'
                  : 'Show expert transport (debug only: send package as chat text)'}
              </button>
              {showExpertTransport ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">Debug/bypass only: send package as plaintext chat:</span>
                  <select
                    value={transportMode}
                    onChange={(e) => setTransportMode((e.target.value as MessagingPersistenceMode) || 'event')}
                    className="rounded-md border border-border bg-background px-2 py-1"
                  >
                    <option value="event">Event (ephemeral)</option>
                    <option value="mailbox">Mailbox (persistent)</option>
                  </select>
                  <Button type="button" size="sm" variant="outline" onClick={() => void sendEnvelopeAsText()}>
                    Send package as text
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
          <div className="space-y-2 rounded-lg border border-border/70 bg-muted/10 p-3">
            <p className="text-xs font-medium text-foreground">Optional: import package from radio/relayer</p>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={6}
              placeholder='Import courier package JSON (e.g. from relayer/radio path)'
              className="w-full rounded-md border border-border bg-background px-2 py-2 text-xs font-mono"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onImport}>
                <Upload className="mr-2 h-3.5 w-3.5" />
                Check & import external package
              </Button>
            </div>
            {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">Step 3: Proof / tangle</p>
            <p className="text-[11px] text-muted-foreground">
              Erst „Relayer: erfolgreich gesendet“ setzen, wenn dein Paket den Relayer wirklich verlassen hat. Danach
              bei vorhandener TX den Button „In Tangle uebernehmen“ nutzen.
            </p>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No R1 packages in the local queue yet.</p>
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
                    Expires: {new Date(it.envelope.expiresAt).toLocaleString('de-DE')}
                    {it.txDigest ? ` · tx ${it.txDigest}` : ''}
                  </p>
                  {it.relayReport ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Relayer status: {it.relayReport.rpcStatus ?? '—'}
                      {it.relayReport.errorCode ? ` · ${it.relayReport.errorCode}` : ''}
                      {it.relayReport.note ? ` · ${it.relayReport.note}` : ''}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => updateReportSimple(it, 'submitted')}>
                      Relayer: submitted successfully
                    </Button>
                    {it.status !== 'anchored' ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => void markAnchored(it)}>
                        <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                        Add to tangle
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!window.confirm('Delete this entry from the local relay queue?')) return
                        removeRelayQueueItem(it.id)
                        refresh()
                        setMsg('Entry removed from the local queue.')
                      }}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Delete entry
                    </Button>
                  </div>
                  <button
                    type="button"
                    className="mt-2 text-xs text-muted-foreground underline underline-offset-2"
                    onClick={() => setExpertQueueItemId((cur) => (cur === it.id ? null : it.id))}
                  >
                    {expertQueueItemId === it.id ? 'Hide expert actions' : 'Show expert actions'}
                  </button>
                  {expertQueueItemId === it.id ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => updateReportSimple(it, 'reject')}>
                        Relayer: rejected
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => updateReportSimple(it, 'error')}>
                        Relayer: error
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
            <p className="text-xs font-medium text-foreground">Step 4: Forward package (optional)</p>
            <p className="text-[11px] text-muted-foreground">
              For LoRa, email, SD, or other handoff paths: copy the finished package once.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (!rawText.trim()) {
                    setMsg('Create or import a package first.')
                    return
                  }
                  try {
                    await navigator.clipboard.writeText(rawText)
                    setMsg('Package copied to clipboard for forwarding.')
                  } catch {
                    setMsg('Copy failed.')
                  }
                }}
              >
                <Copy className="mr-2 h-3.5 w-3.5" />
                Copy package (forward)
              </Button>
            </div>
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-2"
              onClick={() => setShowExpertForwarding((v) => !v)}
            >
              {showExpertForwarding ? 'Hide expert forwarding' : 'Show expert forwarding'}
            </button>
            {showExpertForwarding ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => void sendToLoraShortcut()}>
                  LoRa forward hint
                </Button>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setOpen(false)}>
              <ArrowUpCircle className="mr-2 h-4 w-4" />
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
