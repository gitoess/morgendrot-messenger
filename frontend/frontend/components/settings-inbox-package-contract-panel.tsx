'use client'

/**
 * Move-Vertrag (Package-ID) — Einstellungen → IOTA → Expertenmodus.
 * Temporär = Posteingang-Filter; Dauerhaft = /set-package-id.
 * Details: docs/INBOX-PACKAGE-EXPERT-MODE.md
 */

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ChatViewInboxPackageExpertMenu } from '@/frontend/components/chat-view-inbox-package-expert-menu'
import { fetchPackageIdHistory, setPackageIdCommand, type ApiStatus } from '@/frontend/lib/api'
import {
  readInboxPackageFilterStore,
  writeInboxPackageFilterStore,
} from '@/frontend/lib/inbox-package-filter-store'
import { requestMessengerInboxForceRefresh } from '@/frontend/lib/messenger-inbox-force-refresh'

type SettingsInboxPackageContractPanelProps = {
  apiStatus: ApiStatus | null | undefined
}

export function SettingsInboxPackageContractPanel({ apiStatus }: SettingsInboxPackageContractPanelProps) {
  const [inboxPackageFilter, setInboxPackageFilter] = useState(() =>
    typeof window !== 'undefined' ? readInboxPackageFilterStore() : ''
  )
  const [localServerPackageId, setLocalServerPackageId] = useState<string | null>(null)
  const [packageIdSuggestions, setPackageIdSuggestions] = useState<string[]>([])
  const [packageIdBusy, setPackageIdBusy] = useState(false)
  const serverPackageId = localServerPackageId ?? apiStatus?.packageId

  const refreshSuggestions = useCallback(async () => {
    const seen = new Map<string, string>()
    const add = (raw: string | undefined) => {
      const t = (raw || '').trim()
      if (!/^0x[a-fA-F0-9]{64}$/.test(t)) return
      const k = t.toLowerCase()
      if (!seen.has(k)) seen.set(k, t)
    }
    add(apiStatus?.packageId)
    const r = await fetchPackageIdHistory()
    if (r.ok) {
      add(r.current)
      for (const x of r.history ?? []) add(x)
      for (const x of r.discovered ?? []) add(x)
    }
    setPackageIdSuggestions([...seen.values()])
  }, [apiStatus?.packageId])

  useEffect(() => {
    void refreshSuggestions()
  }, [refreshSuggestions])

  const onApplyTemporary = useCallback(async (packageId: string) => {
    writeInboxPackageFilterStore(packageId)
    setInboxPackageFilter(readInboxPackageFilterStore())
    toast.message('Temporär: Posteingang zeigt nur diese Package-ID.')
  }, [])

  const onClearTemporary = useCallback(async () => {
    writeInboxPackageFilterStore('')
    setInboxPackageFilter('')
    toast.message('Temporärer Filter aus — voller Posteingang.')
  }, [])

  const onApplyPermanent = useCallback(async (packageId: string) => {
    const t = packageId.trim()
    if (!/^0x[a-fA-F0-9]{64}$/.test(t)) {
      toast.error('Package-ID: 0x und 64 Hex-Zeichen.')
      return
    }
    setPackageIdBusy(true)
    try {
      const res = await setPackageIdCommand(t)
      if (!res.ok) {
        toast.error(res.error || 'set-package-id fehlgeschlagen')
        return
      }
      writeInboxPackageFilterStore(t)
      setInboxPackageFilter(t)
      setLocalServerPackageId(t)
      requestMessengerInboxForceRefresh()
      void refreshSuggestions()
      toast.success('Package-ID gespeichert; Posteingang neu laden.')
    } finally {
      setPackageIdBusy(false)
    }
  }, [refreshSuggestions])

  return (
    <div className="space-y-2">
      <h5 className="text-sm font-semibold text-foreground">IOTA-Vertrag (Package-ID)</h5>
      <ChatViewInboxPackageExpertMenu
        embedded
        serverPackageId={serverPackageId}
        inboxPackageFilter={inboxPackageFilter}
        packageIdSuggestions={packageIdSuggestions}
        packageIdBusy={packageIdBusy}
        onApplyTemporary={onApplyTemporary}
        onClearTemporary={onClearTemporary}
        onApplyPermanent={onApplyPermanent}
      />
    </div>
  )
}
