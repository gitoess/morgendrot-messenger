'use client'

import { useEffect, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  TELEGRAM_NOTIFY_EXTRA_IDS_CAP,
  formatTelegramNotifyExtraChatIdsDisplay,
  readTelegramNotifyAudience,
  readTelegramNotifyExtraChatIds,
  readTelegramNotifyOnSend,
  telegramNotifyAudienceLabel,
  writeTelegramNotifyAudience,
  writeTelegramNotifyExtraChatIds,
  writeTelegramNotifyOnSend,
  type TelegramNotifyAudience,
} from '@/frontend/lib/telegram-notify-pref'
import { useAppTranslation } from '@/frontend/lib/i18n/hooks'

const AUDIENCE_OPTIONS: { value: TelegramNotifyAudience; title: string; hint: string }[] = [
  {
    value: 'contact',
    title: 'Nur Kontakt',
    hint: 'Partner mit Telegram-ID im Telefonbuch',
  },
  {
    value: 'self',
    title: 'Nur ich',
    hint: 'Deine Admin-Chat-ID unter Telegram-Bot',
  },
  {
    value: 'both',
    title: 'Beide',
    hint: 'Kontakt und deine Admin-Chat-ID',
  },
]

export function SettingsTelegramNotifyOnSend() {
  const { t } = useAppTranslation('dashboard')
  const [on, setOn] = useState(false)
  const [audience, setAudience] = useState<TelegramNotifyAudience>('contact')
  const [extraDraft, setExtraDraft] = useState('')

  useEffect(() => {
    setOn(readTelegramNotifyOnSend())
    setAudience(readTelegramNotifyAudience())
    setExtraDraft(formatTelegramNotifyExtraChatIdsDisplay(readTelegramNotifyExtraChatIds()))
  }, [])

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <MessageCircle className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">{t('telegramNotify.title')}</p>
            <Switch
              checked={on}
              onCheckedChange={(v) => {
                writeTelegramNotifyOnSend(v)
                setOn(v)
              }}
              aria-label={t('telegramNotify.aria')}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t('telegramNotify.hint')}</p>

          {on ? (
            <div className="space-y-3">
              <fieldset className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3">
                <legend className="px-1 text-xs font-medium text-foreground">Wer bekommt den Hinweis?</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {AUDIENCE_OPTIONS.map((opt) => {
                    const selected = audience === opt.value
                    return (
                      <label
                        key={opt.value}
                        className={`cursor-pointer rounded-lg border px-3 py-2 text-left transition-colors ${
                          selected
                            ? 'border-primary bg-primary/10 text-foreground'
                            : 'border-border bg-card text-muted-foreground hover:border-foreground/30'
                        }`}
                      >
                        <input
                          type="radio"
                          name="tg-notify-audience"
                          className="sr-only"
                          checked={selected}
                          onChange={() => {
                            writeTelegramNotifyAudience(opt.value)
                            setAudience(opt.value)
                          }}
                        />
                        <span className="block text-sm font-medium text-foreground">{opt.title}</span>
                        <span className="mt-0.5 block text-[11px] leading-snug">{opt.hint}</span>
                      </label>
                    )
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Aktiv: {telegramNotifyAudienceLabel(audience)}.
                </p>
              </fieldset>

              <div className="rounded-lg border border-border/80 bg-muted/10 p-3 space-y-2">
                <Label htmlFor="tg-notify-extra" className="text-xs font-medium text-foreground">
                  Weitere Kontakte (optional, max. {TELEGRAM_NOTIFY_EXTRA_IDS_CAP} Chat-IDs)
                </Label>
                <Input
                  id="tg-notify-extra"
                  value={extraDraft}
                  onChange={(e) => setExtraDraft(e.target.value)}
                  onBlur={() => {
                    const saved = writeTelegramNotifyExtraChatIds(extraDraft)
                    setExtraDraft(formatTelegramNotifyExtraChatIdsDisplay(saved))
                  }}
                  placeholder="123456789, 987654321"
                  className="font-mono text-xs"
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
