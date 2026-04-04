'use client'

/**
 * Posteingang-Package-ID: Filterfeld, Vorschläge aus Historie, Backend setzen.
 * Zwei Hooks: State vor useChatViewInbox; Befehle danach (braucht loadMessages + refreshApiStatus).
 */

import { useState, useEffect, useCallback } from 'react'
import { fetchPackageIdHistory, setPackageIdCommand } from '@/frontend/lib/api'

export function useChatViewPackageFilterState() {
  const [inboxPackageFilter, setInboxPackageFilter] = useState('')
  const [packageIdSuggestions, setPackageIdSuggestions] = useState<string[]>([])
  const [packageIdBusy, setPackageIdBusy] = useState(false)
  return {
    inboxPackageFilter,
    setInboxPackageFilter,
    packageIdSuggestions,
    setPackageIdSuggestions,
    packageIdBusy,
    setPackageIdBusy,
  }
}

export type UseChatViewPackageIdCommandsParams = {
  showSetup: boolean
  inboxPackageFilter: string
  setInboxPackageFilter: React.Dispatch<React.SetStateAction<string>>
  setPackageIdSuggestions: React.Dispatch<React.SetStateAction<string[]>>
  setPackageIdBusy: React.Dispatch<React.SetStateAction<boolean>>
  loadMessages: (mode?: 'reset' | 'append', packageIdOverride?: unknown) => Promise<void>
  refreshApiStatus: () => Promise<void>
  setStatus: (s: 'idle' | 'success' | 'error') => void
  setStatusMsg: (msg: string) => void
}

export function useChatViewPackageIdCommands(p: UseChatViewPackageIdCommandsParams) {
  const {
    showSetup,
    inboxPackageFilter,
    setInboxPackageFilter,
    setPackageIdSuggestions,
    setPackageIdBusy,
    loadMessages,
    refreshApiStatus,
    setStatus,
    setStatusMsg,
  } = p

  const refreshPackageIdSuggestions = useCallback(async () => {
    const r = await fetchPackageIdHistory()
    if (!r.ok) return
    const seen = new Set<string>()
    for (const x of [r.current, ...(r.history ?? []), ...(r.discovered ?? [])]) {
      const t = (x || '').trim()
      if (/^0x[a-fA-F0-9]{64}$/.test(t)) seen.add(t.toLowerCase())
    }
    setPackageIdSuggestions([...seen])
  }, [setPackageIdSuggestions])

  useEffect(() => {
    if (!showSetup) return
    void refreshPackageIdSuggestions()
  }, [showSetup, refreshPackageIdSuggestions])

  const applyPackageIdBackend = useCallback(
    async (raw: string) => {
      const t = raw.trim()
      if (!/^0x[a-fA-F0-9]{64}$/.test(t)) {
        setStatus('error')
        setStatusMsg('Package-ID: 0x und 64 Hex-Zeichen.')
        setTimeout(() => setStatus('idle'), 5000)
        return
      }
      setPackageIdBusy(true)
      try {
        const res = await setPackageIdCommand(t)
        if (res.ok) {
          await refreshApiStatus()
          setInboxPackageFilter(t)
          await loadMessages('reset')
          void refreshPackageIdSuggestions()
          setStatus('success')
          setStatusMsg('Package-ID gespeichert; Posteingang neu geladen.')
          setTimeout(() => setStatus('idle'), 5000)
        } else {
          setStatus('error')
          setStatusMsg(res.error || 'set-package-id fehlgeschlagen')
          setTimeout(() => setStatus('idle'), 6000)
        }
      } finally {
        setPackageIdBusy(false)
      }
    },
    [loadMessages, refreshApiStatus, refreshPackageIdSuggestions, setInboxPackageFilter, setPackageIdBusy, setStatus, setStatusMsg]
  )

  const applyInboxPackageFilterOnly = useCallback(async () => {
    const t = inboxPackageFilter.trim()
    setInboxPackageFilter(t)
    await loadMessages('reset', t || undefined)
  }, [inboxPackageFilter, loadMessages, setInboxPackageFilter])

  return {
    refreshPackageIdSuggestions,
    applyPackageIdBackend,
    applyInboxPackageFilterOnly,
  }
}
