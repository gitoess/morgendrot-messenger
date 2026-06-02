'use client'

import { ArrowRight, Crown, MessageSquare, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

const cardBase =
  'flex min-h-[148px] flex-col gap-3 rounded-2xl border p-5 text-left transition-colors hover:brightness-110'

export function DashboardBossQuickActions(p: {
  onOpenMessages: () => void
  onOpenEinsatzleitung: () => void
  onOpenVault: () => void
}) {
  return (
    <section aria-label="Schnellaktionen">
      <h2 className="sr-only">Schnellaktionen</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={p.onOpenMessages}
          className={cn(
            cardBase,
            'border-emerald-500/35 bg-gradient-to-br from-emerald-500/15 to-transparent'
          )}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/20 text-emerald-400">
            <MessageSquare className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">Nachrichten</p>
            <p className="text-sm text-muted-foreground">Chats, Funk, Team-Postfächer</p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-300/90">
            Öffnen <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        </button>
        <button
          type="button"
          onClick={p.onOpenEinsatzleitung}
          className={cn(
            cardBase,
            'border-amber-500/40 bg-gradient-to-br from-amber-500/15 to-transparent'
          )}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/20 text-amber-400">
            <Crown className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">Einsatzleitung</p>
            <p className="text-sm text-muted-foreground">Handoff-ZIP, Helfer-QR (WLAN)</p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-200/90">
            Öffnen <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        </button>
        <button
          type="button"
          onClick={p.onOpenVault}
          className={cn(
            cardBase,
            'border-red-500/35 bg-gradient-to-br from-red-500/12 to-transparent'
          )}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/15 text-red-400">
            <Shield className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">Tresor &amp; Sicherheit</p>
            <p className="text-sm text-muted-foreground">Passwort, Seed, Export</p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-300/90">
            Öffnen <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        </button>
      </div>
    </section>
  )
}
