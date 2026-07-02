'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  fetchTelegramIntegration,
  saveTelegramIntegration,
  testTelegramAlarm,
  type TelegramIntegrationPublic,
} from '@/frontend/lib/api/telegram-integrations'
import { deriveBossTelegramWizardStatus } from '@/frontend/lib/boss-wizard-telegram-context'
import { toast } from 'sonner'

type OnboardingBossTelegramStepProps = {
  backendOnline?: boolean
  onOpenSettings?: () => void
}

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

export function OnboardingBossTelegramStep(p: OnboardingBossTelegramStepProps) {
  const [pub, setPub] = useState<TelegramIntegrationPublic | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(false)
  const [savedBotToken, setSavedBotToken] = useState('')
  const [botTokenDraft, setBotTokenDraft] = useState('')
  const [tokenReplaceOpen, setTokenReplaceOpen] = useState(false)
  const [adminChatId, setAdminChatId] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [busy, setBusy] = useState<'save' | 'test' | null>(null)
  const [msg, setMsg] = useState('')
  const [tokenCopied, setTokenCopied] = useState(false)

  const applyPublic = useCallback((data: TelegramIntegrationPublic) => {
    setPub(data)
    setSavedBotToken(data.botToken || '')
    setAdminChatId(data.adminChatId || '')
    setInviteLink(data.einsatzGroupInviteLink || '')
    setLoadError('')
  }, [])

  const load = useCallback(async () => {
    if (!p.backendOnline) return
    setLoading(true)
    setLoadError('')
    const res = await fetchTelegramIntegration()
    if (res.ok) applyPublic(res)
    else {
      const hint =
        res.error?.includes('404') || res.error?.includes('Not Found')
          ? `${res.error} — Backend neu starten (npm run dm).`
          : res.error || 'Telegram-Status konnte nicht geladen werden.'
      setLoadError(hint)
    }
    setLoading(false)
  }, [applyPublic, p.backendOnline])

  useEffect(() => {
    void load()
  }, [load])

  const status = useMemo(
    () =>
      deriveBossTelegramWizardStatus(pub, {
        botTokenDraft,
        adminChatId,
        inviteLink,
      }),
    [pub, botTokenDraft, adminChatId, inviteLink]
  )

  const displayToken = savedBotToken.trim()
  const showTokenField = !displayToken || tokenReplaceOpen

  const runSave = async () => {
    if (!p.backendOnline) {
      setMsg('Backend offline — Telegram später in den Einstellungen einrichten.')
      return
    }
    setBusy('save')
    setMsg('')
    try {
      const tokenToSave = botTokenDraft.trim() || savedBotToken.trim()
      const body: Parameters<typeof saveTelegramIntegration>[0] = {
        enabled: pub?.enabled ?? false,
        adminChatId: adminChatId.trim(),
        einsatzGroupInviteLink: inviteLink.trim(),
        einsatzGroupAlarmEnabled: Boolean(inviteLink.trim()),
        inboundMode: pub?.inboundMode === 'webhook' ? 'webhook' : 'longPoll',
      }
      if (tokenToSave) body.botToken = tokenToSave
      const res = await saveTelegramIntegration(body)
      if (!res.ok) {
        const err = res.error || 'Speichern fehlgeschlagen.'
        setMsg(err)
        toast.error(err)
        return
      }
      applyPublic(res)
      if (res.botToken) setSavedBotToken(res.botToken)
      setBotTokenDraft('')
      setTokenReplaceOpen(false)
      setMsg('Gespeichert.')
      toast.success('Telegram gespeichert.')
    } finally {
      setBusy(null)
    }
  }

  const runTest = async () => {
    setBusy('test')
    setMsg('')
    try {
      const res = await testTelegramAlarm()
      const text = res.ok
        ? `${res.message || 'Test gesendet.'} In der Telegram-App prüfen.`
        : res.error || 'Test fehlgeschlagen.'
      setMsg(text)
      if (res.ok) toast.success('Test-Alarm gesendet.')
      else toast.error(text)
      if (res.ok) void load()
    } finally {
      setBusy(null)
    }
  }

  const copyToken = async () => {
    if (!displayToken) return
    try {
      await navigator.clipboard.writeText(displayToken)
      setTokenCopied(true)
      setTimeout(() => setTokenCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  if (!p.backendOnline) {
    return (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>
          Telegram ist <strong className="font-medium text-foreground">optional</strong> — überspringen oder später unter
          Einstellungen → Telegram einrichten.
        </p>
        {p.onOpenSettings ? (
          <Button type="button" size="sm" variant="outline" onClick={() => p.onOpenSettings?.()}>
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Einstellungen (Telegram)
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Optional: Bot für Test-Alarme an dich und optional eine <strong className="font-medium text-foreground">Alarmgruppe</strong>{' '}
        für Helfer. Postfächer auf der Chain sind davon unabhängig. Schritt überspringbar.
      </p>

      {loading ? (
        <p className="text-xs text-muted-foreground">
          <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
          Lade Telegram-Konfiguration vom Boss…
        </p>
      ) : null}
      {loadError ? <p className="text-xs text-amber-800 dark:text-amber-200">{loadError}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <StatusRow
          ok={status.readyMinimal}
          label={status.readyMinimal ? 'Bot & deine Chat-ID' : 'Bot & deine Chat-ID (Minimum)'}
          detail={
            status.readyMinimal
              ? pub?.inboundPollActive
                ? 'Long Polling aktiv — Partner-Antworten möglich.'
                : 'Gespeichert — ggf. Backend neu starten, damit Polling startet.'
              : 'Token von @BotFather + deine ID von @userinfobot (nicht die Bot-ID aus dem Token).'
          }
        />
        <StatusRow
          ok={status.groupConfigured}
          label={status.groupConfigured ? 'Alarmgruppe' : 'Alarmgruppe (optional)'}
          detail={
            status.groupConfigured
              ? pub?.einsatzGroupLabel
                ? `Label: ${pub.einsatzGroupLabel}`
                : 'Einladungslink gespeichert.'
              : 'Gruppen-Link t.me/+… — für Einsatz-Alarme an alle.'
          }
        />
      </div>

      {status.readyMinimal && !showTokenField ? (
        <div className="rounded-md border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-100">
          Telegram-Basis ist eingerichtet — mit <strong>Weiter</strong> oder überspringen. Feintuning in{' '}
          <button type="button" className="underline" onClick={() => p.onOpenSettings?.()}>
            Einstellungen → Telegram
          </button>
          .
        </div>
      ) : null}

      <div className="space-y-3 rounded-md border border-border/80 bg-muted/15 p-3">
        <div className="space-y-1.5">
          <Label htmlFor="wiz-tg-token" className="text-xs">
            Bot-Token (@BotFather)
          </Label>
          {displayToken && !showTokenField ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                <p className="min-w-0 flex-1 break-all font-mono text-xs">
                  {pub?.botTokenMasked || displayToken}
                </p>
                <Button type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={() => void copyToken()}>
                  {tokenCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <button
                type="button"
                className="text-xs text-primary underline hover:no-underline"
                onClick={() => {
                  setTokenReplaceOpen(true)
                  setBotTokenDraft('')
                }}
              >
                Anderen Token eintragen
              </button>
            </div>
          ) : (
            <>
              {displayToken && tokenReplaceOpen ? (
                <p className="text-[11px] text-muted-foreground">Neuen Token einfügen — leer lassen zum Abbrechen.</p>
              ) : null}
              <Input
                id="wiz-tg-token"
                className="font-mono text-xs"
                placeholder="123456789:AAH… von @BotFather"
                value={botTokenDraft}
                onChange={(e) => setBotTokenDraft(e.target.value)}
                autoComplete="off"
              />
              {tokenReplaceOpen ? (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline"
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

        <div className="space-y-1.5">
          <Label htmlFor="wiz-tg-admin" className="text-xs">
            Deine Chat-ID (@userinfobot)
          </Label>
          <Input
            id="wiz-tg-admin"
            className="font-mono text-xs"
            placeholder="z. B. 1156058618"
            value={adminChatId}
            onChange={(e) => setAdminChatId(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">
            Bot vorher in Telegram öffnen und <strong className="text-foreground/90">Start</strong> tippen.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="wiz-tg-invite" className="text-xs">
            Alarmgruppe — Einladungslink (optional)
          </Label>
          <Input
            id="wiz-tg-invite"
            className="text-xs"
            placeholder="https://t.me/+…"
            value={inviteLink}
            onChange={(e) => setInviteLink(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy !== null || loading} onClick={() => void runSave()}>
          {busy === 'save' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Speichern
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy !== null || !status.readyMinimal}
          onClick={() => void runTest()}
        >
          {busy === 'test' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Test an mich
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
          Neu laden
        </Button>
        {p.onOpenSettings ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => p.onOpenSettings?.()}>
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Alle Optionen…
          </Button>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Mehr (Relay, Webhook, Gruppe an Team senden):{' '}
        <Link href="/handbook?file=TELEGRAM-INTEGRATION-EINRICHTUNG.md" className="text-primary underline-offset-2 hover:underline">
          Handbuch Telegram
        </Link>
        .
      </p>

      {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
    </div>
  )
}
