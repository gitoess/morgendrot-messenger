'use client'

import { BookUser, Crown, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppTranslation } from '@/frontend/lib/i18n/hooks'

export type MessengerBottomNavTab = 'messages' | 'einsatzleitung' | 'phonebook'

export type MessengerBottomNavProps = {
  active: MessengerBottomNavTab
  showEinsatzleitung?: boolean
  onMessages: () => void
  onEinsatzleitung?: () => void
  onPhonebook: () => void
}

function NavButton(p: {
  active: boolean
  label: string
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={p.onClick}
      className={cn(
        'flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-medium transition-colors',
        p.active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
      )}
      aria-current={p.active ? 'page' : undefined}
    >
      <span className={cn('rounded-lg p-1', p.active && 'bg-primary/15')}>{p.icon}</span>
      {p.label}
    </button>
  )
}

export function MessengerBottomNav(p: MessengerBottomNavProps) {
  const { t } = useAppTranslation('dashboard')

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-background/95 backdrop-blur supports-[padding:max(0px)]:pb-[max(0.25rem,env(safe-area-inset-bottom))]"
      aria-label={t('nav.bottomNavAria')}
    >
      <div className="mx-auto flex max-w-5xl">
        <NavButton
          active={p.active === 'messages'}
          label={t('nav.messages')}
          icon={<MessageSquare className="h-5 w-5" aria-hidden />}
          onClick={p.onMessages}
        />
        {p.showEinsatzleitung && p.onEinsatzleitung ? (
          <NavButton
            active={p.active === 'einsatzleitung'}
            label={t('nav.einsatzleitung')}
            icon={<Crown className="h-5 w-5" aria-hidden />}
            onClick={p.onEinsatzleitung}
          />
        ) : null}
        <NavButton
          active={p.active === 'phonebook'}
          label={t('nav.phonebook')}
          icon={<BookUser className="h-5 w-5" aria-hidden />}
          onClick={p.onPhonebook}
        />
      </div>
    </nav>
  )
}
