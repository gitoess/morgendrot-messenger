'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, MessageCircle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  fetchTelegramIntegration,
  saveTelegramIntegration,
  testTelegramAlarm,
  type TelegramIntegrationPublic,
} from '@/frontend/lib/api/telegram-integrations'
import { testTelegramNotify } from '@/frontend/lib/api/telegram-notify'

type SettingsTelegramIntegrationProps = {
  backendOnline: boolean
  /** false = iota-messenger: kein Sensor-Monitor / Relay. Default true (Morgendrot). */
  showMonitorControls?: boolean
}

type FeedbackKind = 'ok' | 'err' | 'info'

export function SettingsTelegramIntegration({
  backendOnline,
  showMonitorControls = true,
}: SettingsTelegramIntegrationProps) {
  const [pub, setPub] = useState<TelegramIntegrationPublic | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [savedBotToken, setSavedBotToken] = useState('')
  const [botTokenDraft, setBotTokenDraft] = useState('')
  const [adminChatId, setAdminChatId] = useState('')
  const [relayBaseUrl, setRelayBaseUrl] = useState('http://127.0.0.1:8787')
  const [busy, setBusy] = useState<'load' | 'save' | 'test' | 'testNotify' | null>(null)
  const [testNotifyChatId, setTestNotifyChatId] = useState('')
  const [inboundMode, setInboundMode] = useState<'off' | 'longPoll' | 'webhook'>('longPoll')
  const [feedback, setFeedback] = useState<{ kind: FeedbackKind; text: string } | null>(null)
  const [tokenCopied, setTokenCopied] = useState(false)
  const [tokenReplaceOpen, setTokenReplaceOpen] = useState(false)

  const applyPublic = useCallback((p: TelegramIntegrationPublic) => {
    setPub(p)
    setEnabled(p.enabled)
    setSavedBotToken(p.botToken || '')
    setAdminChatId(p.adminChatId || '')
    setRelayBaseUrl(p.relayBaseUrl || 'http://127.0.0.1:8787')
    setInboundMode(
      p.inboundMode === 'webhook' || p.inboundMode === 'longPoll' ? p.inboundMode : 'off'
    )
  }, [])

  const load = useCallback(async () => {
    if (!backendOnline) return
    setBusy('load')
    setFeedback(null)
    const res = await fetchTelegramIntegration()
    if (res.ok) {
      applyPublic(res)
    } else {
      const hint =
        res.error?.includes('404') || res.error?.includes('Not Found')
          ? `${res.error} — Backend neu starten (npm run dev), damit /api/integrations/telegram geladen wird.`
          : res.error || 'Laden fehlgeschlagen'
      setFeedback({ kind: 'err', text: hint })
    }
    setBusy(null)
  }, [applyPublic, backendOnline])

  useEffect(() => {
    void load()
  }, [load])

  const canTest =
    Boolean(pub?.botTokenConfigured || savedBotToken.trim() || botTokenDraft.trim()) &&
    Boolean(adminChatId.trim() || pub?.adminChatId)

  const handleSave = async () => {
    setFeedback({ kind: 'info', text: 'Speichere…' })
    setBusy('save')
    const tokenToSave = botTokenDraft.trim() || savedBotToken.trim()
    const body: {
      enabled?: boolean
      botToken?: string
      adminChatId: string
      relayBaseUrl?: string
      inboundMode: 'off' | 'longPoll' | 'webhook'
    } = {
      adminChatId: adminChatId.trim(),
      inboundMode,
    }
    if (showMonitorControls) {
      body.enabled = enabled
      body.relayBaseUrl = relayBaseUrl.trim()
    } else {
      /** Produkt ohne Monitor: Schalter nicht anbieten und Sensor-Pfad aus lassen. */
      body.enabled = false
    }
    if (tokenToSave) body.botToken = tokenToSave
    const res = await saveTelegramIntegration(body)
    if (res.ok) {
      applyPublic(res)
      if (res.botToken) {
        setSavedBotToken(res.botToken)
        setBotTokenDraft('')
        setTokenReplaceOpen(false)
      } else if (res.botTokenConfigured && tokenToSave) {
        setSavedBotToken(tokenToSave)
        setBotTokenDraft('')
        setTokenReplaceOpen(false)
      } else {
        setBotTokenDraft('')
      }
      setFeedback({
        kind: 'ok',
        text: res.botTokenConfigured
          ? `Gespeichert. Chat-ID: ${res.adminChatId || '—'}.`
          : 'Gespeichert (ohne Token).',
      })
    } else {
      setFeedback({
        kind: 'err',
        text:
          res.error ||
          (showMonitorControls
            ? 'Speichern fehlgeschlagen. Token eintragen; für Monitor-Alarme zusätzlich Chat-ID — oder „System-Alarme“ aus lassen.'
            : 'Speichern fehlgeschlagen. Bot-Token prüfen.'),
      })
    }
    setBusy(null)
  }

  const handleTestNotify = async () => {
    setFeedback({ kind: 'info', text: 'Sende Kontakt-Test…' })
    setBusy('testNotify')
    const res = await testTelegramNotify(testNotifyChatId.trim())
    setFeedback({
      kind: res.ok ? 'ok' : 'err',
      text: res.ok
        ? `${res.message || 'Gesendet.'} Beim Empfänger in Telegram prüfen (Bot muss gestartet haben).`
        : res.error || 'Test fehlgeschlagen',
    })
    setBusy(null)
  }

  const handleTest = async () => {
    setFeedback({ kind: 'info', text: 'Sende Test… (erscheint in der Telegram-App, nicht hier in Morgendrot)' })
    setBusy('test')
    const res = await testTelegramAlarm()
    setFeedback({
      kind: res.ok ? 'ok' : 'err',
      text: res.ok
        ? `${res.message || 'Gesendet.'} Telegram-App öffnen (Chat mit deinem Bot).`
        : res.error || 'Test fehlgeschlagen',
    })
    setBusy(null)
    if (res.ok) void load()
  }

  const copySavedToken = async () => {
    if (!savedBotToken) return
    try {
      await navigator.clipboard.writeText(savedBotToken)
      setTokenCopied(true)
      setTimeout(() => setTokenCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const formDisabled = !backendOnline || busy !== null
  const displayToken = savedBotToken.trim()

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300">
          <MessageCircle className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold text-foreground">Integrationen · Telegram</h4>
            <button
              type="button"
              disabled={!backendOnline || busy === 'load'}
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              aria-label="Telegram-Einstellungen aktualisieren"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', busy === 'load' && 'animate-spin')} />
              Aktualisieren
            </button>
          </div>

          {!backendOnline ? (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
              Backend offline — zuerst <span className="font-mono">npm run dev</span> starten.
            </p>
          ) : null}

          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Bot-Token (@BotFather)</Label>
              {displayToken && !tokenReplaceOpen ? (
                <div className="mt-1 space-y-2">
                  <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
                    <p className="min-w-0 flex-1 break-all font-mono text-xs text-foreground">{displayToken}</p>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 shrink-0"
                      onClick={() => void copySavedToken()}
                      aria-label="Bot-Token kopieren"
                    >
                      {tokenCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-primary underline hover:no-underline"
                    disabled={formDisabled}
                    onClick={() => {
                      setTokenReplaceOpen(true)
                      setBotTokenDraft('')
                    }}
                  >
                    Token ersetzen
                  </button>
                </div>
              ) : (
                <>
                  {displayToken && tokenReplaceOpen ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Nur ausfüllen, wenn @BotFather einen <strong className="text-foreground">neuen</strong> Token
                      ausgegeben hat — danach Speichern.
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Token von @BotFather einfügen, dann Speichern.
                    </p>
                  )}
                  <Input
                    id="tg-token"
                    type="text"
                    autoComplete="off"
                    value={botTokenDraft}
                    onChange={(e) => setBotTokenDraft(e.target.value)}
                    placeholder="123456789:AAH…"
                    disabled={formDisabled}
                    className="mt-1 font-mono text-xs"
                  />
                  {displayToken && tokenReplaceOpen ? (
                    <button
                      type="button"
                      className="mt-1 text-xs text-muted-foreground underline hover:no-underline"
                      onClick={() => {
                        setTokenReplaceOpen(false)
                        setBotTokenDraft('')
                      }}
                    >
                      Abbrechen — gespeicherten Token behalten
                    </button>
                  ) : null}
                </>
              )}
            </div>
            <div>
              <Label htmlFor="tg-chat" className="text-xs text-muted-foreground">
                Deine persönliche Chat-ID („Test an mich“)
              </Label>
              <Input
                id="tg-chat"
                value={adminChatId}
                onChange={(e) => setAdminChatId(e.target.value)}
                placeholder="z. B. 1156058618 von @userinfobot"
                disabled={formDisabled}
                className="mt-1 font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tg-inbound" className="text-xs text-muted-foreground">
              Eingehende Partner-Antworten (Posteingang)
            </Label>
            <select
              id="tg-inbound"
              value={inboundMode}
              onChange={(e) =>
                setInboundMode(e.target.value as 'off' | 'longPoll' | 'webhook')
              }
              disabled={formDisabled}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground"
            >
              <option value="longPoll">Long Polling (ohne Tunnel — empfohlen lokal)</option>
              <option value="webhook">Webhook (öffentliche HTTPS-URL nötig)</option>
              <option value="off">Aus (nur Senden, keine Antworten in Morgendrot)</option>
            </select>
            {pub?.inboundPollActive ? (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                Poll aktiv — Antworten im Posteingang (Filter „Eingang“), alle ~20 s.
              </p>
            ) : inboundMode === 'longPoll' && (pub?.botTokenConfigured || botTokenDraft.trim()) ? (
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                Poll noch nicht aktiv — Speichern, dann API neu starten (<span className="font-mono">npm run dev</span>
                ). Details: Handbuch.
              </p>
            ) : null}
          </div>

          {showMonitorControls ? (
            <div className="space-y-3 rounded-lg border border-border/70 bg-muted/10 p-3">
              <p className="text-xs font-medium text-foreground">System-Alarme (Monitor)</p>
              <p className="text-[11px] text-muted-foreground">
                Sensor/Gerät → deine Chat-ID. Für normalen Chat aus. Handbuch → Telegram.
              </p>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="tg-enabled" className="text-sm text-foreground">
                  Monitor aktiv
                </Label>
                <Switch id="tg-enabled" checked={enabled} onCheckedChange={setEnabled} disabled={formDisabled} />
              </div>
              <div>
                <Label htmlFor="tg-relay" className="text-xs text-muted-foreground">
                  Relay-URL (optional)
                </Label>
                <Input
                  id="tg-relay"
                  value={relayBaseUrl}
                  onChange={(e) => setRelayBaseUrl(e.target.value)}
                  disabled={formDisabled}
                  className="mt-1 font-mono text-xs"
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-2 rounded-lg border border-border/80 bg-muted/10 p-3">
            <Label htmlFor="tg-test-notify" className="text-xs text-muted-foreground">
              Test an Kontakt (Chat-ID des Partners)
            </Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="tg-test-notify"
                value={testNotifyChatId}
                onChange={(e) => setTestNotifyChatId(e.target.value)}
                placeholder="Partner-Chat-ID"
                disabled={formDisabled}
                className="max-w-xs font-mono text-xs"
              />
              <button
                type="button"
                disabled={formDisabled || !testNotifyChatId.trim() || !pub?.botTokenConfigured}
                onClick={() => void handleTestNotify()}
                className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
              >
                {busy === 'testNotify' ? '…' : 'Test an Kontakt'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={formDisabled}
              onClick={() => void handleSave()}
              className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy === 'save' ? 'Speichere…' : 'Speichern'}
            </button>
            <button
              type="button"
              disabled={formDisabled || !canTest}
              title={
                canTest
                  ? 'Sendet Test in deine Telegram-App'
                  : 'Zuerst Token + Chat-ID eintragen und speichern'
              }
              onClick={() => void handleTest()}
              className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              {busy === 'test' ? 'Sende…' : 'Test an mich'}
            </button>
          </div>

          {feedback ? (
            <p
              role="status"
              className={cn(
                'rounded-lg border px-3 py-2 text-sm',
                feedback.kind === 'ok' &&
                  'border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100',
                feedback.kind === 'err' && 'border-red-500/40 bg-red-500/10 text-red-950 dark:text-red-100',
                feedback.kind === 'info' && 'border-border bg-muted/30 text-foreground'
              )}
            >
              {feedback.text}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
