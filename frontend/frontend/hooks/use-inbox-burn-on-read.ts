'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  INBOX_BURN_ON_READ_CHANGED,
  readBurnOnReadEnabled,
  writeBurnOnReadEnabled,
} from '@/frontend/lib/inbox-burn-on-read'

export function useInboxBurnOnRead() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    setEnabled(readBurnOnReadEnabled())
    const onChange = () => setEnabled(readBurnOnReadEnabled())
    window.addEventListener(INBOX_BURN_ON_READ_CHANGED, onChange)
    return () => window.removeEventListener(INBOX_BURN_ON_READ_CHANGED, onChange)
  }, [])

  const setBurnOnReadEnabled = useCallback((on: boolean) => {
    writeBurnOnReadEnabled(on)
    setEnabled(on)
  }, [])

  return { burnOnReadEnabled: enabled, setBurnOnReadEnabled }
}
