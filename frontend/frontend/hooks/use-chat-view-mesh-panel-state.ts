'use client'

/**
 * UI-State für Chat-Setup (Mesh-Kontakte Export/Import, BLE-Zuordnung, lokaler Purge).
 * Aus use-chat-view-core ausgelagert (Phase A).
 */

import { useState } from 'react'

export function useChatViewMeshPanelState() {
  const [meshExportPw, setMeshExportPw] = useState('')
  const [meshImportPw, setMeshImportPw] = useState('')
  const [meshImportJson, setMeshImportJson] = useState('')
  const [meshSyncBusy, setMeshSyncBusy] = useState(false)
  const [meshSyncMsg, setMeshSyncMsg] = useState<string | null>(null)
  const [localPurgeBusy, setLocalPurgeBusy] = useState(false)
  const [contactBleAddress, setContactBleAddress] = useState('')
  const [contactBleUuid, setContactBleUuid] = useState('')
  const [contactBleBusy, setContactBleBusy] = useState(false)

  return {
    meshExportPw,
    setMeshExportPw,
    meshImportPw,
    setMeshImportPw,
    meshImportJson,
    setMeshImportJson,
    meshSyncBusy,
    setMeshSyncBusy,
    meshSyncMsg,
    setMeshSyncMsg,
    localPurgeBusy,
    setLocalPurgeBusy,
    contactBleAddress,
    setContactBleAddress,
    contactBleUuid,
    setContactBleUuid,
    contactBleBusy,
    setContactBleBusy,
  }
}
