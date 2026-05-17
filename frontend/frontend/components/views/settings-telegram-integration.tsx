'use client'

import { useCallback, useEffect, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  fetchTelegramIntegration,
  saveTelegramIntegration,
  testTelegramAlarm,
  type TelegramIntegrationPublic,
} from '@/frontend/lib/api/telegram-integrations'
import { testTelegramNotify } from '@/frontend/lib/api/telegram-notify'

type SettingsTelegramIntegrationProps = {
  backendOnline: boolean
}

type FeedbackKind = 'ok' | 'err' | 'info'

export function SettingsTelegramIntegration({ backendOnline }: SettingsTelegramIntegrationProps) {
  const [pub, setPub] = useState<TelegramIntegrationPublic | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [botToken, setBotToken] = useState('')
  const [adminChatId, setAdminChatId] = useState('')
  const [relayBaseUrl, setRelayBaseUrl] = useState('http://127.0.0.1:8787')
  const [busy, setBusy] = useState<'load' | 'save' | 'test' | 'testNotify' | null>(null)
  const [testNotifyChatId, setTestNotifyChatId] = useState('')
  const [inboundMode, setInboundMode] = useState<'off' | 'longPoll' | 'webhook'>('longPoll')
  const [feedback, setFeedback] = useState<{ kind: FeedbackKind; text: string } | null>(null)

  const applyPublic = useCallback((p: TelegramIntegrationPublic) => {
    setPub(p)
    setEnabled(p.enabled)
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

  const canTest = Boolean(pub?.botTokenConfigured || botToken.trim()) && Boolean(adminChatId.trim() || pub?.adminChatId)

  const handleSave = async () => {
    setFeedback({ kind: 'info', text: 'Speichere…' })
    setBusy('save')
    const body: {
      enabled: boolean
      botToken?: string
      adminChatId: string
      relayBaseUrl: string
      inboundMode: 'off' | 'longPoll' | 'webhook'
    } = {
      enabled,
      adminChatId: adminChatId.trim(),
      relayBaseUrl: relayBaseUrl.trim(),
      inboundMode,
    }
    if (botToken.trim()) body.botToken = botToken.trim()
    const res = await saveTelegramIntegration(body)
    if (res.ok) {
      applyPublic(res)
      setBotToken('')
      setFeedback({
        kind: 'ok',
        text: res.botTokenConfigured
          ? `Gespeichert. Token maskiert: ${res.botTokenMasked || '—'}, Chat-ID: ${res.adminChatId || '—'}.`
          : 'Gespeichert (ohne Token).',
      })
    } else {
      setFeedback({
        kind: 'err',
        text: res.error || 'Speichern fehlgeschlagen. Schalter aktivieren, Token + Chat-ID eintragen.',
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

  const formDisabled = !backendOnline || busy !== null

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300">
          <MessageCircle className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <h4 className="font-semibold text-foreground">Integrationen · Telegram</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Push bei <strong className="text-foreground">Systemalarmen</strong> (Monitor). Es gibt hier{' '}
              <strong className="text-foreground">kein Nachrichtenfeld</strong> — „Test an mich“ schickt automatisch
              eine Meldung in deine <strong className="text-foreground">Telegram-App</strong> (Chat mit dem Bot).{' '}
              <Link
                href="/handbook?file=TELEGRAM-INTEGRATION-ZIELBILD.md"
                className="text-primary underline hover:no-underline"
              >
                Zielbild
              </Link>
            </p>
          </div>

          <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
            <li>Bei @BotFather Bot anlegen → Token hier einfügen</li>
            <li>
              In Telegram den Bot öffnen → <strong className="text-foreground">Start</strong>
            </li>
            <li>Chat-ID von @userinfobot kopieren</li>
            <li>
              Schalter <strong className="text-foreground">Telegram-Alarme aktiv</strong> an → Speichern
            </li>
            <li>
              Optional: zweites Terminal <span className="font-mono">npm run telegram-webhook</span> (für Monitor)
            </li>
            <li>
              <strong className="text-foreground">Test an mich</strong> → deine Telegram-App
            </li>
            <li>
              Partner-Chat-ID im <strong className="text-foreground">Telefonbuch</strong>; im Chat Schalter „Telegram-Hinweis“
            </li>
          </ol>

          {!backendOnline ? (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
              Backend offline — zuerst <span className="font-mono">npm run dev</span> starten.
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="tg-enabled" className="text-sm text-foreground">
              System-Alarme (Monitor)
            </Label>
            <Switch id="tg-enabled" checked={enabled} onCheckedChange={setEnabled} disabled={formDisabled} />
          </div>
          <p className="-mt-2 text-[11px] text-muted-foreground">
            Nur Monitor/Sensor. Chat Senden/Empfang braucht Bot-Token + Long Polling unten — Schalter kann aus bleiben.
          </p>

          <div className="space-y-3">
            <div>
              <Label htmlFor="tg-token" className="text-xs text-muted-foreground">
                Bot-Token (@BotFather)
              </Label>
              <Input
                id="tg-token"
                type="password"
                autoComplete="off"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder={pub?.botTokenConfigured ? `Gespeichert (${pub.botTokenMasked})` : '123456789:AAH…'}
                disabled={formDisabled}
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div>
              <Label htmlFor="tg-chat" className="text-xs text-muted-foreground">
                Deine Chat-ID (Alarme)
              </Label>
              <Input
                id="tg-chat"
                value={adminChatId}
                onChange={(e) => setAdminChatId(e.target.value)}
                placeholder="z. B. von @userinfobot"
                disabled={formDisabled}
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div>
              <Label htmlFor="tg-relay" className="text-xs text-muted-foreground">
                Relay-URL (optional, für Monitor)
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
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Long Polling läuft im API-Server (<span className="font-mono">npm run dev</span>). Nur Chats aus dem{' '}
              <strong className="text-foreground">Telefonbuch</strong> (Telegram Chat-ID). Nach Speichern Backend
              neu starten, wenn der Poll nicht startet.
              {pub?.inboundPollActive ? (
                <span className="mt-1 block text-emerald-600 dark:text-emerald-400">
                  Poll aktiv — Partner-Antworten erscheinen im Posteingang (Filter „Eingang“), alle ~20 s.
                </span>
              ) : inboundMode === 'longPoll' && (pub?.botTokenConfigured || botToken.trim()) ? (
                <span className="mt-1 block text-amber-700 dark:text-amber-300">
                  Poll noch nicht aktiv — unten <strong className="text-foreground">Speichern</strong>, dann API neu
                  starten (<span className="font-mono">npm run dev</span>).
                </span>
              ) : null}
            </p>
          </div>

          {pub ? (
            <p className="text-xs text-muted-foreground">
              Relay: {pub.relayReachable ? 'erreichbar' : 'nicht erreichbar (Test geht oft trotzdem direkt)'} ·
              Monitor-Webhook: {pub.monitorWebhookActive ? 'aktiv' : 'inaktiv'}
            </p>
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
            <button
              type="button"
              disabled={!backendOnline || busy === 'load'}
              onClick={() => void load()}
              className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              Neu laden
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
