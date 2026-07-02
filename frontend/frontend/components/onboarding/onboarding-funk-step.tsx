'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Copy, ExternalLink, Loader2, Radio } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import { saveContactEntry } from '@/frontend/lib/api'
import { EinsatzleitungMeshtasticHintPanel } from '@/frontend/components/einsatzleitung-meshtastic-hint-panel'
import { LazyChatViewPulseSettings } from '@/frontend/components/lazy/messenger-scope-b'
import { useMeshtasticBle } from '@/frontend/hooks/use-meshtastic-ble'
import {
  deriveBossFunkWizardStatus,
  isLikelyMeshtasticNodeId,
  resolveBossOwnMeshNodeId,
} from '@/frontend/lib/boss-wizard-funk-context'
import { MESHTASTIC_WEB_DEVICE_SETTINGS_URL } from '@/frontend/lib/chat-view-messenger-transport'
import { toast } from 'sonner'

function StatusRow(p: { ok: boolean; label: string; detail?: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-start gap-2 text-sm">
        <span className={p.ok ? 'text-emerald-500' : 'text-muted-foreground'} aria-hidden>
          {p.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <span className="mt-0.5 inline-block w-4 text-center">○</span>}
        </span>
        <span className={p.ok ? 'text-foreground' : 'text-muted-foreground'}>{p.label}</span>
      </div>
      {p.detail ? <p className="ml-6 text-xs text-muted-foreground">{p.detail}</p> : null}
    </div>
  )
}

