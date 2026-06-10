'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  isMessengerClientExpertModeEnabled,
  MESSENGER_CLIENT_EXPERT_MODE_CHANGED,
  setMessengerClientExpertModeEnabled,
} from '@/frontend/lib/messenger-client-expert-mode'

export function useMessengerClientExpertMode() {
  const [enabled, setEnabled] = useState(() =>
    typeof window !== 'undefined' ? isMessengerClientExpertModeEnabled() : false
  )

  useEffect(() => {
    setEnabled(isMessengerClientExpertModeEnabled())
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ enabled?: boolean }>).detail
      if (typeof detail?.enabled === 'boolean') setEnabled(detail.enabled)
      else setEnabled(isMessengerClientExpertModeEnabled())
    }
    window.addEventListener(MESSENGER_CLIENT_EXPERT_MODE_CHANGED, onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener(MESSENGER_CLIENT_EXPERT_MODE_CHANGED, onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])

  const setExpertMode = useCallback((next: boolean) => {
    setMessengerClientExpertModeEnabled(next)
    setEnabled(next)
  }, [])

  return { enabled, setExpertMode }
}
