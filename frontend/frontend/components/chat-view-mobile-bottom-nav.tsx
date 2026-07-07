'use client'

import { BookUser, Inbox, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ChatViewMobileTab = 'chats' | 'inbox' | 'contacts'

export type ChatViewMobileBottomNavProps = {
  active: ChatViewMobileTab
  onChange: (tab: ChatViewMobileTab) => void
  inboxUnreadCount?: number
  className?: string
}

export function ChatViewMobileBottomNav(p: ChatViewMobileBottomNavProps) {
  const tabs: {
    id: ChatViewMobileTab
    label: string
    icon: typeof MessageCircle
    badge?: number
  }[] = [
    { id: 'chats', label: 'Chats', icon: MessageCircle },
    { id: 'inbox', label: 'Posteingang', icon: Inbox, badge: p.inboxUnreadCount },
    { id: 'contacts', label: 'Kontakte', icon: BookUser },
  ]

  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/98 backdrop-blur-md',
        'pb-[max(0.35rem,env(safe-area-inset-bottom))]',
        p.className
      )}
      aria-label="Messenger Navigation"
    >
      <div className="grid grid-cols-3">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = p.active === tab.id
          const badge = tab.badge ?? 0
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => p.onChange(tab.id)}
              className={cn(
                'flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-semibold transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <span className="relative">
                <Icon className={cn('h-5 w-5', active && 'stroke-[2.5]')} aria-hidden />
                {badge > 0 ? (
                  <span className="absolute -right-2.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground">
                    {badge > 99 ? '99+' : badge}
                  </span>
                ) : null}
              </span>
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
