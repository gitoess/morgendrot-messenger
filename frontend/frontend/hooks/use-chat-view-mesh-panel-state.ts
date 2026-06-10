'use client'

/**
 * UI-State für Chat-Setup (Mesh-Kontakte Export/Import, BLE-Zuordnung, lokaler Purge).
 * Aus use-chat-view-core ausgelagert (Phase A).
 */

import { useState } from 'react'

export function useChatViewMeshPanelState() {
  const [meshSyncMsg, setMeshSyncMsg] = useState<string | null>(null)
  const [localPurgeBusy, setLocalPurgeBusy] = useState(false)
  const [contactBleAddress, setContactBleAddress] = useState('')
  const [contactBleUuid, setContactBleUuid] = useState('')
  const [contactBleBusy, setContactBleBusy] = useState(false)
  /** Composer: Klartext an einen Meshtastic-Knoten (!hex) statt Broadcast. */
  const [meshPlaintextToNodeEnabled, setMeshPlaintextToNodeEnabled] = useState(false)
  const [meshPlaintextNodeId, setMeshPlaintextNodeId] = useState('')

  return {
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
    meshPlaintextToNodeEnabled,
    setMeshPlaintextToNodeEnabled,
    meshPlaintextNodeId,
    setMeshPlaintextNodeId,
  }
}
