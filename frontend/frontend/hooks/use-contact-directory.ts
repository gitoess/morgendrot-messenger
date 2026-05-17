'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  fetchContactDirectory,
  type ContactMeshEntryClient,
} from '@/frontend/lib/api'
import { isAddressMeshVerifiedInDirectory } from '@/frontend/lib/mesh-contact-verify'

/** Kontaktverzeichnis inkl. Mesh-Felder; „verifiziert“ = meshNodeId + meshPublicKeyHex gesetzt. */
export function useContactDirectory() {
  const [directory, setDirectory] = useState<Record<string, ContactMeshEntryClient>>({})
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let alive = true
    fetchContactDirectory().then((r) => {
      if (!alive) return
      if (r.ok && r.directory) setDirectory(r.directory)
      else if (r.ok && r.labels) {
        const built: Record<string, ContactMeshEntryClient> = {}
        for (const [addr, label] of Object.entries(r.labels)) {
          const a = addr.trim().toLowerCase()
          if (a) built[a] = { label: label || 'Partner' }
        }
        setDirectory(built)
      }
    })
    return () => {
      alive = false
    }
  }, [tick])

  const isMeshVerifiedForAddress = useCallback(
    (address: string) => isAddressMeshVerifiedInDirectory(directory, address),
    [directory]
  )

  return { directory, refresh, isMeshVerifiedForAddress }
}