export function OnboardingFunkStep(p: {
  apiSnapshot?: ApiStatus | null
  backendOnline?: boolean
  contactDirectory?: Record<string, ContactMeshEntryClient>
  onOpenSettings?: () => void
  onReload?: () => void
  /** Wizard: Status + Verbinden; full: Legacy-Puls-Panel. */
  layout?: 'wizard' | 'full'
}) {
  const layout = p.layout ?? 'wizard'
  const meshtastic = useMeshtasticBle({ contactDirectory: p.contactDirectory })
  const [connectBusy, setConnectBusy] = useState(false)
  const [nodeIdDraft, setNodeIdDraft] = useState('')
  const [nodeReplaceOpen, setNodeReplaceOpen] = useState(false)
  const [busy, setBusy] = useState<'save' | 'reload' | null>(null)
  const [msg, setMsg] = useState('')
  const [nodeCopied, setNodeCopied] = useState(false)

  const ownAddr = (p.apiSnapshot?.myAddressFull || p.apiSnapshot?.myAddress || '').trim()
  const savedNodeId = useMemo(
    () => resolveBossOwnMeshNodeId(ownAddr, p.contactDirectory),
    [ownAddr, p.contactDirectory]
  )

  useEffect(() => {
    if (!nodeReplaceOpen) setNodeIdDraft(savedNodeId)
  }, [savedNodeId, nodeReplaceOpen])

  const status = useMemo(
    () =>
      deriveBossFunkWizardStatus({
        connected: meshtastic.connected,
        savedNodeId,
        nodeIdDraft,
      }),
    [meshtastic.connected, savedNodeId, nodeIdDraft]
  )

  const showNodeField = !savedNodeId || nodeReplaceOpen

  const runBluetooth = async () => {
    setConnectBusy(true)
    setMsg('')
    try {
      await meshtastic.connectBluetooth()
    } finally {
      setConnectBusy(false)
    }
  }

  const runUsb = async () => {
    setConnectBusy(true)
    setMsg('')
    try {
      await meshtastic.connectUsb()
    } finally {
      setConnectBusy(false)
    }
  }

  const runSaveNodeId = async () => {
    const node = nodeIdDraft.trim()
    if (node && !isLikelyMeshtasticNodeId(node)) {
      const err = 'Node-ID im Format !deadbeef (Meshtastic-App → Gerät).'
      setMsg(err)
      toast.error(err)
      return
    }
    if (!ownAddr) {
      const err = 'Wallet-Adresse fehlt — zuerst Wallet-Schritt abschließen.'
      setMsg(err)
      toast.error(err)
      return
    }
    setBusy('save')
    setMsg('')
    try {
      const r = await saveContactEntry({
        address: ownAddr,
        meshNodeId: node || undefined,
        clearMesh: !node,
      })
      if (!r.ok) {
        const err = r.error || 'Speichern fehlgeschlagen.'
        setMsg(err)
        toast.error(err)
        return
      }
      setNodeReplaceOpen(false)
      setMsg(r.message || 'Node-ID gespeichert.')
      toast.success('Funk-Node-ID gespeichert.')
      p.onReload?.()
    } finally {
      setBusy(null)
    }
  }

  const runReload = useCallback(async () => {
    setBusy('reload')
    setMsg('')
    try {
      p.onReload?.()
      setMsg('Stand neu geladen.')
    } finally {
      setBusy(null)
    }
  }, [p.onReload])

  const copyNodeId = async () => {
    if (!savedNodeId) return
    try {
      await navigator.clipboard.writeText(savedNodeId)
      setNodeCopied(true)
      setTimeout(() => setNodeCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  if (!p.apiSnapshot || layout === 'full') {
    if (!p.apiSnapshot) return null
    return (
      <LazyChatViewPulseSettings
        apiStatus={p.apiSnapshot}
        allowDevExpertTools={false}
        settingsEmbedded
        networkManaged={false}
      />
    )
  }

  const canConnect = meshtastic.bleSupported || meshtastic.serialSupported
  const backendOnline = p.backendOnline !== false

  if (!backendOnline) {
    return (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>
          Funk ist <strong className="font-medium text-foreground">optional</strong> — überspringen oder später unter
          Einstellungen → Funk einrichten.
        </p>
        {p.onOpenSettings ? (
          <Button type="button" size="sm" variant="outline" onClick={() => p.onOpenSettings?.()}>
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Einstellungen (Funk)
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Optional: Heltec-Stick per Bluetooth/USB koppeln und deine <strong className="font-medium text-foreground">Node-ID</strong>{' '}
        hinterlegen, damit Helfer dich per Funk erreichen. Schritt überspringbar.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatusRow
          ok={status.stickConnected}
          label={status.stickConnected ? 'Funk-Stick verbunden' : 'Funk-Stick (Heltec)'}
          detail={
            status.stickConnected
              ? `Transport: ${meshtastic.transportKind === 'usb' ? 'USB' : 'Bluetooth'}.`
              : canConnect
                ? 'Chrome/Edge — Stick eingeschaltet, Meshtastic-App nicht parallel verbunden.'
                : 'Web Bluetooth/USB hier nicht verfügbar — später im Chat oder unter Einstellungen.'
          }
        />
        <StatusRow
          ok={status.nodeIdConfigured}
          label={status.nodeIdConfigured ? 'Deine Node-ID' : 'Deine Node-ID (optional)'}
          detail={
            status.nodeIdConfigured
              ? 'Helfer sehen sie im Team — für gezielte Funk-Nachrichten an dich.'
              : 'Format !deadbeef aus der Meshtastic-App — kann auch nach dem Koppeln eingetragen werden.'
          }
        />
      </div>

      {status.readyMinimal ? (
        <div className="rounded-md border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-100">
          Funk-Basis ist eingerichtet — mit <strong>Weiter</strong> oder überspringen. Feintuning in{' '}
          <button type="button" className="underline" onClick={() => p.onOpenSettings?.()}>
            Einstellungen → Funk
          </button>
          .
        </div>
      ) : null}

      <div className="space-y-3 rounded-md border border-border/80 bg-muted/15 p-3">
        <p className="text-xs font-medium text-foreground">Stick verbinden</p>
        {meshtastic.connected ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-emerald-700 dark:text-emerald-300">
              Verbunden per {meshtastic.transportKind === 'usb' ? 'USB' : 'Bluetooth'}.
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => meshtastic.disconnect()}>
              Verbindung trennen
            </Button>
            <a
              href={MESHTASTIC_WEB_DEVICE_SETTINGS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline-offset-2 hover:underline"
            >
              Meshtastic-Web einrichten
            </a>
          </div>
        ) : canConnect ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={connectBusy || meshtastic.connecting || !meshtastic.bleSupported}
              onClick={() => void runBluetooth()}
            >
              {connectBusy || (meshtastic.connecting && meshtastic.transportKind === 'bluetooth') ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Radio className="mr-1.5 h-3.5 w-3.5" />
              )}
              Bluetooth verbinden
            </Button>
            {meshtastic.serialSupported ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={connectBusy || meshtastic.connecting}
                onClick={() => void runUsb()}
              >
                {connectBusy || (meshtastic.connecting && meshtastic.transportKind === 'usb') ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                USB verbinden
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Web Bluetooth/USB nicht verfügbar — Funk später im Chat oder unter Einstellungen einrichten.
          </p>
        )}
        {meshtastic.error ? <p className="text-xs text-destructive">{meshtastic.error}</p> : null}

        <div className="space-y-1.5 border-t border-border/60 pt-3">
          <Label htmlFor="wiz-funk-node" className="text-xs">
            Deine Meshtastic Node-ID
          </Label>
          {savedNodeId && !showNodeField ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                <p className="min-w-0 flex-1 break-all font-mono text-xs">{savedNodeId}</p>
                <Button type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={() => void copyNodeId()}>
                  {nodeCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <button
                type="button"
                className="text-xs text-primary underline hover:no-underline"
                onClick={() => {
                  setNodeReplaceOpen(true)
                  setNodeIdDraft('')
                }}
              >
                Andere Node-ID eintragen
              </button>
            </div>
          ) : (
            <>
              {savedNodeId && nodeReplaceOpen ? (
                <p className="text-[11px] text-muted-foreground">Neue Node-ID einfügen — leer lassen zum Entfernen.</p>
              ) : null}
              <Input
                id="wiz-funk-node"
                className="font-mono text-xs"
                placeholder="!deadbeef aus Meshtastic-App"
                value={nodeIdDraft}
                onChange={(e) => setNodeIdDraft(e.target.value)}
                autoComplete="off"
              />
              {nodeReplaceOpen ? (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline"
                  onClick={() => {
                    setNodeReplaceOpen(false)
                    setNodeIdDraft(savedNodeId)
                  }}
                >
                  Abbrechen — gespeicherte Node-ID behalten
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy !== null} onClick={() => void runSaveNodeId()}>
          {busy === 'save' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Node-ID speichern
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void runReload()}>
          {busy === 'reload' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Neu laden
        </Button>
        {p.onOpenSettings ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => p.onOpenSettings?.()}>
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Alle Optionen…
          </Button>
        ) : null}
      </div>

      <details className="rounded-md border border-border/60 p-3">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground">Kanal & PSK — Hinweise</summary>
        <div className="mt-3">
          <EinsatzleitungMeshtasticHintPanel />
        </div>
      </details>

      <p className="text-xs text-muted-foreground">
        Mehr (Puls, Kanalindex, Team-Verteilung):{' '}
        <Link href="/handbook?file=README.md" className="text-primary underline-offset-2 hover:underline">
          Handbuch
        </Link>{' '}
        und Einstellungen → Funk.
      </p>

      {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
    </div>
  )
}
