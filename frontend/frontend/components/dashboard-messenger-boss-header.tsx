'use client'

import Link from 'next/link'
import { BookOpen, LogOut, Settings } from 'lucide-react'
import { DashboardRolePill } from '@/frontend/components/dashboard-role-pill'
import { ChatNetworkBadge } from '@/frontend/components/chat-network-badge'
import { DashboardHeaderAddress } from '@/frontend/components/dashboard-header-address'
import {
  TresorSessionBadge,
  type ChatViewVaultBannerActions,
} from '@/frontend/components/chat-view-chat-header'
import { useAppTranslation } from '@/frontend/lib/i18n/hooks'

export function DashboardMessengerBossHeader(p: {
  role?: string | null
  myAddressFull?: string | null
  onOpenSettings: () => void
  onLockSession?: () => void | Promise<void>
  vaultBannerActions?: ChatViewVaultBannerActions
  sessionLocked?: boolean
  hasKeys?: boolean
}) {
  const { t } = useAppTranslation('dashboard')
  const showVaultBadge = p.vaultBannerActions != null

  return (
    <header className="border-b border-border/80 bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-start justify-between gap-4 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-foreground">{t('brand.morgendrot')}</h1>
            <DashboardRolePill role={p.role} />
            <ChatNetworkBadge />
            {showVaultBadge ? (
              <TresorSessionBadge
                sessionLocked={!!p.sessionLocked}
                hasKeys={p.hasKeys}
                actions={p.vaultBannerActions}
              />
            ) : null}
          </div>
          <DashboardHeaderAddress address={p.myAddressFull} />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {p.onLockSession ? (
            <button
              type="button"
              onClick={() => void p.onLockSession?.()}
              className="flex h-8 items-center gap-1 rounded-lg px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title={t('lock.buttonTitle')}
              aria-label={t('lock.button')}
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden text-xs font-medium sm:inline">{t('lock.button')}</span>
            </button>
          ) : null}
          <Link
            href="/handbook"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={t('nav.handbook')}
            aria-label={t('nav.handbookOpen')}
          >
            <BookOpen className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={p.onOpenSettings}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={t('nav.settings')}
            aria-label={t('nav.settings')}
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
