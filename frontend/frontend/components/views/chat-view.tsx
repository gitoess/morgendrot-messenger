'use client'

import { useEffect, useState } from 'react'
import { isCapacitorNativePlatform } from '@/frontend/lib/capacitor-platform'
import { forceReleaseNativeBodyLock } from '@/frontend/components/native-modal-shell'
import {
  purgeOrphanRadixOverlays,
  releaseStuckModalPointerEvents,
} from '@/frontend/lib/release-modal-pointer-events'
import { useCapacitorChatInteractionGuard } from '@/frontend/hooks/use-capacitor-chat-interaction-guard'
import { useChatViewCore } from '@/frontend/hooks/use-chat-view-core'
import { ChatViewMainContent } from '@/frontend/components/chat-view-main-content'
import type { ChatViewVaultBannerActions } from '@/frontend/components/chat-view-chat-header'
import { isDialogChannel, type MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
import type { PendingHandshakesPollState } from '@/frontend/hooks/use-chat-view-pending-handshakes'

export type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'

interface ChatViewProps {
  variant: 'private-chat' | 'pinnwand'
  role?: string
  myAddress?: string
  vaultBannerActions?: ChatViewVaultBannerActions
  /** App-weites Polling (Dashboard) — Toast/Badge auch ohne geöffneten Posteingang. */
  pendingHandshakes?: PendingHandshakesPollState
  /** Boss/Kommandant: zentraler Einsatzleitung-Tab. */
  onOpenEinsatzleitung?: () => void
  /** Bottom-Nav: Telefonbuch-Sheet öffnen. */
  phonebookNavRequest?: number
  onOpenSettings?: () => void
}

function ChatViewLoadingShell() {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-sm text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <span>Nachrichten werden geladen…</span>
    </div>
  )
}

/**
 * Messenger-Chat: Dashboard-Kachel „Nachrichten“ öffnet immer `private-chat`; gespeicherte Sessions
 * mit `pinnwand` setzen den Kanal beim Mount. Umschalten: **`channel`** → `isPrivate` fürs Core-Hook.
 */
export function ChatView({
  variant,
  role = '',
  myAddress = '',
  vaultBannerActions,
  pendingHandshakes,
  onOpenEinsatzleitung,
  phonebookNavRequest,
  onOpenSettings,
}: ChatViewProps) {
  const [coreReady, setCoreReady] = useState(() => !isCapacitorNativePlatform())

  useCapacitorChatInteractionGuard(coreReady)

  useEffect(() => {
    if (!isCapacitorNativePlatform()) return
    forceReleaseNativeBodyLock()
    purgeOrphanRadixOverlays()
    releaseStuckModalPointerEvents({ force: true })
    let cancelled = false
    const start = () => {
      if (!cancelled) setCoreReady(true)
    }
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(start)
    })
    return () => {
      cancelled = true
      window.cancelAnimationFrame(id)
    }
  }, [])

  if (!coreReady) return <ChatViewLoadingShell />

  return (
    <ChatViewLoaded
      variant={variant}
      role={role}
      myAddress={myAddress}
      vaultBannerActions={vaultBannerActions}
      pendingHandshakes={pendingHandshakes}
      onOpenEinsatzleitung={onOpenEinsatzleitung}
      phonebookNavRequest={phonebookNavRequest}
      onOpenSettings={onOpenSettings}
    />
  )
}

function ChatViewLoaded({
  variant,
  role = '',
  myAddress = '',
  vaultBannerActions,
  pendingHandshakes,
  onOpenEinsatzleitung,
  phonebookNavRequest,
  onOpenSettings,
}: ChatViewProps) {
  const [channel, setChannel] = useState<MessengerChatChannel>(() =>
    variant === 'pinnwand' ? 'pinnwand' : 'private'
  )
  useEffect(() => {
    setChannel(variant === 'pinnwand' ? 'pinnwand' : 'private')
  }, [variant])
  const core = useChatViewCore({ channelMode: channel, role, myAddress })
  return (
    <ChatViewMainContent
      {...core}
      vaultBannerActions={vaultBannerActions}
      onChannelModeChange={setChannel}
      pendingHandshakes={pendingHandshakes}
      onOpenEinsatzleitung={onOpenEinsatzleitung}
      phonebookNavRequest={phonebookNavRequest}
      onOpenSettings={onOpenSettings}
    />
  )
}
