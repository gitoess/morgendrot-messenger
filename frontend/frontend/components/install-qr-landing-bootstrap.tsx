'use client'

import { useEffect } from 'react'
import { applyInstallQrFromCurrentUrl } from '@/frontend/lib/install-qr'

/** Übernimmt API-Basis aus WLAN-QR-Link (`?mi=1&b=…`) beim ersten Seitenaufruf. */
export function InstallQrLandingBootstrap() {
  useEffect(() => {
    applyInstallQrFromCurrentUrl()
  }, [])
  return null
}
